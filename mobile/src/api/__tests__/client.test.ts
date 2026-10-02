import { ApiError, BAD_RESPONSE_MESSAGE, createApi, errorText, OFFLINE_MESSAGE, onlyUnknownKeys, parseResponse } from "../client";
import { NearbyPlacesResponse, PlacesResponse } from "../contracts";

type Call = { url: string; init: RequestInit };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function setup(respond: (call: Call) => Response | Promise<Response>, token: string | null = "tok_abcdefghijklmnopqrstuvwxyz") {
  const calls: Call[] = [];
  const onInvalidToken = jest.fn();
  const api = createApi({
    baseUrl: "https://api.example.test/",
    getToken: () => token,
    onInvalidToken,
    fetch: (async (url: string, init: RequestInit) => {
      const call = { url, init };
      calls.push(call);
      return respond(call);
    }) as unknown as typeof fetch,
  });
  return { api, calls, onInvalidToken };
}

const place = {
  id: "v1", slug: "velvet", name: "Velvet", address: "1 Ave A", neighborhood: "East Village", lat: 40.72, lng: -73.98, geofenceMeters: 100, fromOsm: true,
};
const placesBody = { places: [place], attribution: { text: "© OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright", license: "ODbL-1.0" } };

describe("api client", () => {
  it("sends the bearer token and X-Client: ios, and parses the response", async () => {
    const { api, calls } = setup(() => jsonResponse(200, placesBody));
    const res = await api.places.list();
    expect(res.places[0].name).toBe("Velvet");
    expect(calls[0].url).toBe("https://api.example.test/api/places");
    const h = calls[0].init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer tok_abcdefghijklmnopqrstuvwxyz");
    expect(h["X-Client"]).toBe("ios");
    expect(h["Content-Type"]).toBeUndefined();
  });

  it("omits Authorization when signed out and sends JSON bodies", async () => {
    const { api, calls } = setup(
      () => jsonResponse(201, { token: "t".repeat(40), expiresAt: "2026-12-24T00:00:00.000Z", user: { id: "u1", handle: "sam", displayName: "Sam", role: "USER" } }),
      null,
    );
    await api.auth.login({ email: "sam@example.com", password: "pw" });
    const h = calls[0].init.headers as Record<string, string>;
    expect(h.Authorization).toBeUndefined();
    expect(h["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ email: "sam@example.com", password: "pw" });
  });

  it("surfaces the server's message and code unchanged (geofence 403)", async () => {
    const message = "You need to be within 100 m of this place to stamp it (you're 140 m away)";
    const { api } = setup(() => jsonResponse(403, { error: "forbidden", message }));
    const err = await api.stamps.get("s1").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: "forbidden", message });
    expect(err.isClientError).toBe(true);
  });

  it("surfaces cooldowns (429) with the server's message", async () => {
    const message = "You already stamped this place. Try again in 12 min.";
    const { api } = setup(() => jsonResponse(429, { error: "rate_limited", message }));
    await expect(api.stamps.get("s1")).rejects.toMatchObject({ code: "rate_limited", message });
  });

  it("calls onInvalidToken only for 401 invalid_token", async () => {
    const dead = setup(() => jsonResponse(401, { error: "invalid_token", message: "Your session has ended. Sign in again." }));
    await expect(dead.api.me.get()).rejects.toMatchObject({ code: "invalid_token" });
    expect(dead.onInvalidToken).toHaveBeenCalledTimes(1);

    const wrong = setup(() => jsonResponse(401, { error: "invalid_credentials", message: "Wrong email or password." }));
    await expect(wrong.api.auth.login({ email: "a@b.co", password: "x" })).rejects.toMatchObject({ code: "invalid_credentials" });
    expect(wrong.onInvalidToken).not.toHaveBeenCalled();
  });

  it("maps network failures to an offline error", async () => {
    const { api } = setup(() => {
      throw new TypeError("Network request failed");
    });
    await expect(api.places.list()).rejects.toMatchObject({ status: 0, code: "offline", message: OFFLINE_MESSAGE });
  });

  it("maps non-JSON errors and contract mismatches to a generic message", async () => {
    const gateway = setup(() => new Response("<html>502</html>", { status: 502 }));
    await expect(gateway.api.places.list()).rejects.toMatchObject({ status: 502, code: "bad_response", message: BAD_RESPONSE_MESSAGE });

    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const drift = setup(() => jsonResponse(200, { ...placesBody, places: [{ ...place, geofenceMeters: "wide" }] }));
    await expect(drift.api.places.list()).rejects.toMatchObject({ code: "bad_response" });
    spy.mockRestore();
  });

  it("encodes path segments and query strings", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { api, calls } = setup(() => jsonResponse(200, { users: [] }));
    await api.users.search("a b&c");
    expect(calls[0].url).toBe("https://api.example.test/api/users?q=a%20b%26c");
    await api.users.follow("x/y", true).catch(() => undefined);
    expect(calls[1].url).toBe("https://api.example.test/api/users/x%2Fy/follow");
    expect(calls[1].init.method).toBe("PUT");
    spy.mockRestore();
  });

  it("uses the right verbs for toggles", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { state: "following" }));
    await api.users.follow("sam", true);
    await api.users.follow("sam", false);
    expect(calls.map((c) => c.init.method)).toEqual(["PUT", "DELETE"]);
  });

  it("sends the position to nearby places as a query and nothing else", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { places: [] }));
    await api.places.nearby({ lat: 40.7265, lng: -73.9845 });
    expect(calls[0].url).toBe("https://api.example.test/api/places/nearby?lat=40.7265&lng=-73.9845");
    expect(calls[0].init.method).toBe("GET");
  });
});

