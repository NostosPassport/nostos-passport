/**
 * Song search for the stamp composer. v1 stores metadata only (title, artist, art URL); there is no audio.
 * Proxied to Apple's public iTunes Search API through our backend so the phone never talks to Apple, with a short
 * timeout, a per-user rate limit, and no user identifiers sent upstream: only the search term, a fixed country and a
 * fixed limit. The terms-of-use question for this API is in OPEN-QUESTIONS.md (L1); nothing here decides it.
 */
import { z } from "zod";
import type { Db } from "@/lib/db";
import { containsObjectionable } from "@/lib/content-filter";
import type { Actor } from "@/server/actor";
import { badRequest, ServiceError } from "@/server/errors";
import { requireSignedIn } from "@/server/permissions";
import { consumeRate } from "@/server/rate-limit";

export const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";
export const SONG_SEARCH_TIMEOUT_MS = 3000;
export const SONG_RESULTS = 15;

export type SongResult = { title: string; artist: string; album: string | null; artUrl: string | null; sourceId: string };

const itunesResponse = z.object({
  results: z.array(
    z.object({
      trackId: z.number(),
      trackName: z.string(),
      artistName: z.string(),
      collectionName: z.string().optional(),
      artworkUrl100: z.string().optional(),
    }).passthrough(),
  ),
});

/** Apple's art URLs end in `100x100bb.jpg`; ask for a larger rendition. Only https links on Apple's CDN are kept. */
function artFrom(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !/(^|\.)mzstatic\.com$/.test(u.hostname)) return null;
    return u.toString().replace(/\/\d+x\d+bb\./, "/300x300bb.");
  } catch {
    return null;
  }
}

export const songQuerySchema = z.string().trim().min(2, "Type at least 2 characters").max(80, "Search is limited to 80 characters");

export async function searchSongs(db: Db, actor: Actor | null, rawQuery: unknown, now = new Date(), fetchImpl: typeof fetch = fetch): Promise<{ songs: SongResult[] }> {
  const me = requireSignedIn(actor);
  const term = songQuerySchema.parse(rawQuery ?? "");
  await db.$transaction((tx) => consumeRate(tx, me.userId, "song_search", now));

  const url = new URL(ITUNES_SEARCH_URL);
  url.searchParams.set("term", term);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("country", "US");
  url.searchParams.set("limit", String(SONG_RESULTS));
  let body: unknown;
  try {
    // No cookies, no auth header, no user id: the request carries only the search term.
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(SONG_SEARCH_TIMEOUT_MS), headers: { accept: "application/json" }, credentials: "omit", redirect: "error" });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    body = await res.json();
  } catch {
    throw new ServiceError(503, "song_search_unavailable", "Song search isn't available right now. Try again in a moment.");
  }
  const parsed = itunesResponse.safeParse(body);
  if (!parsed.success) throw badRequest("Song search returned something unexpected", "song_search_bad_response");
  const songs = parsed.data.results
    .filter((r) => r.trackName.length <= 200 && r.artistName.length <= 200 && !containsObjectionable(r.trackName) && !containsObjectionable(r.artistName))
    .map((r) => ({ title: r.trackName, artist: r.artistName, album: r.collectionName ?? null, artUrl: artFrom(r.artworkUrl100), sourceId: String(r.trackId) }));
  return { songs };
}
