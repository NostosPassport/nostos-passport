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
  id: "v1",
  slug: "velvet",
  name: "Velvet",
  address: "1 Ave A",
  area: "East Village",
  city: "New York",
  region: "New York",
  country: "United States",
  countryCode: "US",
  timeZone: "America/New_York",
  lat: 40.72,
  lng: -73.98,
  geofenceMeters: 100,
  fromOsm: true,
  googlePlaceId: null,
  category: "bar" as const,
  cuisines: [],
  primaryType: "bar",
  businessStatus: null,
};
const placesBody = {
  places: [place],
  attribution: { text: "© OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright", license: "ODbL-1.0" },
};
const stamp = {
  id: "s1",
  photoUrl: "https://cdn.example.test/s1.jpg",
  page: 1,
  slot: 1,
  photos: [{ id: "ph1", url: "https://cdn.example.test/s1.jpg", position: 0, x: null, y: null, rotation: null }],
  caption: "hi",
  song: { title: "Heroes", artist: "David Bowie", artUrl: null, sourceId: "1" },
  createdAt: "2026-10-08T20:00:00.000Z",
  visitedAt: "2026-09-24T02:00:00.000Z",
  verifiedAt: "2026-09-24T02:00:00.000Z",
  verified: true,
  editedAt: null,
  place: { id: "v1", slug: "velvet", name: "Velvet", area: "East Village", city: "New York", region: "New York", country: "United States", countryCode: "US", timeZone: "America/New_York" },
};

describe("api client", () => {
  it("sends bearer auth and X-Client: ios and parses current responses", async () => {
    const { api, calls } = setup(() => jsonResponse(200, placesBody));
    const res = await api.places.list();
    expect(res.places[0].name).toBe("Velvet");
    expect(res.places[0].city).toBe("New York");
    expect(calls[0].url).toBe("https://api.example.test/api/places");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok_abcdefghijklmnopqrstuvwxyz");
    expect(headers["X-Client"]).toBe("ios");
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("omits Authorization when signed out and sends JSON bodies", async () => {
    const { api, calls } = setup(
      () => jsonResponse(200, { token: "t".repeat(40), expiresAt: "2026-12-24T00:00:00.000Z", user: { id: "u1", handle: "sam", displayName: "Sam" } }),
      null,
    );
    const body = { challengeId: "11111111-1111-4111-8111-111111111111", code: "123456" };
    await api.auth.login(body);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(calls[0].init.body))).toEqual(body);
  });

  it("surfaces server error messages and codes", async () => {
    const message = "That visit date is outside the allowed range.";
    const { api } = setup(() => jsonResponse(400, { error: "bad_request", message }));
    const err = await api.stamps.get("s1").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: "bad_request", message });
    expect(err.isClientError).toBe(true);
  });

  it("calls onInvalidToken only for a request that sent a dead token", async () => {
    const dead = setup(() => jsonResponse(401, { error: "invalid_token", message: "Your session has ended. Sign in again." }));
    await expect(dead.api.me.get()).rejects.toMatchObject({ code: "invalid_token" });
    expect(dead.onInvalidToken).toHaveBeenCalledTimes(1);

    const signedOut = setup(() => jsonResponse(401, { error: "invalid_token", message: "x" }), null);
    await expect(signedOut.api.places.list()).rejects.toMatchObject({ code: "invalid_token" });
    expect(signedOut.onInvalidToken).not.toHaveBeenCalled();
  });

  it("maps network failures to offline and hung requests to timeout", async () => {
    const offline = setup(() => { throw new TypeError("Network request failed"); });
    await expect(offline.api.places.list()).rejects.toMatchObject({ status: 0, code: "offline", message: OFFLINE_MESSAGE });

    const api = createApi({
      baseUrl: "https://api.example.test",
      getToken: () => null,
      onInvalidToken: jest.fn(),
      timeoutMs: 20,
      fetch: ((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch,
    });
    await expect(api.places.list()).rejects.toMatchObject({ code: "timeout" });
  });

  it("maps non-JSON server errors and schema mismatches to a generic response error", async () => {
    const gateway = setup(() => new Response("<html>502</html>", { status: 502 }));
    await expect(gateway.api.places.list()).rejects.toMatchObject({ status: 502, code: "bad_response", message: BAD_RESPONSE_MESSAGE });

    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const drift = setup(() => jsonResponse(200, { ...placesBody, places: [{ ...place, geofenceMeters: "wide" }] }));
    await expect(drift.api.places.list()).rejects.toMatchObject({ code: "bad_response" });
    spy.mockRestore();
  });

  it("encodes current path segments and query strings", async () => {
    const { api, calls } = setup((call) => {
      if (call.url.includes("/users/")) return jsonResponse(200, { stamps: [], nextAfter: null });
      if (call.url.includes("/songs/")) return jsonResponse(200, { songs: [] });
      return jsonResponse(200, { place });
    });
    await api.places.get("x/y");
    await api.users.stamps("a/b", "2026-09-24T02:00:00.000Z_s1");
    await api.songs.search("david & bowie");
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.example.test/api/places/x%2Fy",
      "https://api.example.test/api/users/a%2Fb/stamps?after=2026-09-24T02%3A00%3A00.000Z_s1",
      "https://api.example.test/api/songs/search?q=david%20%26%20bowie",
    ]);
  });

  it("sends nearby position and Google search radius only as a query", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { places: [] }));
    await api.places.nearby({ lat: 40.7265, lng: -73.9845 });
    expect(calls[0].url).toBe("https://api.example.test/api/places/nearby?lat=40.7265&lng=-73.9845&radius=750");
    expect(calls[0].init.method).toBe("GET");
  });

  it("logout sends the explicitly supplied token", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { ok: true }), "tok_current_current_current");
    await api.auth.logout("tok_previous_previous_previous");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok_previous_previous_previous");
  });
});