describe("forward compatibility", () => {
  it("accepts responses whose only problem is a field this app doesn't know yet", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const withNewField = { ...placesBody, places: [{ ...place, newThing: 1 }], alsoNew: true };
    const parsed = parseResponse(PlacesResponse, withNewField, "/api/places");
    expect(parsed.places[0].name).toBe("Velvet");
    spy.mockRestore();
  });

  it("still accepts unknown keys inside a nested object", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const body = { places: [{ ...place, distanceM: 140, inside: false, extra: "x" }] };
    expect(parseResponse(NearbyPlacesResponse, body, "/nearby")).toMatchObject({ places: [{ distanceM: 140 }] });
    spy.mockRestore();
  });

  it("rejects missing or mistyped fields", () => {
    const r = PlacesResponse.safeParse({ ...placesBody, places: [{ ...place, geofenceMeters: "100" }] });
    expect(r.success).toBe(false);
    if (!r.success) expect(onlyUnknownKeys(r.error.issues)).toBe(false);
  });
});

describe("hardening", () => {
  it("times out hung requests", async () => {
    const onInvalidToken = jest.fn();
    const api = createApi({
      baseUrl: "https://api.example.test",
      getToken: () => null,
      onInvalidToken,
      timeoutMs: 20,
      fetch: ((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })) as unknown as typeof fetch,
    });
    await expect(api.places.list()).rejects.toMatchObject({ code: "timeout" });
  });

  it("still recognizes invalid_token when the error body gains a field", async () => {
    const { api, onInvalidToken } = setup(() => jsonResponse(401, { error: "invalid_token", message: "Sign in again.", requestId: "r1" }));
    await expect(api.me.get()).rejects.toMatchObject({ code: "invalid_token" });
    expect(onInvalidToken).toHaveBeenCalledWith("tok_abcdefghijklmnopqrstuvwxyz");
  });

  it("recognizes invalid_token from WWW-Authenticate when the body is unreadable", async () => {
    const { api, onInvalidToken } = setup(
      () => new Response("nope", { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="nostos", error="invalid_token"' } }),
    );
    await expect(api.me.get()).rejects.toMatchObject({ code: "invalid_token" });
    expect(onInvalidToken).toHaveBeenCalledTimes(1);
  });

  it("never reports a dead token for a request that sent none", async () => {
    const { api, onInvalidToken } = setup(() => jsonResponse(401, { error: "invalid_token", message: "x" }), null);
    await expect(api.places.list()).rejects.toMatchObject({ code: "invalid_token" });
    expect(onInvalidToken).not.toHaveBeenCalled();
  });

  it("uses its own sentence for 5xx even when the body is JSON", async () => {
    const { api } = setup(() => jsonResponse(500, { error: "internal", message: "PrismaClientKnownRequestError at line 3" }));
    await expect(api.places.list()).rejects.toMatchObject({ status: 500, message: BAD_RESPONSE_MESSAGE });
  });

  it("logout sends the token it is given, not the current one", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { ok: true }), "tok_current_current_current");
    await api.auth.logout("tok_previous_previous_previous");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok_previous_previous_previous");
  });
});

