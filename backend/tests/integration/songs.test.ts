import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ITUNES_SEARCH_URL, SONG_RESULTS, SONG_SEARCH_TIMEOUT_MS, searchSongs } from "@/server/services/songs";
import { RATE_LIMITS } from "@/server/rate-limit";
import { makeActor } from "./factories";

const track = (over: Record<string, unknown> = {}) => ({
  trackId: 1, trackName: "Heroes", artistName: "David Bowie", collectionName: "Heroes", artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/a/b/100x100bb.jpg", ...over,
});
const reply = (results: unknown[]): typeof fetch => (async () => new Response(JSON.stringify({ resultCount: results.length, results }), { status: 200 })) as typeof fetch;

describe("song search (proxied iTunes Search API)", () => {
  it("returns metadata only, with art upgraded to a larger rendition on Apple's CDN", async () => {
    const me = await makeActor();
    const out = await searchSongs(prisma, me, "heroes", new Date(), reply([track()]));
    expect(out).toEqual({ songs: [{ title: "Heroes", artist: "David Bowie", album: "Heroes", artUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music/a/b/300x300bb.jpg", sourceId: "1" }] });
  });

  it("sends nothing about the user upstream: only the term, a fixed country and limit, a short timeout, no credentials", async () => {
    const me = await makeActor();
    let seen: { url: URL; init: RequestInit } | null = null;
    const spy = (async (input: URL, init: RequestInit) => {
      seen = { url: input, init };
      return new Response(JSON.stringify({ results: [] }));
    }) as unknown as typeof fetch;
    await searchSongs(prisma, me, "  bowie  ", new Date(), spy);
    expect(seen!.url.origin + seen!.url.pathname).toBe(ITUNES_SEARCH_URL);
    expect([...seen!.url.searchParams.keys()].sort()).toEqual(["country", "entity", "limit", "media", "term"]);
    expect(seen!.url.searchParams.get("term")).toBe("bowie");
    expect(seen!.url.searchParams.get("limit")).toBe(String(SONG_RESULTS));
    expect(seen!.init.credentials).toBe("omit");
    expect(Object.keys(seen!.init.headers as object)).toEqual(["accept"]);
    expect(seen!.init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify([...seen!.url.searchParams, seen!.init.headers])).not.toContain(me.userId);
    expect(JSON.stringify([...seen!.url.searchParams, seen!.init.headers])).not.toContain(me.handle);
    expect(SONG_SEARCH_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });

  it("drops results with objectionable text, non-Apple art, or oversized fields", async () => {
    const me = await makeActor();
    const out = await searchSongs(prisma, me, "x1", new Date(), reply([
      track({ trackId: 1 }), track({ trackId: 2, trackName: "porn night" }), track({ trackId: 3, artistName: "f4gg0t" }),
      track({ trackId: 4, artworkUrl100: "https://evil.example/pixel.gif" }), track({ trackId: 5, trackName: "x".repeat(201) }),
    ]));
    expect(out.songs.map((s) => [s.sourceId, s.artUrl === null])).toEqual([["1", false], ["4", true]]);
  });

  it("needs a signed-in user and a sensible query, and counts against a per-user rate limit", async () => {
    const me = await makeActor();
    const f = reply([]);
    await expect(searchSongs(prisma, null, "bowie", new Date(), f)).rejects.toMatchObject({ status: 401 });
    await expect(searchSongs(prisma, me, "a", new Date(), f)).rejects.toThrow();
    await expect(searchSongs(prisma, me, "x".repeat(81), new Date(), f)).rejects.toThrow();
    await expect(searchSongs(prisma, me, undefined, new Date(), f)).rejects.toThrow();
    const t = new Date();
    for (let i = 0; i < RATE_LIMITS.song_search.max; i++) await prisma.rateEvent.create({ data: { userId: me.userId, kind: "song_search", createdAt: t } });
    await expect(searchSongs(prisma, me, "bowie", t, f)).rejects.toMatchObject({ status: 429 });
  });

  it("answers a clear error when Apple is slow, down or returns junk", async () => {
    const me = await makeActor();
    const down = (async () => new Response("nope", { status: 503 })) as typeof fetch;
    const throws = (async () => { throw new Error("timeout"); }) as typeof fetch;
    const junk = (async () => new Response(JSON.stringify({ results: [{ nonsense: true }] }))) as typeof fetch;
    await expect(searchSongs(prisma, me, "bowie", new Date(), down)).rejects.toMatchObject({ status: 503, code: "song_search_unavailable" });
    await expect(searchSongs(prisma, me, "bowie", new Date(), throws)).rejects.toMatchObject({ code: "song_search_unavailable" });
    await expect(searchSongs(prisma, me, "bowie", new Date(), junk)).rejects.toMatchObject({ status: 400 });
  });
});