describe("stamp endpoints", () => {
  it("parses visit chronology, locality, time zone and verification in the owner-only stamp shape", async () => {
    const { api } = setup(() => jsonResponse(200, { stamp }));
    const res = await api.stamps.get("s1");
    expect(res.stamp.song?.title).toBe("Heroes");
    expect(res.stamp.place.slug).toBe("velvet");
    expect(res.stamp.place.area).toBe("East Village");
    expect(res.stamp.place.timeZone).toBe("America/New_York");
    expect(res.stamp.visitedAt).toBe("2026-09-24T02:00:00.000Z");
    expect(res.stamp.verified).toBe(true);
    expect(res.stamp.verifiedAt).toBe("2026-09-24T02:00:00.000Z");
    expect(res.stamp).not.toHaveProperty("author");
    expect(res.stamp).not.toHaveProperty("likes");
    expect(res.stamp).not.toHaveProperty("lat");
    expect(res.stamp).not.toHaveProperty("lng");
  });

  it("edits only supplied fields, including visit date, and removes stamps with POST /remove", async () => {
    const edit = setup(() => jsonResponse(200, { stamp }));
    await edit.api.stamps.edit("s1", { visitedAt: "2026-09-23T12:00:00.000Z" });
    expect(edit.calls[0].init.method).toBe("PATCH");
    expect(JSON.parse(String(edit.calls[0].init.body))).toEqual({ visitedAt: "2026-09-23T12:00:00.000Z" });

    const remove = setup(() => jsonResponse(200, { removed: true }));
    await remove.api.stamps.remove("s1");
    expect([remove.calls[0].init.method, remove.calls[0].url]).toEqual(["POST", "https://api.example.test/api/stamps/s1/remove"]);
  });

  it("pages the owner passport with the opaque visit-date after cursor", async () => {
    const { api, calls } = setup(() => jsonResponse(200, { stamps: [], nextAfter: null }));
    await api.users.stamps("sam");
    await api.users.stamps("sam", "2026-09-24T02:00:00.000Z_s1");
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.example.test/api/users/sam/stamps",
      "https://api.example.test/api/users/sam/stamps?after=2026-09-24T02%3A00%3A00.000Z_s1",
    ]);
  });
});

describe("forward compatibility", () => {
  it("accepts responses whose only problem is an unknown field", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const parsed = parseResponse(PlacesResponse, { ...placesBody, places: [{ ...place, newThing: 1 }], alsoNew: true }, "/api/places");
    expect(parsed.places[0].name).toBe("Velvet");
    spy.mockRestore();
  });

  it("accepts unknown nested keys but rejects missing or mistyped fields", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const body = { places: [{ ...place, distanceM: 140, inside: false, extra: "x" }] };
    expect(parseResponse(NearbyPlacesResponse, body, "/nearby")).toMatchObject({ places: [{ distanceM: 140 }] });
    spy.mockRestore();

    const bad = PlacesResponse.safeParse({ ...placesBody, places: [{ ...place, geofenceMeters: "100" }] });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(onlyUnknownKeys(bad.error.issues)).toBe(false);
  });
});

describe("hardening", () => {
  it("recognizes invalid_token from WWW-Authenticate when the body is unreadable", async () => {
    const { api, onInvalidToken } = setup(() => new Response("nope", { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="nostos", error="invalid_token"' } }));
    await expect(api.me.get()).rejects.toMatchObject({ code: "invalid_token" });
    expect(onInvalidToken).toHaveBeenCalledTimes(1);
  });

  it("uses its own sentence for 5xx even when the body is JSON", async () => {
    const { api } = setup(() => jsonResponse(500, { error: "internal", message: "PrismaClientKnownRequestError at line 3" }));
    await expect(api.places.list()).rejects.toMatchObject({ status: 500, message: BAD_RESPONSE_MESSAGE });
  });
});

describe("errorText", () => {
  it("keeps human server sentences and replaces validation and 5xx text", () => {
    expect(errorText(new ApiError(429, "rate_limited", "Try again in 12 min."), "fallback")).toBe("Try again in 12 min.");
    expect(errorText(new ApiError(400, "invalid_input", "email: Invalid email"), "Check your email.")).toBe("Check your email.");
    expect(errorText(new ApiError(503, "bad_response", "x"), "fallback")).toBe("fallback");
    expect(errorText(new Error("boom"), "fallback")).toBe("fallback");
  });
});
