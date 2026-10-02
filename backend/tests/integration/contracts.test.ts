/**
 * Contract drift test: calls every API route the way the iOS app does (bearer tokens) against a realistic fixture
 * and parses each response with the strict schemas in src/contracts/api.ts. A second test scans src/app/api and
 * fails if any route handler is missing from the registry below, so new endpoints can't skip the contract.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ZodTypeAny } from "zod";
import * as C from "@/contracts/api";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { signup } from "@/server/services/auth";
import { importOsmVenues } from "@/server/services/osm-import";
import { installMemoryStorage } from "./mem-storage";
import { makeActor, makeUser, makeVenue, pngBytes, INSIDE, VENUE_POS } from "./factories";

import * as loginR from "@/app/api/auth/login/route";
import * as signupR from "@/app/api/auth/signup/route";
import * as logoutR from "@/app/api/auth/logout/route";
import * as logoutAllR from "@/app/api/auth/logout-all/route";
import * as meR from "@/app/api/me/route";
import * as meTermsR from "@/app/api/me/terms/route";
import * as meDeleteR from "@/app/api/me/delete/route";
import * as meBlocksR from "@/app/api/me/blocks/route";
import * as meFollowingR from "@/app/api/me/following/route";
import * as placesR from "@/app/api/places/route";
import * as placeR from "@/app/api/places/[id]/route";
import * as nearbyR from "@/app/api/places/nearby/route";
import * as placeMineR from "@/app/api/places/[id]/mine/route";
import * as placeStampsR from "@/app/api/places/[id]/stamps/route";
import * as stampR from "@/app/api/stamps/[id]/route";
import * as stampPhotosR from "@/app/api/stamps/[id]/photos/route";
import * as stampPhotoRemoveR from "@/app/api/stamps/[id]/photos/[photoId]/remove/route";
import * as neighborhoodsR from "@/app/api/me/neighborhoods/route";
import * as pinsR from "@/app/api/me/pins/route";
import * as stampLikeR from "@/app/api/stamps/[id]/like/route";
import * as stampRemoveR from "@/app/api/stamps/[id]/remove/route";
import * as feedR from "@/app/api/feed/route";
import * as songsR from "@/app/api/songs/search/route";
import * as usersR from "@/app/api/users/route";
import * as userR from "@/app/api/users/[handle]/route";
import * as followR from "@/app/api/users/[handle]/follow/route";
import * as blockR from "@/app/api/users/[handle]/block/route";
import * as followersR from "@/app/api/users/[handle]/followers/route";
import * as followingOfR from "@/app/api/users/[handle]/following/route";
import * as userStampsR from "@/app/api/users/[handle]/stamps/route";
import * as userPlacesR from "@/app/api/users/[handle]/places/route";
import * as meRequestsR from "@/app/api/me/follow-requests/route";
import * as meRequestR from "@/app/api/me/follow-requests/[handle]/route";
import * as meApproveAllR from "@/app/api/me/follow-requests/approve-all/route";
import * as meFollowerR from "@/app/api/me/followers/[handle]/route";
import * as meProfileR from "@/app/api/me/profile/route";
import * as meAvatarR from "@/app/api/me/avatar/route";
import * as activityR from "@/app/api/me/activity/route";
import * as flagsR from "@/app/api/flags/route";
import * as modQueueR from "@/app/api/mod/queue/route";
import * as modLogR from "@/app/api/mod/log/route";
import * as modActionsR from "@/app/api/mod/actions/route";
import * as modHiddenR from "@/app/api/mod/hidden/route";
import * as adminUserR from "@/app/api/admin/users/[handle]/route";
import * as adminUsersR from "@/app/api/admin/users/route";
import * as adminVerifyR from "@/app/api/admin/users/[handle]/verification/route";
import * as adminVerifyLogR from "@/app/api/admin/verification-log/route";
import * as healthR from "@/app/api/health/route";
import * as cronR from "@/app/api/cron/maintenance/route";

installMemoryStorage();

/** Every route handler and the schema its success response must satisfy. Binary routes are listed as "binary". */
const REGISTRY: Record<string, ZodTypeAny | "binary"> = {
  "POST /api/auth/login": C.TokenResponse,
  "POST /api/auth/signup": C.TokenResponse,
  "POST /api/auth/logout": C.OkResponse,
  "POST /api/auth/logout-all": C.LogoutAllResponse,
  "GET /api/me": C.MeResponse,
  "POST /api/me/terms": C.AcceptTermsResponse,
  "POST /api/me/delete": C.DeleteAccountResponse,
  "GET /api/me/blocks": C.BlocksResponse,
  "GET /api/me/following": C.FollowingResponse,
  "GET /api/places": C.PlacesResponse,
  "GET /api/places/[id]": C.PlaceResponse,
  "GET /api/places/nearby": C.NearbyPlacesResponse,
  "GET /api/places/[id]/mine": C.MyPlacePageResponse,
  "POST /api/places/[id]/stamps": C.CreateStampResponse,
  "GET /api/stamps/[id]": C.StampResponse,
  "PATCH /api/stamps/[id]": C.StampResponse,
  "POST /api/stamps/[id]/photos": C.ErrorResponse,
  "PATCH /api/stamps/[id]/photos": C.StampResponse,
  "POST /api/stamps/[id]/photos/[photoId]/remove": C.StampResponse,
  "GET /api/me/neighborhoods": C.NeighborhoodIndexResponse,
  "GET /api/me/pins": C.PinsResponse,
  "PUT /api/me/pins": C.PinsResponse,
  "PUT /api/stamps/[id]/like": C.LikeResponse,
  "DELETE /api/stamps/[id]/like": C.LikeResponse,
  "POST /api/stamps/[id]/remove": C.RemoveStampResponse,
  "GET /api/feed": C.FeedResponse,
  "GET /api/songs/search": C.SongSearchResponse,
  "GET /api/users": C.UserSearchResponse,
  "GET /api/users/[handle]": C.ProfileResponse,
  "PUT /api/users/[handle]/follow": C.FollowResponse,
  "DELETE /api/users/[handle]/follow": C.FollowResponse,
  "POST /api/users/[handle]/block": C.BlockResponse,
  "DELETE /api/users/[handle]/block": C.BlockResponse,
  "GET /api/users/[handle]/followers": C.PeopleListResponse,
  "GET /api/users/[handle]/following": C.PeopleListResponse,
  "GET /api/users/[handle]/stamps": C.UserStampsResponse,
  "GET /api/users/[handle]/places": C.UserPlacesResponse,
  "GET /api/me/follow-requests": C.FollowRequestsResponse,
  "POST /api/me/follow-requests/[handle]": C.FollowRequestDecisionResponse,
  "POST /api/me/follow-requests/approve-all": C.ApproveAllResponse,
  "DELETE /api/me/followers/[handle]": C.RemoveFollowerResponse,
  "GET /api/me/profile": C.ProfileSettingsResponse,
  "PATCH /api/me/profile": C.ProfileSettingsResponse,
  "POST /api/me/avatar": C.AvatarResponse,
  "DELETE /api/me/avatar": C.AvatarResponse,
  "GET /api/me/activity": C.ActivityResponse,
  "POST /api/flags": C.FlagResponse,
  "GET /api/mod/queue": C.ModQueueResponse,
  "GET /api/mod/log": C.ModLogResponse,
  "POST /api/mod/actions": C.ModActionResponse,
  "GET /api/mod/hidden": C.ModHiddenResponse,
  "PATCH /api/admin/users/[handle]": C.AdminUserFlagsResponse,
  "GET /api/admin/users": C.AdminUserSearchResponse,
  "POST /api/admin/users/[handle]/verification": C.VerificationResponse,
  "GET /api/admin/verification-log": C.VerificationLogResponse,
  "GET /api/health": C.HealthResponse,
  "GET /api/cron/maintenance": C.CronResponse,
  "POST /api/cron/maintenance": C.CronResponse,
  "GET /api/uploads/[...key]": "binary",
};

