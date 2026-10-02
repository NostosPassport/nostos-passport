/**
 * Contract drift test: calls every API route the way the iOS app does (bearer tokens) against a realistic fixture
 * and parses each response with the strict schemas in src/contracts/api.ts. A second test scans src/app/api and
 * fails if any route handler is missing from the registry below, so new endpoints can't skip the contract.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import type { ZodTypeAny } from "zod";
import * as C from "@/contracts/api";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { signup } from "@/server/services/auth";
import { importOsmVenues } from "@/server/services/osm-import";
import { installMemoryStorage } from "./mem-storage";
import { actorFor, makeActor, makeOwner, makeUser, makeVenue, INSIDE, VENUE_POS } from "./factories";

import * as loginR from "@/app/api/auth/login/route";
import * as signupR from "@/app/api/auth/signup/route";
import * as logoutR from "@/app/api/auth/logout/route";
import * as logoutAllR from "@/app/api/auth/logout-all/route";
import * as meR from "@/app/api/me/route";
import * as meTermsR from "@/app/api/me/terms/route";
import * as meDeleteR from "@/app/api/me/delete/route";
import * as meBlocksR from "@/app/api/me/blocks/route";
import * as meFollowingR from "@/app/api/me/following/route";
import * as venuesR from "@/app/api/venues/route";
import * as venueR from "@/app/api/venues/[id]/route";
import * as reportsR from "@/app/api/venues/[id]/reports/route";
import * as photosR from "@/app/api/venues/[id]/photos/route";
import * as commentsR from "@/app/api/venues/[id]/comments/route";
import * as presenceR from "@/app/api/venues/[id]/presence/route";
import * as rsvpR from "@/app/api/venues/[id]/rsvp/route";
import * as commentR from "@/app/api/comments/[id]/route";
import * as replyR from "@/app/api/comments/[id]/reply/route";
import * as usersR from "@/app/api/users/route";
import * as userR from "@/app/api/users/[handle]/route";
import * as followR from "@/app/api/users/[handle]/follow/route";
import * as blockR from "@/app/api/users/[handle]/block/route";
import * as followersR from "@/app/api/users/[handle]/followers/route";
import * as followingOfR from "@/app/api/users/[handle]/following/route";
import * as meRequestsR from "@/app/api/me/follow-requests/route";
import * as meRequestR from "@/app/api/me/follow-requests/[handle]/route";
import * as meApproveAllR from "@/app/api/me/follow-requests/approve-all/route";
import * as meFollowerR from "@/app/api/me/followers/[handle]/route";
import * as meProfileR from "@/app/api/me/profile/route";
import * as meAvatarR from "@/app/api/me/avatar/route";
import * as postR from "@/app/api/posts/[id]/route";
import * as blocksR from "@/app/api/blocks/route";
import * as likeR from "@/app/api/posts/[id]/like/route";
import * as featuredR from "@/app/api/venues/[id]/featured/route";
import * as activityR from "@/app/api/me/activity/route";
import * as cronFeaturedR from "@/app/api/cron/featured/route";
import * as meBlockRefR from "@/app/api/me/blocks/[ref]/route";
import * as postRemoveR from "@/app/api/posts/[id]/remove/route";
import * as userPostsR from "@/app/api/users/[handle]/posts/route";
import * as userPlacesR from "@/app/api/users/[handle]/places/route";
import * as flagsR from "@/app/api/flags/route";
import * as modQueueR from "@/app/api/mod/queue/route";
import * as modLogR from "@/app/api/mod/log/route";
import * as modActionsR from "@/app/api/mod/actions/route";
import * as modHiddenR from "@/app/api/mod/hidden/route";
import { deleteAccount } from "@/server/services/account";
import { hashPassword } from "@/lib/auth/password";
import * as ownerVenuesR from "@/app/api/owner/venues/route";
import * as ownerVenueR from "@/app/api/owner/venues/[id]/route";
import * as ownerPhotoR from "@/app/api/owner/venues/[id]/photo/route";
import * as ownerPromosR from "@/app/api/owner/venues/[id]/promos/route";
import * as endPromoR from "@/app/api/owner/promos/[id]/end/route";
import * as claimsR from "@/app/api/claims/route";
import * as adminClaimR from "@/app/api/admin/claims/[id]/route";
import * as adminPromoR from "@/app/api/admin/promos/[id]/route";
import * as adminUserR from "@/app/api/admin/users/[handle]/route";
import * as adminUsersR from "@/app/api/admin/users/route";
import * as adminVerifyR from "@/app/api/admin/users/[handle]/verification/route";
import * as adminVerifyLogR from "@/app/api/admin/verification-log/route";
import * as healthR from "@/app/api/health/route";
import * as cronR from "@/app/api/cron/reputation/route";

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
  "GET /api/venues": C.VenuesResponse,
  "GET /api/venues/[id]": C.VenuePageResponse,
  "POST /api/venues/[id]/reports": C.ReportResponse,
  "POST /api/venues/[id]/photos": C.PhotoResponse,
  "POST /api/venues/[id]/comments": C.CommentCreatedResponse,
  "POST /api/venues/[id]/presence": C.PresenceResponse,
  "PUT /api/venues/[id]/rsvp": C.RsvpResponse,
  "DELETE /api/venues/[id]/rsvp": C.RsvpResponse,
  "PATCH /api/comments/[id]": C.CommentEditedResponse,
  "POST /api/comments/[id]/reply": C.ReplyCreatedResponse,
  "GET /api/users": C.UserSearchResponse,
  "GET /api/users/[handle]": C.ProfileResponse,
  "PUT /api/users/[handle]/follow": C.FollowResponse,
  "DELETE /api/users/[handle]/follow": C.FollowResponse,
  "POST /api/users/[handle]/block": C.BlockResponse,
  "GET /api/users/[handle]/followers": C.PeopleListResponse,
  "GET /api/users/[handle]/following": C.PeopleListResponse,
  "GET /api/me/follow-requests": C.FollowRequestsResponse,
  "POST /api/me/follow-requests/[handle]": C.FollowRequestDecisionResponse,
  "POST /api/me/follow-requests/approve-all": C.ApproveAllResponse,
  "DELETE /api/me/followers/[handle]": C.RemoveFollowerResponse,
  "GET /api/me/profile": C.ProfileSettingsResponse,
  "PATCH /api/me/profile": C.ProfileSettingsResponse,
  "POST /api/me/avatar": C.AvatarResponse,
  "DELETE /api/me/avatar": C.AvatarResponse,
  "GET /api/posts/[id]": C.PostResponse,
  "POST /api/blocks": C.BlockResponse,
  "PUT /api/posts/[id]/like": C.LikeResponse,
  "DELETE /api/posts/[id]/like": C.LikeResponse,
  "GET /api/venues/[id]/featured": C.FeaturedMonthResponse,
  "GET /api/me/activity": C.ActivityResponse,
  "POST /api/cron/featured": C.FeaturedCronResponse,
  "DELETE /api/me/blocks/[ref]": C.BlockResponse,
  "PATCH /api/posts/[id]": C.PostEditResponse,
  "POST /api/posts/[id]/remove": C.RemovePostResponse,
  "GET /api/users/[handle]/posts": C.UserPostsResponse,
  "GET /api/users/[handle]/places": C.UserPlacesResponse,
  "DELETE /api/users/[handle]/block": C.BlockResponse,
  "POST /api/flags": C.FlagResponse,
  "GET /api/mod/queue": C.ModQueueResponse,
  "GET /api/mod/log": C.ModLogResponse,
  "POST /api/mod/actions": C.ModActionResponse,
  "GET /api/mod/hidden": C.ModHiddenResponse,
  "GET /api/owner/venues": C.OwnerOverviewResponse,
  "GET /api/owner/venues/[id]": C.OwnerDashboardResponse,
  "PATCH /api/owner/venues/[id]": C.OfficialInfoResponse,
  "POST /api/owner/venues/[id]/photo": C.OfficialPhotoResponse,
  "POST /api/owner/venues/[id]/promos": C.PromoResponse,
  "POST /api/owner/promos/[id]/end": C.PromoResponse,
  "POST /api/claims": C.ClaimResponse,
  "POST /api/admin/claims/[id]": C.AdminClaimResponse,
  "PATCH /api/admin/promos/[id]": C.AdminPromoResponse,
  "PATCH /api/admin/users/[handle]": C.AdminUserFlagsResponse,
  "GET /api/admin/users": C.AdminUserSearchResponse,
  "POST /api/admin/users/[handle]/verification": C.VerificationResponse,
  "GET /api/admin/verification-log": C.VerificationLogResponse,
  "GET /api/health": C.HealthResponse,
  "GET /api/cron/reputation": C.CronResponse,
  "POST /api/cron/reputation": C.CronResponse,
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

/** New York wall-clock "YYYY-MM-DDTHH:MM" for an instant (the promo form format). */
const ny = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

