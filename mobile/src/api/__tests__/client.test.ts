import { ApiError, BAD_RESPONSE_MESSAGE, createApi, errorText, OFFLINE_MESSAGE, onlyUnknownKeys, parseResponse } from "../client";
import { PresenceResponse, VenuesResponse } from "../contracts";

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

const venue = {
  id: "v1", slug: "velvet", name: "Velvet", address: "1 Ave A", neighborhood: "East Village", lat: 40.72, lng: -73.98,
  vibe: "PACKED", vibeReports: 5, hereNow: 4, goingTonight: 18, friendsGoing: 1, activity: 13, promoted: false, fromOsm: true,
};
const venuesBody = { venues: [venue], attribution: { text: "© OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright", license: "ODbL-1.0" }, at: "2026-09-24T02:00:00.000Z" };

describe("api client", () => {
  it("sends the bearer token and X-Client: ios, and parses the response", async () => {
    const { api, calls } = setup(() => jsonResponse(200, venuesBody));
    const res = await api.venues.list();
    expect(res.venues[0].name).toBe("Velvet");
    expect(calls[0].url).toBe("https://api.example.test/api/venues");
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
    const message = "You need to be within 100m of the venue to post (you're 140m away)";
    const { api } = setup(() => jsonResponse(403, { error: "forbidden", message }));
    const err = await api.venues.report("v1", { type: "VIBE", vibe: "PACKED", lat: 40.7, lng: -73.9 }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: "forbidden", message });
    expect(err.isClientError).toBe(true);
  });

  it("surfaces cooldowns (429) with the server's message", async () => {
    const message = "You already posted a vibe update here. Try again in 12 min.";
    const { api } = setup(() => jsonResponse(429, { error: "rate_limited", message }));
    await expect(api.venues.report("v1", { type: "VIBE", vibe: "BUSY", lat: 0, lng: 0 })).rejects.toMatchObject({ code: "rate_limited", message });
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
    await expect(api.venues.list()).rejects.toMatchObject({ status: 0, code: "offline", message: OFFLINE_MESSAGE });
  });

  it("maps non-JSON errors and contract mismatches to a generic message", async () => {
    const gateway = setup(() => new Response("<html>502</html>", { status: 502 }));
    await expect(gateway.api.venues.list()).rejects.toMatchObject({ status: 502, code: "bad_response", message: BAD_RESPONSE_MESSAGE });

    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const drift = setup(() => jsonResponse(200, { ...venuesBody, venues: [{ ...venue, vibe: "ON_FIRE" }] }));
    await expect(drift.api.venues.list()).rejects.toMatchObject({ code: "bad_response" });
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
    const { api, calls } = setup(() => jsonResponse(200, { going: false, night: "2026-09-23", goingTonight: 3 }));
    await api.venues.rsvp("v1", true);
    await api.venues.rsvp("v1", false);
    expect(calls.map((c) => c.init.method)).toEqual(["PUT", "DELETE"]);
  });
});

describe("forward compatibility", () => {
  it("accepts responses whose only problem is a field this app doesn't know yet", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const withNewField = { ...venuesBody, venues: [{ ...venue, newThing: 1 }], alsoNew: true };
    const parsed = parseResponse(VenuesResponse, withNewField, "/api/venues");
    expect(parsed.venues[0].name).toBe("Velvet");
    spy.mockRestore();
  });

  it("still accepts unknown keys inside a union branch", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const body = { here: false, reason: "outside", distanceM: 140, radiusM: 100, extra: "x" };
    expect(parseResponse(PresenceResponse, body, "/presence")).toMatchObject({ here: false, distanceM: 140 });
    spy.mockRestore();
  });

  it("rejects missing or mistyped fields", () => {
    const r = VenuesResponse.safeParse({ ...venuesBody, venues: [{ ...venue, hereNow: "4" }] });
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
    await expect(api.venues.list()).rejects.toMatchObject({ code: "timeout" });
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
    await expect(api.venues.list()).rejects.toMatchObject({ code: "invalid_token" });
    expect(onInvalidToken).not.toHaveBeenCalled();
  });

  it("uses its own sentence for 5xx even when the body is JSON", async () => {
    const { api } = setup(() => jsonResponse(500, { error: "internal", message: "PrismaClientKnownRequestError at line 3" }));
    await expect(api.venues.list()).rejects.toMatchObject({ status: 500, message: BAD_RESPONSE_MESSAGE });
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

describe("social endpoints", () => {
  const post = {
    id: "p1", url: "https://cdn.example.test/p1.jpg", rating: 8, caption: "", shared: true, createdAt: "2026-09-24T02:00:00.000Z", editedAt: null,
    author: { kind: "anonymous" }, venue: { name: "Velvet", slug: "velvet" }, mine: false, ratingEditableUntil: null, likes: { count: 3, viewerLiked: false },
  };

  it("pages a profile grid with the server's opaque cursor, encoded", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { posts: [], nextBefore: null }));
    await api.users.posts("sam");
    await api.users.posts("sam", "2026-09-24T02:00:00.000Z_p1");
    expect(calls[0].url).toBe("https://api.example.test/api/users/sam/posts");
    expect(calls[1].url).toBe("https://api.example.test/api/users/sam/posts?before=2026-09-24T02%3A00%3A00.000Z_p1");
  });

  it("likes with PUT and unlikes with DELETE", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { liked: true, count: 4, viewerLiked: true }));
    await api.posts.like("p1", true);
    await api.posts.like("p1", false);
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ["PUT", "https://api.example.test/api/posts/p1/like"],
      ["DELETE", "https://api.example.test/api/posts/p1/like"],
    ]);
  });

  it("removes a post with POST /remove, never DELETE", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { removed: true }));
    await api.posts.remove("p1");
    expect([calls[0].init.method, calls[0].url]).toEqual(["POST", "https://api.example.test/api/posts/p1/remove"]);
  });

  it("parses a post with an Anonymous author", async () => {
    const { api } = setup(() => jsonResponse(200, { post }));
    const res = await api.posts.get("p1");
    expect(res.post.author).toEqual({ kind: "anonymous" });
  });

  it("decides a follow request and approves all", async () => {
    const { api, calls } = setup((c) => jsonResponse(200, c.url.endsWith("approve-all") ? { approved: 4 } : { approved: true }));
    await api.me.decideRequest("sam", false);
    await api.me.approveAllRequests();
    expect(calls[0].url).toBe("https://api.example.test/api/me/follow-requests/sam");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ approve: false });
    expect([calls[1].init.method, calls[1].url]).toEqual(["POST", "https://api.example.test/api/me/follow-requests/approve-all"]);
  });

  it("asks for a featured month only when one is given", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { month: "2026-08", nights: [] }));
    await api.venues.featured("v1");
    await api.venues.featured("v1", "2026-08");
    expect(calls.map((c) => c.url)).toEqual(["https://api.example.test/api/venues/v1/featured", "https://api.example.test/api/venues/v1/featured?month=2026-08"]);
  });

  it("surfaces 403 private_account on a follower list", async () => {
    const { api } = setup(() => jsonResponse(403, { error: "private_account", message: "This account is private." }));
    await expect(api.users.people("sam", "followers")).rejects.toMatchObject({ status: 403, code: "private_account" });
  });
});