const checked = new Set<string>();
type Handler = (req: Request, ctx: never) => Promise<Response>;

async function call(
  key: keyof typeof REGISTRY & string,
  handler: Handler,
  opts: { token?: string; body?: unknown; form?: FormData; params?: Record<string, string>; query?: string; headers?: Record<string, string>; status?: number } = {},
) {
  const [method, p] = key.split(" ") as [string, string];
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) {
    // Serialize once so the multipart boundary in Content-Type matches the bytes, and send Content-Length.
    const tmp = new Request("http://localhost", { method: "POST", body: opts.form });
    const bytes = await tmp.arrayBuffer();
    body = bytes;
    headers["content-type"] = tmp.headers.get("content-type")!;
    headers["content-length"] = String(bytes.byteLength);
  } else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await handler(new Request(`http://localhost${p}${opts.query ?? ""}`, { method, headers, body }), { params: Promise.resolve(opts.params ?? {}) } as never);
  const json = await res.json();
  expect(res.status, `${key} -> ${JSON.stringify(json).slice(0, 300)}`).toBe(opts.status ?? 200);
  const schema = REGISTRY[key];
  if (schema && schema !== "binary") {
    const parsed = schema.safeParse(json);
    expect(parsed.success, `${key} drifted from src/contracts/api.ts: ${parsed.success ? "" : JSON.stringify(parsed.error.issues).slice(0, 600)}`).toBe(true);
  }
  checked.add(key);
  return json;
}


