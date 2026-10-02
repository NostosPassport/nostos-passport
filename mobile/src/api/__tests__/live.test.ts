/**
 * Live contract check: runs the app's client against a real backend and parses every response with
 * the app's copy of the contract. Opt-in (it writes to that backend's database):
 *
 *   NOSTOS_LIVE_API=http://localhost:3000 npx jest src/api/__tests__/live.test.ts
 *
 * Uses the dev seed accounts (password `lastcall-dev`), including the geofence-exempt @appreview.
 */
import { toNyLocal } from "@/lib/ny-time";

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
    const { venues, attribution } = await api.venues.list();
    expect(venues.length).toBeGreaterThan(0);
    expect(attribution === null || attribution.text === "© OpenStreetMap contributors").toBe(true);
    const page = await api.venues.get(venues[0].slug);
    expect(page.official.id).toBe(venues[0].id);
    expect(page.viewer).toEqual({ going: false, hereNow: false, ownsVenue: false });
    await api.users.search("ma");
  });

  it("a signed-in user: me, venue, presence, report, rsvp, comment, people", async () => {
    const api = await signedIn("appreview@lastcall.dev");
    const me = await api.me.get();
    expect(me.settings.geofenceExempt).toBe(true);
    const { venues } = await api.venues.list();
    const v = venues[0];
    const page = await api.venues.get(v.id);

    const presence = await api.venues.presence(v.id, { lat: v.lat, lng: v.lng });
    expect(typeof presence.distanceM).toBe("number");

    const report = await api.venues.report(v.id, { type: "VIBE", vibe: "BUSY", lat: v.lat, lng: v.lng }).catch((e) => e);
    // A second run within 15 minutes hits the cooldown: that's a well-formed 429.
    if (report instanceof Error) expect(report).toMatchObject({ status: 429, code: "rate_limited" });
    else expect(report.report.type).toBe("VIBE");

    const going = await api.venues.rsvp(v.id, !page.viewer.going);
    expect(going.going).toBe(!page.viewer.going);
    await api.venues.rsvp(v.id, page.viewer.going);

    const c = await api.venues.comment(v.id, "Live contract check").catch((e) => e);
    if (c instanceof Error) expect(c).toMatchObject({ status: 429 });

    await api.me.following();
    await api.me.blocks();
    const self = await api.users.get(me.user.handle);
    expect(self.relationship.isSelf).toBe(true);
    await api.owner.overview();
  });

  it("an owner's dashboard parses, and owner edits and promos round-trip", async () => {
    const api = await signedIn("owner_velvet@lastcall.dev");
    const me = await api.me.get();
    expect(me.ownedVenues.length).toBeGreaterThan(0);
    const venueId = me.ownedVenues[0].id;
    const dash = await api.owner.dashboard(venueId);
    expect(dash.page.viewer.ownsVenue).toBe(true);

    const before = dash.venue.dressCode ?? "";
    await api.owner.updateInfo(venueId, { dressCode: "Live check" });
    await api.owner.updateInfo(venueId, { dressCode: before });

    // Promo times use the app's New York formatting.
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const { promo } = await api.owner.createPromo(venueId, { title: "Live check", body: "Contract test promo", startsAt: toNyLocal(start), endsAt: toNyLocal(end) });
    expect(Math.abs(Date.parse(promo.startsAt) - start.getTime())).toBeLessThan(60_000);
    await api.owner.endPromo(promo.id);
  });

  it("moderator screens parse", async () => {
    const api = await signedIn("mod_morgan@lastcall.dev");
    await api.mod.queue();
    await api.mod.hidden();
    await api.mod.log();
  });

  it("social: profiles, grid, places, lists, requests, activity, posts, likes, featured galleries", async () => {
    const ava = await signedIn("avaa@lastcall.dev");
    const me = await ava.me.get();
    const handle = me.user.handle;
    await ava.me.profile();
    const own = await ava.users.get(handle);
    expect(own.access).toBe("full");
    const grid = await ava.users.posts(handle);
    if (grid.nextBefore) await ava.users.posts(handle, grid.nextBefore);
    await ava.users.places(handle);
    await ava.users.people(handle, "followers");
    await ava.users.people(handle, "following");
    await ava.me.followRequests();
    await ava.me.activity();
    const post = grid.posts[0] ? await ava.posts.get(grid.posts[0].id) : null;
    if (post) expect(post.post.mine).toBe(true);

    // Someone else's view of a private account they don't follow: the limited shape, and lists refused.
    const stranger = await signedIn("moth_hopeful@lastcall.dev");
    // The seed keeps @avaa private, and @moth_hopeful follows no one.
    const limited = await stranger.users.get(handle);
    expect(limited.access).toBe("limited");
    await expect(stranger.users.people(handle, "followers")).rejects.toMatchObject({ status: 403, code: "private_account" });

    // A venue page with featured photos, its month gallery and a like round-trip on a shared post.
    const { venues } = await stranger.venues.list();
    for (const v of venues) {
      const page = await stranger.venues.get(v.slug);
      const month = page.featured.archive[0]?.month;
      if (!month) continue;
      await stranger.venues.featured(page.official.id, month);
      const target = [...page.live.livePhotos, ...page.featured.thisMonth.photos].find((p) => p.likes && !p.mine);
      if (target?.likes) {
        const before = target.likes.viewerLiked;
        try {
          const liked = await stranger.posts.like(target.id, !before);
          expect(liked.viewerLiked).toBe(!before);
        } finally {
          // Put it back even if the check failed, so reruns start from the seeded state.
          await stranger.posts.like(target.id, before);
        }
      }
      break;
    }
  });

  it("a dead token is reported as invalid_token", async () => {
    let cleared = false;
    const api = createApi({ baseUrl: BASE!, getToken: () => "x".repeat(40), onInvalidToken: () => (cleared = true) });
    await expect(api.me.get()).rejects.toMatchObject({ status: 401, code: "invalid_token" });
    expect(cleared).toBe(true);
  });
});