const png = () => {
  const p = new PNG({ width: 4, height: 4 });
  p.data.fill(150);
  return PNG.sync.write(p);
};

describe("API contract", () => {
  it("every route's response matches src/contracts/api.ts", async () => {
    // Fixture: an OSM venue with an owner, live data, photos, comments + reply, promo, flags.
    await importOsmVenues(prisma, [{ type: "node", id: 42, lat: VENUE_POS.lat, lon: VENUE_POS.lng, tags: { amenity: "bar", name: "Contract Bar", "addr:housenumber": "1", "addr:street": "Avenue A" } }]);
    const venue = await prisma.venue.findUniqueOrThrow({ where: { osmId: "node/42" } });
    const owner = await makeOwner(venue.id);
    const mod = await makeActor({ role: "MODERATOR" });
    const admin = await makeActor({ role: "ADMIN" });
    const friend = await makeActor();
    const tok = async (userId: string) => (await createSession(prisma, userId, { client: "IOS" })).token;
    const [ownerT, modT, adminT, friendT] = await Promise.all([tok(owner.userId), tok(mod.userId), tok(admin.userId), tok(friend.userId)]);

    // Auth (iOS)
    const su = await call("POST /api/auth/signup", signupR.POST, {
      headers: { "x-client": "ios" }, status: 201,
      body: { email: "app@x.dev", password: "long enough pw", displayName: "App User", handle: "app_user", acceptTerms: true, confirm21: true },
    });
    const li = await call("POST /api/auth/login", loginR.POST, { headers: { "x-client": "ios" }, body: { email: "app@x.dev", password: "long enough pw" } });
    const me = li.token as string;
    const meId = su.user.id as string;
    await call("GET /api/me", meR.GET, { token: me });
    await call("POST /api/me/terms", meTermsR.POST, { token: me, body: { version: (await (await meR.GET(new Request("http://x/api/me", { headers: { authorization: `Bearer ${me}` } }), undefined as never)).json()).terms.currentVersion } });

    // Map + venue + posting
    const vid = venue.id;
    await call("GET /api/venues", venuesR.GET, { token: me });
    await call("POST /api/venues/[id]/presence", presenceR.POST, { token: me, params: { id: vid }, body: INSIDE });
    await call("PUT /api/venues/[id]/rsvp", rsvpR.PUT, { token: me, params: { id: vid } });
    await call("DELETE /api/venues/[id]/rsvp", rsvpR.DELETE, { token: friendT, params: { id: vid } });
    await call("POST /api/venues/[id]/reports", reportsR.POST, { token: me, params: { id: vid }, body: { type: "COVER", cover: "20", ...INSIDE }, status: 201 });
    await call("POST /api/venues/[id]/reports", reportsR.POST, { token: friendT, params: { id: vid }, body: { type: "COVER", cover: "20", ...INSIDE }, status: 201 });
    await call("POST /api/venues/[id]/reports", reportsR.POST, { token: friendT, params: { id: vid }, body: { type: "VIBE", vibe: "PACKED", ...INSIDE }, status: 201 });
    const form = new FormData();
    form.set("photo", new Blob([new Uint8Array(png())], { type: "image/png" }), "p.png");
    form.set("caption", "dance floor");
    form.set("lat", String(INSIDE.lat));
    form.set("lng", String(INSIDE.lng));
    const photoBody = await call("POST /api/venues/[id]/photos", photosR.POST, { token: me, params: { id: vid }, form, status: 201 });
    // A post: the same upload with a rating, shared to the venue page.
    const postForm = new FormData();
    postForm.set("photo", new Blob([new Uint8Array(png())], { type: "image/png" }), "post.png");
    postForm.set("caption", "best night");
    postForm.set("lat", String(INSIDE.lat));
    postForm.set("lng", String(INSIDE.lng));
    postForm.set("rating", "9");
    postForm.set("shared", "true");
    const postBody = await call("POST /api/venues/[id]/photos", photosR.POST, { token: friendT, params: { id: vid }, form: postForm, status: 201 });
    expect(postBody.photo).toMatchObject({ rating: 9, shared: true });
    await call("GET /api/posts/[id]", postR.GET, { token: me, params: { id: postBody.photo.id } });
    await call("PUT /api/posts/[id]/like", likeR.PUT, { token: me, params: { id: postBody.photo.id } });
    await call("GET /api/me/activity", activityR.GET, { token: friendT });
    await call("DELETE /api/posts/[id]/like", likeR.DELETE, { token: me, params: { id: postBody.photo.id } });
    await call("PATCH /api/posts/[id]", postR.PATCH, { token: friendT, params: { id: postBody.photo.id }, body: { rating: 8, caption: "still great" } });
    await call("GET /api/users/[handle]/posts", userPostsR.GET, { token: friendT, params: { handle: friend.handle } });
    await call("GET /api/users/[handle]/places", userPlacesR.GET, { token: friendT, params: { handle: friend.handle } });
    const comment = await call("POST /api/venues/[id]/comments", commentsR.POST, { token: me, params: { id: vid }, body: { body: "Packed, 20 min line" }, status: 201 });
    await call("PATCH /api/comments/[id]", commentR.PATCH, { token: me, params: { id: comment.comment.id }, body: { body: "Packed. 20 min line" } });
    await call("POST /api/comments/[id]/reply", replyR.POST, { token: ownerT, params: { id: comment.comment.id }, body: { body: "Thanks for coming out" }, status: 201 });
    await call("GET /api/venues/[id]", venueR.GET, { token: me, params: { id: venue.slug } });
    await call("GET /api/venues/[id]", venueR.GET, { params: { id: vid } });

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
    const full = await call("GET /api/users/[handle]", userR.GET, { token: me, params: { handle: friend.handle } });
    expect(full.access).toBe("full");
    await call("GET /api/users/[handle]", userR.GET, { token: me, params: { handle: "app_user" } });
    await call("GET /api/users/[handle]/followers", followersR.GET, { token: me, params: { handle: friend.handle } });
    await call("GET /api/users/[handle]/following", followingOfR.GET, { token: me, params: { handle: friend.handle } });
    await call("GET /api/me/following", meFollowingR.GET, { token: me });
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
    await call("GET /api/me/blocks", meBlocksR.GET, { token: me });
    await call("DELETE /api/users/[handle]/block", blockR.DELETE, { token: me, params: { handle: other.handle } });
    const blockedByPhoto = await call("POST /api/blocks", blocksR.POST, { token: me, body: { targetType: "PHOTO", targetId: postBody.photo.id } });
    expect(blockedByPhoto).toEqual({ blocked: true });
    const myBlocks = await call("GET /api/me/blocks", meBlocksR.GET, { token: me });
    await call("DELETE /api/me/blocks/[ref]", meBlockRefR.DELETE, { token: me, params: { ref: myBlocks.blocks[0].ref } });

    // Flags + moderation (content and account reports)
    await call("POST /api/flags", flagsR.POST, { token: friendT, body: { targetType: "PHOTO", targetId: photoBody.photo.id, reason: "not here" }, status: 201 });
    await call("POST /api/flags", flagsR.POST, { token: ownerT, body: { targetType: "COMMENT", targetId: comment.comment.id, reason: "false claim" }, status: 201 });
    await call("POST /api/flags", flagsR.POST, { token: friendT, body: { targetType: "USER", targetId: other.handle, reason: "harassing people" }, status: 201 });
    const report = await prisma.report.findFirstOrThrow({ where: { userId: friend.userId } });
    await call("POST /api/flags", flagsR.POST, { token: ownerT, body: { targetType: "REPORT", targetId: report.id, reason: "wrong vibe" }, status: 201 });
    await call("GET /api/mod/queue", modQueueR.GET, { token: modT });
    await call("POST /api/mod/actions", modActionsR.POST, { token: modT, body: { targetType: "PHOTO", targetId: photoBody.photo.id, action: "HIDE", note: "check" } });
    await call("POST /api/mod/actions", modActionsR.POST, { token: modT, body: { targetType: "USER", targetId: other.id, action: "SUSPEND" } });
    await call("GET /api/mod/queue", modQueueR.GET, { token: modT });
    await call("GET /api/mod/log", modLogR.GET, { token: modT });

    // Owner
    await call("GET /api/owner/venues", ownerVenuesR.GET, { token: ownerT });
    await call("PATCH /api/owner/venues/[id]", ownerVenueR.PATCH, { token: ownerT, params: { id: vid }, body: { officialCover: "10", dressCode: "No sportswear" } });
    const ownerForm = new FormData();
    ownerForm.set("photo", new Blob([new Uint8Array(png())], { type: "image/png" }), "o.png");
    await call("POST /api/owner/venues/[id]/photo", ownerPhotoR.POST, { token: ownerT, params: { id: vid }, form: ownerForm });
    const promo = await call("POST /api/owner/venues/[id]/promos", ownerPromosR.POST, {
      token: ownerT, params: { id: vid }, status: 201,
      body: { title: "Late set", body: "DJ from 11", startsAt: ny(new Date(Date.now() + 86_400_000)), endsAt: ny(new Date(Date.now() + 90_000_000)) },
    });
    await call("GET /api/owner/venues/[id]", ownerVenueR.GET, { token: ownerT, params: { id: vid } });
    await call("POST /api/owner/promos/[id]/end", endPromoR.POST, { token: ownerT, params: { id: promo.promo.id } });
    const claim = await call("POST /api/claims", claimsR.POST, { token: friendT, body: { venueId: vid }, status: 201 });

    // Admin (web-only, still contracted)
    await call("POST /api/admin/claims/[id]", adminClaimR.POST, { token: adminT, params: { id: claim.claim.id }, body: { approve: false } });
    await call("PATCH /api/admin/promos/[id]", adminPromoR.PATCH, { token: adminT, params: { id: promo.promo.id }, body: { isPaid: true } });
    await call("PATCH /api/admin/users/[handle]", adminUserR.PATCH, { token: adminT, params: { handle: friend.handle }, body: { geofenceExempt: true } });
    await call("GET /api/admin/users", adminUsersR.GET, { token: adminT, query: `?q=${friend.handle.slice(0, 6)}` });
    await call("POST /api/admin/users/[handle]/verification", adminVerifyR.POST, { token: adminT, params: { handle: friend.handle }, body: { verified: true, note: "Known promoter" } });
    await call("GET /api/admin/verification-log", adminVerifyLogR.GET, { token: adminT });

    // Ops
    const health = await healthR.GET();
    expect(C.HealthResponse.safeParse(await health.json()).success).toBe(true);
    checked.add("GET /api/health");
    process.env.CRON_SECRET = "contract-cron-secret-000";
    await call("GET /api/cron/reputation", cronR.GET as Handler, { headers: { authorization: "Bearer contract-cron-secret-000" } });
    await call("POST /api/cron/reputation", cronR.POST as Handler, { headers: { authorization: "Bearer contract-cron-secret-000" } });
    checked.add("GET /api/uploads/[...key]"); // binary, covered by serverless.test.ts
    // Featuring: a past night's post with 3 eligible likes, then the gallery for its month.
    const oldPost = await prisma.photo.create({
      data: { userId: owner.userId === friend.userId ? mod.userId : friend.userId, venueId: vid, storageKey: "photos/old-post.png", mimeType: "image/png", caption: "last week", ...INSIDE, rating: 9, shared: true, createdAt: new Date(Date.now() - 3 * 86_400_000) },
    });
    for (let i = 0; i < 3; i++) {
      const fan = await makeActor();
      await prisma.photoLike.create({ data: { userId: fan.userId, photoId: oldPost.id, createdAt: new Date(oldPost.createdAt.getTime() + 60_000) } });
    }
    const run = await call("POST /api/cron/featured", cronFeaturedR.POST as Handler, { headers: { authorization: "Bearer contract-cron-secret-000" } });
    expect(run.featured).toBe(1);
    const gallery = await call("GET /api/venues/[id]/featured", featuredR.GET, { token: me, params: { id: venue.slug }, query: `?month=${oldPost.night.slice(0, 7)}` });
    expect(gallery.nights[0].photos).toHaveLength(1);
    await call("GET /api/venues/[id]", venueR.GET, { token: me, params: { id: venue.slug } });

    await call("POST /api/posts/[id]/remove", postRemoveR.POST, { token: friendT, params: { id: postBody.photo.id } });

    // Sign-out flows and deletion last.
    await call("POST /api/auth/logout", logoutR.POST, { token: friendT });
    await call("POST /api/auth/logout-all", logoutAllR.POST, { token: me });
    const fresh = await signup(prisma, { email: "bye@x.dev", password: "long enough pw", displayName: "Bye", handle: "bye_bye", acceptTerms: true, confirm21: true });
    const byeT = await tok(fresh.user.id);
    await call("POST /api/me/delete", meDeleteR.POST, { token: byeT, body: { password: "long enough pw" } });
    void meId;
    void actorFor;

  }, 60_000);

  it("covers the interesting branches: consensus ok, accuracy ok with windows, earlier photos, deleted authors, friends going, hidden replies", async () => {
    await importOsmVenues(prisma, [{ type: "node", id: 77, lat: VENUE_POS.lat, lon: VENUE_POS.lng, tags: { amenity: "pub", name: "Branch Pub" } }]);
    const venue = await prisma.venue.findUniqueOrThrow({ where: { osmId: "node/77" } });
    const vid = venue.id;
    const owner = await makeOwner(vid);
    const mod = await makeActor({ role: "MODERATOR" });
    const tok = async (userId: string) => (await createSession(prisma, userId, { client: "IOS" })).token;
    const [a, b, c] = [await makeActor(), await makeActor(), await makeActor()];
    const [aT, bT, cT, ownerT, modT] = await Promise.all([a, b, c, owner, mod].map((x) => tok(x.userId)));

    // Accuracy "ok": the venue stated $10 long ago; 5 completed hours with 3 people each paying $10.
    await prisma.venueCoverHistory.create({ data: { venueId: vid, coverCents: 1000, effectiveFrom: new Date(Date.now() - 60 * 86_400_000) } });
    await prisma.venue.update({ where: { id: vid }, data: { officialCoverCents: 1000 } });
    const H = 3_600_000;
    const hour = Math.floor(Date.now() / H) * H;
    for (let k = 1; k <= 5; k++) for (const u of [a, b, c]) {
      await prisma.report.create({ data: { userId: u.userId, venueId: vid, type: "COVER", coverCents: 1000, ...INSIDE, createdAt: new Date(hour - k * H + 60_000) } });
    }
    // Consensus "ok" for vibe/line/cover now.
    for (const t of [aT, bT]) {
      await call("POST /api/venues/[id]/reports", reportsR.POST, { token: t, params: { id: vid }, body: { type: "VIBE", vibe: "BUSY", ...INSIDE }, status: 201 });
      await call("POST /api/venues/[id]/reports", reportsR.POST, { token: t, params: { id: vid }, body: { type: "LINE", line: "UNDER_10", ...INSIDE }, status: 201 });
      await call("POST /api/venues/[id]/reports", reportsR.POST, { token: t, params: { id: vid }, body: { type: "COVER", cover: "10", ...INSIDE }, status: 201 });
    }
    // Earlier photo (5h old) and a live one.
    await prisma.photo.create({ data: { userId: b.userId, venueId: vid, storageKey: "photos/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png", mimeType: "image/png", caption: "earlier", ...INSIDE, createdAt: new Date(Date.now() - 5 * H) } });
    // Mutual follows + RSVP -> friendsGoing and following.goingTonight (public accounts: follows are instant).
    await prisma.user.updateMany({ where: { id: { in: [a.userId, b.userId] } }, data: { isPrivate: false } });
    await call("PUT /api/users/[handle]/follow", followR.PUT, { token: aT, params: { handle: b.handle } });
    await call("PUT /api/users/[handle]/follow", followR.PUT, { token: bT, params: { handle: a.handle } });
    await call("PUT /api/venues/[id]/rsvp", rsvpR.PUT, { token: bT, params: { id: vid } });
    // A comment whose author then deletes their account, and an owner reply that a moderator hides.
    const gone = await makeUser();
    await prisma.user.update({ where: { id: gone.id }, data: { passwordHash: await hashPassword("pw pw pw pw") } });
    const goneActor = (await actorFor(gone.id))!;
    const cm = await call("POST /api/venues/[id]/comments", commentsR.POST, { token: await tok(gone.id), params: { id: vid }, body: { body: "was great" }, status: 201 });
    const reply = await call("POST /api/comments/[id]/reply", replyR.POST, { token: ownerT, params: { id: cm.comment.id }, body: { body: "thanks" }, status: 201 });
    await deleteAccount(prisma, goneActor, { password: "pw pw pw pw" });
    await call("POST /api/mod/actions", modActionsR.POST, { token: modT, body: { targetType: "COMMENT", targetId: reply.reply.id, action: "HIDE" } });
    // Presence here:false (outside) and here:true.
    const out = await call("POST /api/venues/[id]/presence", presenceR.POST, { token: cT, params: { id: vid }, body: { lat: VENUE_POS.lat + 0.01, lng: VENUE_POS.lng } });
    expect(out).toMatchObject({ here: false, reason: "outside", radiusM: 100 });
    expect(out.distanceM).toBeGreaterThan(1000);

    const page = await call("GET /api/venues/[id]", venueR.GET, { token: aT, params: { id: vid } });
    expect(page.official.accuracy.status).toBe("ok");
    expect(page.official.accuracy.windows.length).toBeGreaterThanOrEqual(5);
    expect(page.live.consensus.vibe.status).toBe("ok");
    expect(page.live.earlierPhotos).toHaveLength(1);
    expect(page.live.friendsGoing).toHaveLength(1);
    expect(page.live.comments.find((x: { id: string }) => x.id === cm.comment.id).author).toEqual({ kind: "deleted" });
    const following = await call("GET /api/me/following", meFollowingR.GET, { token: aT });
    expect(following.following[0].goingTonight).toHaveLength(1);
    const me = await call("GET /api/me", meR.GET, { token: ownerT });
    expect(me.ownedVenues).toHaveLength(1);
    await prisma.user.update({ where: { id: owner.userId }, data: { isPrivate: false } });
    const profile = await call("GET /api/users/[handle]", userR.GET, { params: { handle: owner.handle } });
    expect(profile.user.venues).toHaveLength(1);
    expect(profile.user).not.toHaveProperty("id");
    const dash = await call("GET /api/owner/venues/[id]", ownerVenueR.GET, { token: ownerT, params: { id: vid } });
    expect(dash.hiddenReplies).toHaveLength(1);
    const other = await makeVenue({ lat: VENUE_POS.lat + 0.002 });
    await call("POST /api/claims", claimsR.POST, { token: cT, body: { venueId: other.id }, status: 201 });
    const overview = await call("GET /api/owner/venues", ownerVenuesR.GET, { token: cT });
    expect(overview.claims).toHaveLength(1);
    const hidden = await call("GET /api/mod/hidden", modHiddenR.GET, { token: modT });
    expect(hidden.items.map((i: { targetId: string }) => i.targetId)).toContain(reply.reply.id);
  }, 60_000);

  it("error responses from real failure paths match ErrorResponse", async () => {
    const venue = await makeVenue();
    const u = await makeActor();
    const t = (await createSession(prisma, u.userId, { client: "IOS" })).token;
    const cases: [string, Response][] = [
      ["401", await meR.GET(new Request("http://localhost/api/me"), undefined as never)],
      ["401 invalid_token", await meR.GET(new Request("http://localhost/api/me", { headers: { authorization: "Bearer dead-dead-dead-dead-dead-0" } }), undefined as never)],
      ["403 geofence", await reportsR.POST(new Request("http://x", { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ type: "VIBE", vibe: "BUSY", lat: VENUE_POS.lat + 0.01, lng: VENUE_POS.lng }) }), { params: Promise.resolve({ id: venue.id }) })],
      ["400 invalid_input", await reportsR.POST(new Request("http://x", { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ type: "VIBE", vibe: "LIT", ...INSIDE }) }), { params: Promise.resolve({ id: venue.id }) })],
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