describe("errorText", () => {
  it("keeps server sentences written for people and replaces validation and 5xx text", () => {
    expect(errorText(new ApiError(429, "rate_limited", "Try again in 12 min."), "fallback")).toBe("Try again in 12 min.");
    expect(errorText(new ApiError(400, "invalid_input", "email: Invalid email"), "Check your email.")).toBe("Check your email.");
    expect(errorText(new ApiError(503, "bad_response", "x"), "fallback")).toBe("fallback");
    expect(errorText(new Error("boom"), "fallback")).toBe("fallback");
  });
});

describe("stamp and social endpoints", () => {
  const stamp = {
    id: "s1", photoUrl: "https://cdn.example.test/s1.jpg", caption: "hi", song: { title: "Heroes", artist: "David Bowie", artUrl: null, sourceId: "1" },
    createdAt: "2026-09-24T02:00:00.000Z", editedAt: null, place: { id: "v1", slug: "velvet", name: "Velvet", neighborhood: "East Village" },
    author: { handle: "sam", displayName: "Sam", avatarUrl: null, verified: false }, mine: false, likes: { count: 3, viewerLiked: false }, hidden: false, removed: false,
  };

  it("pages the feed and a passport grid with the server's opaque cursor, encoded", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { stamps: [], nextBefore: null }));
    await api.feed();
    await api.feed("2026-09-24T02:00:00.000Z_s1");
    await api.users.stamps("sam");
    await api.users.stamps("sam", "2026-09-24T02:00:00.000Z_s1");
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.example.test/api/feed",
      "https://api.example.test/api/feed?before=2026-09-24T02%3A00%3A00.000Z_s1",
      "https://api.example.test/api/users/sam/stamps",
      "https://api.example.test/api/users/sam/stamps?before=2026-09-24T02%3A00%3A00.000Z_s1",
    ]);
  });

  it("likes with PUT and unlikes with DELETE", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { liked: true, count: 4, viewerLiked: true }));
    await api.stamps.like("s1", true);
    await api.stamps.like("s1", false);
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ["PUT", "https://api.example.test/api/stamps/s1/like"],
      ["DELETE", "https://api.example.test/api/stamps/s1/like"],
    ]);
  });

  it("removes a stamp with POST /remove, never DELETE", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { removed: true }));
    await api.stamps.remove("s1");
    expect([calls[0].init.method, calls[0].url]).toEqual(["POST", "https://api.example.test/api/stamps/s1/remove"]);
  });

  it("edits only the fields it is given, and a null song removes it", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { stamp }));
    await api.stamps.edit("s1", { song: null });
    expect(calls[0].init.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ song: null });
  });

  it("parses a stamp with its author, song and place", async () => {
    const { api } = setup(() => jsonResponse(200, { stamp }));
    const res = await api.stamps.get("s1");
    expect(res.stamp.author).toEqual({ handle: "sam", displayName: "Sam", avatarUrl: null, verified: false });
    expect(res.stamp.song?.title).toBe("Heroes");
    expect(res.stamp.place.slug).toBe("velvet");
  });

  it("searches songs with an encoded query", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { songs: [{ title: "Heroes", artist: "David Bowie", album: null, artUrl: null, sourceId: "1" }] }));
    const res = await api.songs.search("david & bowie");
    expect(calls[0].url).toBe("https://api.example.test/api/songs/search?q=david%20%26%20bowie");
    expect(res.songs[0].sourceId).toBe("1");
  });

  it("decides a follow request and approves all", async () => {
    const { api, calls } = setup((c) => jsonResponse(200, c.url.endsWith("approve-all") ? { approved: 4 } : { approved: true }));
    await api.me.decideRequest("sam", false);
    await api.me.approveAllRequests();
    expect(calls[0].url).toBe("https://api.example.test/api/me/follow-requests/sam");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ approve: false });
    expect([calls[1].init.method, calls[1].url]).toEqual(["POST", "https://api.example.test/api/me/follow-requests/approve-all"]);
  });

  it("surfaces 403 private_account on a follower list and on a stamps grid", async () => {
    const { api } = setup(() => jsonResponse(403, { error: "private_account", message: "This account is private." }));
    await expect(api.users.people("sam", "followers")).rejects.toMatchObject({ status: 403, code: "private_account" });
    await expect(api.users.stamps("sam")).rejects.toMatchObject({ status: 403, code: "private_account" });
  });
});
