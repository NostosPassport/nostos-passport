/**
 * Live contract check against a local seeded backend. Opt-in because it uses development accounts:
 *
 *   NOSTOS_LIVE_API=http://localhost:3001 npx jest src/api/__tests__/live.test.ts
 */
import { TokenResponse } from "../contracts";
import { createApi, type Api } from "../client";

const BASE = process.env.NOSTOS_LIVE_API;
const PASSWORD = process.env.NOSTOS_LIVE_PASSWORD ?? "lastcall-dev";
const d = BASE ? describe : describe.skip;

async function signedIn(email: string): Promise<Api> {
  let token: string | null = null;
  const response = await fetch(`${BASE!}/api/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Client": "ios" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`Dev login failed (${response.status}): ${await response.text()}`);
  const parsed = TokenResponse.parse(await response.json());
  token = parsed.token;
  return createApi({ baseUrl: BASE!, getToken: () => token, onInvalidToken: () => (token = null) });
}

d("live backend", () => {
  jest.setTimeout(60_000);
  const errors: unknown[] = [];
  beforeAll(() => jest.spyOn(console, "error").mockImplementation((...args) => void errors.push(args)));
  afterAll(() => expect(errors).toEqual([]));

  it("public place endpoints parse", async () => {
    const api = createApi({ baseUrl: BASE!, getToken: () => null, onInvalidToken: () => undefined });
    const { places, attribution } = await api.places.list();
    expect(places.length).toBeGreaterThan(0);
    expect(attribution === null || attribution.text === "© OpenStreetMap contributors").toBe(true);
    const one = await api.places.get(places[0]!.slug);
    expect(one.place.id).toBe(places[0]!.id);
  });

  it("a signed-in owner can parse all owner surfaces", async () => {
    const api = await signedIn("appreview@lastcall.dev");
    const me = await api.me.get();
    expect(me.settings.geofenceExempt).toBe(true);

    const { places } = await api.places.list();
    const place = places[0]!;
    const near = await api.places.nearby({ lat: place.lat, lng: place.lng });
    expect(near.places[0]?.inside).toBe(true);

    await api.me.profile();
    await api.pins.get();
    await api.neighborhoods();
    const grid = await api.users.stamps(me.user.handle);
    await api.users.places(me.user.handle);
    await api.places.mine(place.id, { lat: place.lat, lng: place.lng });
    if (grid.nextAfter) await api.users.stamps(me.user.handle, grid.nextAfter);
    if (grid.stamps[0]) await api.stamps.get(grid.stamps[0].id);
  });

  it("another signed-in account cannot read an owner's passport or stamp", async () => {
    const owner = await signedIn("avaa@lastcall.dev");
    const ownerHandle = (await owner.me.get()).user.handle;
    const grid = await owner.users.stamps(ownerHandle);

    const other = await signedIn("maya_r@lastcall.dev");
    await expect(other.users.stamps(ownerHandle)).rejects.toMatchObject({ status: 404 });
    await expect(other.users.places(ownerHandle)).rejects.toMatchObject({ status: 404 });
    if (grid.stamps[0]) await expect(other.stamps.get(grid.stamps[0].id)).rejects.toMatchObject({ status: 404 });
  });

  it("reports a dead token as invalid_token", async () => {
    let cleared = false;
    const api = createApi({ baseUrl: BASE!, getToken: () => "x".repeat(40), onInvalidToken: () => (cleared = true) });
    await expect(api.me.get()).rejects.toMatchObject({ status: 401, code: "invalid_token" });
    expect(cleared).toBe(true);
  });
});
