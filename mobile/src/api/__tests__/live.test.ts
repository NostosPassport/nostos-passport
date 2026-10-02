/**
 * Live contract check: runs the app's client against a real backend and parses every response with
 * the app's copy of the contract. Opt-in (it writes to that backend's database):
 *
 *   NOSTOS_LIVE_API=http://localhost:3000 npx jest src/api/__tests__/live.test.ts
 *
 * Uses the dev seed accounts (password `lastcall-dev`), including the geofence-exempt @appreview.
 */
import { createApi, type Api } from "../client";

const BASE = process.env.NOSTOS_LIVE_API;
const PASSWORD = process.env.NOSTOS_LIVE_PASSWORD ?? "lastcall-dev";
const d = BASE ? describe : describe.skip;

async function signedIn(email: string): Promise<Api> {
  let token: string | null = null;
  const api = createApi({ baseUrl: BASE!, getToken: () => token, onInvalidToken: () => (token = null) });
  const res = await api.auth.login({ email, password: PASSWORD });
  token = res.token;
  return api;
}

d("live backend", () => {
  jest.setTimeout(60_000);
  // Surface contract mismatches loudly instead of the generic "Something went wrong".
  const errors: unknown[] = [];
  beforeAll(() => jest.spyOn(console, "error").mockImplementation((...a) => void errors.push(a)));
  afterAll(() => expect(errors).toEqual([]));

  it("public endpoints parse", async () => {
    const api = createApi({ baseUrl: BASE!, getToken: () => null, onInvalidToken: () => undefined });
    const { places, attribution } = await api.places.list();
    expect(places.length).toBeGreaterThan(0);
    expect(attribution === null || attribution.text === "© OpenStreetMap contributors").toBe(true);
    const one = await api.places.get(places[0]!.slug);
    expect(one.place.id).toBe(places[0]!.id);
    await api.users.search("ma");
  });

  it("a signed-in user: me, nearby places, feed, passport, lists, requests, activity", async () => {
    const api = await signedIn("appreview@lastcall.dev");
    const me = await api.me.get();
    expect(me.settings.geofenceExempt).toBe(true);
    const { places } = await api.places.list();
    const p = places[0]!;
    const near = await api.places.nearby({ lat: p.lat, lng: p.lng });
    expect(near.places[0]?.inside).toBe(true);
    await api.feed();
    await api.me.following();
    await api.me.blocks();
    await api.me.activity();
    await api.me.followRequests();
    const self = await api.users.get(me.user.handle);
    expect(self.relationship.isSelf).toBe(true);
    await api.users.stamps(me.user.handle);
    await api.users.places(me.user.handle);
  });

  it("moderator screens parse", async () => {
    const api = await signedIn("mod_morgan@lastcall.dev");
    await api.mod.queue();
    await api.mod.hidden();
    await api.mod.log();
  });

  it("social: a private passport is limited to a stranger, and the stamp lists are refused", async () => {
    const ava = await signedIn("avaa@lastcall.dev");
    const handle = (await ava.me.get()).user.handle;
    const own = await ava.users.get(handle);
    expect(own.access).toBe("full");
    const grid = await ava.users.stamps(handle);
    if (grid.nextAfter) await ava.users.stamps(handle, grid.nextAfter);
    if (grid.stamps[0]) expect((await ava.stamps.get(grid.stamps[0].id)).stamp.mine).toBe(true);

    // The seed keeps @avaa private, and @moth_hopeful follows no one.
    const stranger = await signedIn("moth_hopeful@lastcall.dev");
    const limited = await stranger.users.get(handle);
    expect(limited.access).toBe("limited");
    await expect(stranger.users.people(handle, "followers")).rejects.toMatchObject({ status: 403, code: "private_account" });
    await expect(stranger.users.stamps(handle)).rejects.toMatchObject({ status: 403, code: "private_account" });
    await expect(stranger.users.places(handle)).rejects.toMatchObject({ status: 403, code: "private_account" });
    if (grid.stamps[0]) await expect(stranger.stamps.get(grid.stamps[0].id)).rejects.toMatchObject({ status: 404 });
  });

  it("a dead token is reported as invalid_token", async () => {
    let cleared = false;
    const api = createApi({ baseUrl: BASE!, getToken: () => "x".repeat(40), onInvalidToken: () => (cleared = true) });
    await expect(api.me.get()).rejects.toMatchObject({ status: 401, code: "invalid_token" });
    expect(cleared).toBe(true);
  });
});