const png = () => pngBytes(150);
const stampForm = (fields: Record<string, string>, photo = true) => {
  const form = new FormData();
  if (photo) form.set("photo", new Blob([new Uint8Array(png())], { type: "image/png" }), "p.png");
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
};

/** An iTunes Search API response, served to the songs route instead of calling Apple. */
const fakeItunes = async () =>
  new Response(JSON.stringify({ resultCount: 1, results: [{ trackId: 1440857781, trackName: "Contract Song", artistName: "The Schemas", collectionName: "Strict", artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/x/100x100bb.jpg" }] }), { headers: { "content-type": "application/json" } });

describe("API contract", () => {
  it("every route's response matches src/contracts/api.ts", async () => {
    // Fixture: an OSM place, people with follows, stamps with photo, caption and song, likes, flags.
    await importOsmVenues(prisma, [{ type: "node", id: 42, lat: VENUE_POS.lat, lon: VENUE_POS.lng, tags: { amenity: "bar", name: "Contract Bar", "addr:housenumber": "1", "addr:street": "Avenue A" } }]);
    const place = await prisma.venue.findUniqueOrThrow({ where: { osmId: "node/42" } });
    const mod = await makeActor({ role: "MODERATOR" });
    const admin = await makeActor({ role: "ADMIN" });
    const friend = await makeActor();
    const tok = async (userId: string) => (await createSession(prisma, userId, { client: "IOS" })).token;
    const [modT, adminT, friendT] = await Promise.all([tok(mod.userId), tok(admin.userId), tok(friend.userId)]);

    // Auth (iOS)
    const su = await call("POST /api/auth/signup", signupR.POST, {
      headers: { "x-client": "ios" }, status: 201,
      body: { email: "app@x.dev", password: "long enough pw", displayName: "App User", handle: "app_user", acceptTerms: true, birthdate: "1990-05-05" },
    });
    const li = await call("POST /api/auth/login", loginR.POST, { headers: { "x-client": "ios" }, body: { email: "app@x.dev", password: "long enough pw" } });
    const me = li.token as string;
    void su;
    const meBody = await call("GET /api/me", meR.GET, { token: me });
    await call("POST /api/me/terms", meTermsR.POST, { token: me, body: { version: meBody.terms.currentVersion } });

    // Places and stamps
    const pid = place.id;
    await call("GET /api/places", placesR.GET, { token: me });
    await call("GET /api/places/[id]", placeR.GET, { token: me, params: { id: place.slug } });
    const near = await call("GET /api/places/nearby", nearbyR.GET, { token: me, query: `?lat=${INSIDE.lat}&lng=${INSIDE.lng}` });
    expect(near.places[0]).toMatchObject({ slug: place.slug, inside: true });
    const full = await call("POST /api/places/[id]/stamps", placeStampsR.POST, {
      token: me, params: { id: pid }, status: 201,
      form: stampForm({ caption: "dance floor", lat: String(INSIDE.lat), lng: String(INSIDE.lng), songTitle: "Contract Song", songArtist: "The Schemas", songArtUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music/x/300x300bb.jpg", songSourceId: "1440857781" }),
    });
    expect(full.stamp).toMatchObject({ caption: "dance floor", song: { title: "Contract Song" }, mine: true });
    // Caption only, song only and photo only are stamps too (each at its own place: one stamp per place per 15 minutes).
    const p2 = await makeVenue({ slug: "p2" });
    const p3 = await makeVenue({ slug: "p3" });
    const p4 = await makeVenue({ slug: "p4" });
    const captionOnly = await call("POST /api/places/[id]/stamps", placeStampsR.POST, { token: friendT, params: { id: p2.id }, status: 201, form: stampForm({ caption: "just words", lat: String(INSIDE.lat), lng: String(INSIDE.lng) }, false) });
    expect(captionOnly.stamp).toMatchObject({ photoUrl: null, song: null });
    await call("POST /api/places/[id]/stamps", placeStampsR.POST, { token: friendT, params: { id: p3.id }, status: 201, form: stampForm({ lat: String(INSIDE.lat), lng: String(INSIDE.lng), songTitle: "Only Song", songArtist: "Solo" }, false) });
    await call("POST /api/places/[id]/stamps", placeStampsR.POST, { token: friendT, params: { id: p4.id }, status: 201, form: stampForm({ lat: String(INSIDE.lat), lng: String(INSIDE.lng) }) });
    const stampId = full.stamp.id as string;
    const mine = await call("GET /api/places/[id]/mine", placeMineR.GET, { token: me, params: { id: place.slug }, query: `?lat=${INSIDE.lat}&lng=${INSIDE.lng}` });
    expect(mine).toMatchObject({ inside: true, visits: [{ stamps: [{ id: stampId }] }] });

    // Songs (proxied): the route calls Apple, so the contract test serves it a canned reply.
    const realFetch = globalThis.fetch;
    globalThis.fetch = fakeItunes as typeof fetch;
    try {
      const found = await call("GET /api/songs/search", songsR.GET, { token: me, query: "?q=contract" });
      expect(found.songs[0]).toMatchObject({ title: "Contract Song", sourceId: "1440857781" });
    } finally {
      globalThis.fetch = realFetch;
    }

    // People: both accounts are private, so follows start as requests.
    await call("GET /api/users", usersR.GET, { token: me, query: `?q=${friend.handle.slice(0, 5)}` });
    const req1 = await call("PUT /api/users/[handle]/follow", followR.PUT, { token: me, params: { handle: friend.handle } });
    expect(req1.state).toBe("requested");
    const limited = await call("GET /api/users/[handle]", userR.GET, { token: me, params: { handle: friend.handle } });
    expect(limited.access).toBe("limited");
    await call("PUT /api/users/[handle]/follow", followR.PUT, { token: friendT, params: { handle: "app_user" } });
    const reqs = await call("GET /api/me/follow-requests", meRequestsR.GET, { token: friendT });
    expect(reqs.requests).toHaveLength(1);
    await call("POST /api/me/follow-requests/[handle]", meRequestR.POST, { token: friendT, params: { handle: "app_user" }, body: { approve: true } });
    await call("POST /api/me/follow-requests/approve-all", meApproveAllR.POST, { token: me });
    const fullProfile = await call("GET /api/users/[handle]", userR.GET, { token: me, params: { handle: friend.handle } });
    expect(fullProfile.access).toBe("full");
    expect(fullProfile.user.counts).toMatchObject({ stamps: 3, places: 3 });
    await call("GET /api/users/[handle]", userR.GET, { token: me, params: { handle: "app_user" } });
    await call("GET /api/users/[handle]/followers", followersR.GET, { token: me, params: { handle: friend.handle } });
    await call("GET /api/users/[handle]/following", followingOfR.GET, { token: me, params: { handle: friend.handle } });
    await call("GET /api/me/following", meFollowingR.GET, { token: me });
    // Friend follows back so my stamp reaches their feed; I follow friend (approved above), so my feed has theirs.
    const myFeed = await call("GET /api/feed", feedR.GET, { token: me });
    expect(myFeed.stamps).toHaveLength(3);
    await call("GET /api/feed", feedR.GET, { token: me, query: "?before=2999-01-01T00:00:00.000Z_zzzz" });
    await call("GET /api/users/[handle]/stamps", userStampsR.GET, { token: me, params: { handle: friend.handle } });
    await call("GET /api/users/[handle]/places", userPlacesR.GET, { token: me, params: { handle: friend.handle } });

    await call("GET /api/me/neighborhoods", neighborhoodsR.GET, { token: me });
    await call("PUT /api/me/pins", pinsR.PUT, { token: me, body: { stampIds: [stampId] } });
    const pins = await call("GET /api/me/pins", pinsR.GET, { token: me });
    expect(pins.stamps.map((x: { id: string }) => x.id)).toEqual([stampId]);

    // Photos: reject additions, lay out and remove the creation-time photo.
    const more = new FormData();
    more.append("photos", new Blob([new Uint8Array(png())], { type: "image/png" }), "a.png");
    more.append("photos", new Blob([new Uint8Array(png())], { type: "image/png" }), "b.png");
    const rejected = await call("POST /api/stamps/[id]/photos", stampPhotosR.POST, { token: me, params: { id: stampId }, form: more, status: 400 });
    expect(rejected).toEqual({ error: "bad_request", message: "Photos can only be attached when creating a stamp" });
    const photoId = full.stamp.photos[0].id;
    const laid = await call("PATCH /api/stamps/[id]/photos", stampPhotosR.PATCH, { token: me, params: { id: stampId }, body: { photos: [{ id: photoId, x: 0.4, y: 0.6, rotation: -7 }] } });
    expect(laid.stamp.photos[0]).toMatchObject({ x: 0.4, y: 0.6, rotation: -7 });
    await call("POST /api/stamps/[id]/photos/[photoId]/remove", stampPhotoRemoveR.POST, { token: me, params: { id: stampId, photoId } });

    // Stamp detail, likes, activity, edit, remove
    const friendStamp = myFeed.stamps[0].id as string;
    await call("GET /api/stamps/[id]", stampR.GET, { token: me, params: { id: friendStamp } });
    await call("PUT /api/stamps/[id]/like", stampLikeR.PUT, { token: me, params: { id: friendStamp } });
    await call("GET /api/me/activity", activityR.GET, { token: friendT });
    await call("DELETE /api/stamps/[id]/like", stampLikeR.DELETE, { token: me, params: { id: friendStamp } });
    await call("PATCH /api/stamps/[id]", stampR.PATCH, { token: me, params: { id: stampId }, body: { caption: "still great", song: { title: "Edited Song", artist: "Edit Band" } } });
    await call("PATCH /api/stamps/[id]", stampR.PATCH, { token: me, params: { id: stampId }, body: { song: null } });

    // Profile settings and avatar
    await call("GET /api/me/profile", meProfileR.GET, { token: me });
    await call("PATCH /api/me/profile", meProfileR.PATCH, { token: me, body: { bio: "Out most Fridays", isPrivate: false } });
    const avatarForm = new FormData();
    avatarForm.set("photo", new Blob([new Uint8Array(png())], { type: "image/png" }), "a.png");
    const av = await call("POST /api/me/avatar", meAvatarR.POST, { token: me, form: avatarForm });
    expect(av.avatarUrl).toMatch(/^\/api\/uploads\/avatars\//);
    await call("GET /api/users/[handle]", userR.GET, { token: friendT, params: { handle: "app_user" } });
    await call("DELETE /api/me/avatar", meAvatarR.DELETE, { token: me });
    await call("DELETE /api/me/followers/[handle]", meFollowerR.DELETE, { token: friendT, params: { handle: "app_user" } });
    await call("DELETE /api/users/[handle]/follow", followR.DELETE, { token: me, params: { handle: friend.handle } });
    const other = await makeUser();
    await call("POST /api/users/[handle]/block", blockR.POST, { token: me, params: { handle: other.handle } });
    const blocks = await call("GET /api/me/blocks", meBlocksR.GET, { token: me });
    expect(blocks.blocks).toHaveLength(1);
    await call("DELETE /api/users/[handle]/block", blockR.DELETE, { token: me, params: { handle: other.handle } });

    // Flags + moderation (stamp and account reports)
    await call("POST /api/flags", flagsR.POST, { token: friendT, body: { targetType: "STAMP", targetId: stampId, reason: "not at this place" }, status: 201 });
    await call("POST /api/flags", flagsR.POST, { token: friendT, body: { targetType: "USER", targetId: other.handle, reason: "harassing people" }, status: 201 });
    await call("GET /api/mod/queue", modQueueR.GET, { token: modT });
    await call("POST /api/mod/actions", modActionsR.POST, { token: modT, body: { targetType: "STAMP", targetId: stampId, action: "HIDE", note: "check" } });
    await call("POST /api/mod/actions", modActionsR.POST, { token: modT, body: { targetType: "USER", targetId: other.id, action: "SUSPEND" } });
    const hidden = await call("GET /api/mod/hidden", modHiddenR.GET, { token: modT });
    expect(hidden.items.map((i: { targetId: string }) => i.targetId)).toContain(stampId);
    await call("GET /api/mod/queue", modQueueR.GET, { token: modT });
    await call("GET /api/mod/log", modLogR.GET, { token: modT });
    await call("POST /api/stamps/[id]/remove", stampRemoveR.POST, { token: friendT, params: { id: friendStamp } });

    // Admin (web-only, still contracted)
    await call("PATCH /api/admin/users/[handle]", adminUserR.PATCH, { token: adminT, params: { handle: friend.handle }, body: { geofenceExempt: true } });
    await call("GET /api/admin/users", adminUsersR.GET, { token: adminT, query: `?q=${friend.handle.slice(0, 6)}` });
    await call("POST /api/admin/users/[handle]/verification", adminVerifyR.POST, { token: adminT, params: { handle: friend.handle }, body: { verified: true, note: "Known promoter" } });
    await call("GET /api/admin/verification-log", adminVerifyLogR.GET, { token: adminT });

    // Ops
    const health = await healthR.GET();
    expect(C.HealthResponse.safeParse(await health.json()).success).toBe(true);
    checked.add("GET /api/health");
    process.env.CRON_SECRET = "contract-cron-secret-000";
    await call("GET /api/cron/maintenance", cronR.GET as Handler, { headers: { authorization: "Bearer contract-cron-secret-000" } });
    await call("POST /api/cron/maintenance", cronR.POST as Handler, { headers: { authorization: "Bearer contract-cron-secret-000" } });
    checked.add("GET /api/uploads/[...key]"); // binary, covered by serverless.test.ts

    // Sign-out flows and deletion last.
    await call("POST /api/auth/logout", logoutR.POST, { token: friendT });
    await call("POST /api/auth/logout-all", logoutAllR.POST, { token: me });
    const fresh = await signup(prisma, { email: "bye@x.dev", password: "long enough pw", displayName: "Bye", handle: "bye_bye", acceptTerms: true, birthdate: "1990-05-05" });
    const byeT = await tok(fresh.user.id);
    await call("POST /api/me/delete", meDeleteR.POST, { token: byeT, body: { password: "long enough pw" } });
  }, 60_000);

  it("error responses from real failure paths match ErrorResponse", async () => {
    const place = await makeVenue();
    const u = await makeActor();
    const t = (await createSession(prisma, u.userId, { client: "IOS" })).token;
    const stampAt = (fields: Record<string, string>) => {
      const form = stampForm(fields, false);
      return new Request("http://x", { method: "POST", headers: { authorization: `Bearer ${t}`, "content-length": "500" }, body: form });
    };
    const ctx = { params: Promise.resolve({ id: place.id }) };
    const cases: [string, Response][] = [
      ["401", await meR.GET(new Request("http://localhost/api/me"), undefined as never)],
      ["401 invalid_token", await meR.GET(new Request("http://localhost/api/me", { headers: { authorization: "Bearer dead-dead-dead-dead-dead-0" } }), undefined as never)],
      ["403 geofence", await placeStampsR.POST(stampAt({ caption: "far", lat: String(VENUE_POS.lat + 0.01), lng: String(VENUE_POS.lng) }), ctx)],
      ["400 invalid_input", await placeStampsR.POST(stampAt({ lat: String(INSIDE.lat), lng: String(INSIDE.lng) }), ctx)],
      ["404", await userR.GET(new Request("http://x"), { params: Promise.resolve({ handle: "nobody_here" }) })],
    ];
    for (const [label, res] of cases) {
      expect(res.status, label).toBe(Number(label.slice(0, 3)));
      expect(C.ErrorResponse.safeParse(await res.json()).success, label).toBe(true);
    }
  });

  it("exercised every registered route", () => {
    const missing = Object.keys(REGISTRY).filter((k) => !checked.has(k));
    expect(missing, "routes in the registry that the contract test didn't exercise").toEqual([]);
  });

  it("error responses match ErrorResponse", async () => {
    const res = await meR.GET(new Request("http://localhost/api/me"), undefined as never);
    expect(res.status).toBe(401);
    expect(C.ErrorResponse.safeParse(await res.json()).success).toBe(true);
  });

  it("every route handler in src/app/api is registered in the contract", () => {
    const root = path.resolve("src/app/api");
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name === "route.ts") {
          const src = readFileSync(full, "utf8");
          const p = "/api" + path.dirname(full).slice(root.length).split(path.sep).join("/");
          // Any way of exporting a method handler: `export const X`, `export (async) function X`, `export { h as X }`.
          const methods = new Set<string>();
          for (const m of src.matchAll(/export\s+(?:const|let|var|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) methods.add(m[1]!);
          for (const block of src.matchAll(/export\s*\{([^}]*)\}/g)) {
            for (const m of block[1]!.matchAll(/(?:\bas\s+|^|,)\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) methods.add(m[1]!);
          }
          for (const m of methods) found.push(`${m} ${p}`);
        }
      }
    };
    walk(root);
    expect(found.filter((k) => !(k in REGISTRY)), "add these routes to REGISTRY + src/contracts/api.ts").toEqual([]);
    expect(Object.keys(REGISTRY).filter((k) => !found.includes(k)), "stale REGISTRY entries").toEqual([]);
  });
});
