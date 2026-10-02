# Nostos API

The single source of truth for the iOS app. Every response shape below is a zod schema in
[`src/contracts/api.ts`](src/contracts/api.ts). Copy that file verbatim into the app, and parse responses with it.
It depends only on **zod v3**, so install `zod@^3.25` in the app, not v4, whose API differs.
`tests/integration/contracts.test.ts` calls every route and fails if a response drifts from those schemas, or if a
route exists without one.

## Conventions

| | |
|---|---|
| Base URL | `EXPO_PUBLIC_API_URL`: local LAN URL in development, the Vercel preview URL for TestFlight, production for release |
| Format | JSON in and out, except photo uploads (`multipart/form-data`) |
| Time | ISO-8601 UTC strings. "Tonight" means the America/New_York night from **5:00am to 4:59am**. Hours are New York wall-clock `HH:MM` |
| Money | Integer **cents** (`0` = free). Cover *input* is a dollar string (`"20"`, `"12.50"`, `"free"`) |
| Errors | `ErrorResponse` = `{ error: string, message: string }`. `message` is a human sentence written to be shown inline, as is |

### Authentication (iOS)

1. `POST /api/auth/signup` or `/api/auth/login` with header **`X-Client: ios`** returns `{ token, expiresAt, user }`.
2. Store `token` in the iOS keychain (`expo-secure-store`). It lasts 90 days (fixed; not extended by use).
3. Send `Authorization: Bearer <token>` on every request.
4. If any response is **401 with `error: "invalid_token"`** (expired, revoked, signed out elsewhere, or the account was
   deleted or suspended), clear the token and return to sign-in. Public endpoints also return this 401 when a dead token is
   sent, so the app never silently shows signed-out data.

Bearer requests are exempt from the web's Origin/CSRF check. An iOS token doesn't work as a web cookie, and a web cookie doesn't work as a bearer token.

### Rules the app must not re-implement

The server decides. Show its `message` on failure:

- **Geofence**: reports, photos, and "here now" need the user within **100 m** of the venue. Send current `lat`/`lng`
  with every report, photo, and presence ping. Outside it you get 403 `forbidden` with a message like
  "You need to be within 100m of the venue to post (you're 140m away)".
- **Cooldown**: one report of each kind (vibe, line, cover, photo) per venue every **15 minutes**, which returns 429 `rate_limited`
  with "You already posted a vibe update here. Try again in 12 min."
- **Consensus, counts, accuracy, and reputation** come computed from the API. Never compute them on the device.
- **Live photos** are those in `live.livePhotos`. Drop one when `createdAt` + 3 hours passes (use the server's times) and refetch.
  A photo with a `rating` there is a shared post: open it with `GET /api/posts/:id`.
- **Objectionable text** returns 400 `objectionable_content` ("Your comment contains language we don't allow...").

### Attribution (ODbL)

Venue data imported from OpenStreetMap must be credited wherever it's shown. When `GET /api/venues` returns a
non-null `attribution`, show `attribution.text` ("© OpenStreetMap contributors") on the map (a small footnote or the map's
info button), linking to `attribution.url`. On a venue screen, show it when `official.attribution` is non-null.

### Photos

Photo URLs (`url`, `officialPhotoUrl`) are **signed and short-lived** (valid 15–20 minutes, stable within a 5-minute
bucket). Load them directly with `expo-image`. They need no auth header. Cache them only in memory or on disk for the
session, and refetch the venue for fresh URLs rather than storing URLs long-term. Uploads are re-encoded server-side (EXIF and GPS stripped, capped at 2048 px, 5 MB input limit).

### Error codes

| Status | `error` | When |
|---|---|---|
| 400 | `bad_request`, `invalid_input` | Malformed body. `invalid_input` messages list the fields |
| 400 | `objectionable_content` | Slurs or explicit terms in text |
| 401 | `unauthorized` | Endpoint needs sign-in and none was sent |
| 401 | `invalid_token` | Bearer token dead: sign out locally |
| 401 | `invalid_credentials` | Wrong email or password |
| 403 | `forbidden` | Not allowed, **or outside the geofence** (see `message`) |
| 403 | `private_account` | Followers/following of a private account you don't follow |
| 403 | `wrong_password` | Account deletion password mismatch |
| 403 | `account_suspended` | Sign-in to a suspended account |
| 404 | `not_found` | Missing, deleted, suspended, or blocked (the API doesn't reveal which) |
| 409 | `conflict` | Duplicate or state conflict (already flagged, comment frozen after a venue reply, etc.) |
| 411 / 413 / 415 | `length_required` / `too_large` / `unsupported_type` | Upload problems |
| 429 | `rate_limited` | Cooldowns, flag limits, login throttling |

---

## Endpoints

Auth column: **public** (no token needed), **user** (any signed-in account), **owner** (approved owner of that
venue), **mod** (moderator or admin), **admin**, **cron** (`CRON_SECRET`).

### Auth and account

| Method & path | Auth | Request | Response | Errors |
|---|---|---|---|---|
| `POST /api/auth/signup` | public | `SignupRequest` (`email, password ≥10, displayName, handle [a-z0-9_]{3,24}, acceptTerms: true, confirm21: true`) + `X-Client: ios` | 201 `TokenResponse` | 400, 409 (email/handle taken), 400 `objectionable_content` |
| `POST /api/auth/login` | public | `LoginRequest` + `X-Client: ios` | `TokenResponse` | 401 `invalid_credentials`, 403 `account_suspended`, 429 |
| `POST /api/auth/logout` | user | none | `OkResponse` | 401 `invalid_token` |
| `POST /api/auth/logout-all` | user | none | `LogoutAllResponse` (`revoked`) | 401 |
| `GET /api/me` | user | none | `MeResponse`: user (incl. private `reputation`), `ownedVenues` (show "Manage [venue]"), `settings`, `terms.needsAcceptance` | 401 |
| `POST /api/me/terms` | user | `AcceptTermsRequest` (`version` = `terms.currentVersion`) | `AcceptTermsResponse` | 400 |
| `POST /api/me/delete` | user | `DeleteAccountRequest` (`password`) | `DeleteAccountResponse`. Then sign out locally | 403 `wrong_password`, 401 |
| `GET /api/me/blocks` | user | none | `BlocksResponse`: `handle` null for blocks made from content ("Someone you blocked from a photo") | 401 |
| `DELETE /api/me/blocks/:ref` | user | none | `BlockResponse` | 404 (not your block) |
| `GET /api/me/following` | user | none | `FollowingResponse` (`goingTonight` filled for mutual follows only) | 401 |
| `GET /api/me/profile` | user | none | `ProfileSettingsResponse` | 401 |
| `PATCH /api/me/profile` | user | `ProfileSettingsRequest`: only changed fields of `displayName`, `bio` (≤150), `isPrivate` | `ProfileSettingsResponse` (`pendingRequests`: offer "Approve N pending requests?" after switching to public) | 400, 400 `objectionable_content` |
| `POST /api/me/avatar` | user | multipart `photo` (≤5 MB). Send `Content-Length` | `AvatarResponse` | 411, 413, 415 |
| `DELETE /api/me/avatar` | user | none | `AvatarResponse` (`avatarUrl: null`) | 401 |
| `GET /api/me/follow-requests` | user | none | `FollowRequestsResponse`, newest first | 401 |
| `POST /api/me/follow-requests/:handle` | user | `FollowRequestDecisionRequest` `{approve}` | `FollowRequestDecisionResponse` | 404 (no request from them to you) |
| `POST /api/me/follow-requests/approve-all` | user | none | `ApproveAllResponse` (`approved` = count) | 401 |
| `DELETE /api/me/followers/:handle` | user | none | `RemoveFollowerResponse` | 404 |

Account deletion anonymizes: identity is erased, photos are hidden and their files deleted, and reports and comments remain as
"Deleted user". It must be reachable in the app (Guideline 5.1.1(v)).

### Map and venue

| Method & path | Auth | Request | Response | Errors |
|---|---|---|---|---|
| `GET /api/venues` | public (token adds `friendsGoing`) | none | `VenuesResponse`: `venues: MapVenue[]`, `attribution`, `at` | 401 `invalid_token` |
| `GET /api/venues/:idOrSlug` | public (token adds viewer state and filters blocked users) | none | `VenuePageResponse` | 404 |

**Venue search** ("Search bars"): `GET /api/venues` returns every venue (a few hundred), so filter by `name`, `address`, and
`neighborhood` on the device. There is no separate search endpoint.

`MapVenue.vibe` is `NO_DATA` when there aren't enough recent reports. Draw it as a hollow outline, never as "dead".
Sort client-side by `activity` (Live now), `goingTonight` (Going tonight), or distance (Nearby). `promoted` is only a
label and must not affect order.

`VenuePageResponse`:
- `official`: venue-controlled facts. `hours: []` means "Hours not posted". `officialCoverCents: null` means "No official cover
  posted". Label `officialPhotoUrl` "From the venue". Promos with `isPaid` are "Promoted". `accuracy` is a union:
  `ok` (show `scorePct`), `insufficient` ("Not enough data yet"), `no_official_cover` ("No official cover posted").
- `live`: user-controlled reality. `consensus.{vibe,line,cover}` is `ok` (value, `reportCount`, `newestAt`) or
  `insufficient` ("Not enough data", styled neutral). `coverMismatch` shows "Venue says $X · People say $Y". Photos and
  comments carry `mine` (show Edit on your own comments, no Report on your own content) and `author` (`AuthorView`, see
  People and privacy). Replies are venue replies: label them with the venue name.
- `viewer`: `going`, `hereNow`, `ownsVenue` (owners get no report UI for their own venue; the API refuses anyway).

### Posting (all need the user within 100 m unless noted)

| Method & path | Auth | Request | Response | Errors |
|---|---|---|---|---|
| `POST /api/venues/:id/reports` | user | `ReportRequest`: `{type:"VIBE",vibe,lat,lng}` / `{type:"LINE",line,lat,lng}` / `{type:"COVER",cover:"20"\|"free",lat,lng}` | 201 `ReportResponse` | 403 geofence / venue's own account, 429 cooldown, 400 |
| `POST /api/venues/:id/photos` | user | multipart: `photo` (JPEG/PNG/WebP ≤5 MB), `caption`, `lat`, `lng`; for a **post** also `rating` (`"1"`-`"10"`) and optionally `shared` (`"true"`/`"false"`). Send `Content-Length` | 201 `PhotoResponse` (with `url` for the optimistic tile) | 403, 411, 413, 415, 429 (15 min per venue; 20 posts/photos per hour), 400 `objectionable_content` |
| `POST /api/venues/:id/presence` | user | `PresenceRequest` `{lat,lng}` | `PresenceResponse`: `{here:true, expiresAt, distanceM, radiusM}` or `{here:false, reason:"outside"\|"venue_account", distanceM, radiusM}` | 400 (bad coordinates), 401, 404 |
| `PUT /api/venues/:id/rsvp` | user | none | `RsvpResponse` (`goingTonight` = new count) | 403 (venue's own account), 404 |
| `DELETE /api/venues/:id/rsvp` | user | none | `RsvpResponse` | 403 (venue's own account), 404 |
| `POST /api/venues/:id/comments` | user (no geofence) | `CommentRequest` `{body ≤500}` | 201 `CommentCreatedResponse` | 403, 429 (5 per venue / 10 min), 400 `objectionable_content` |
| `PATCH /api/comments/:id` | author | `CommentRequest` | `CommentEditedResponse` | 403, 409 (has a venue reply or is under review) |
| `POST /api/comments/:id/reply` | owner | `CommentRequest` | 201 `ReplyCreatedResponse` | 403, 404 (parent missing or hidden), 400 (one level deep), 400 `objectionable_content` |

Presence: ping on venue open, every 5 minutes while the venue screen is open, and after moving more than 25 m (at most every 30 s).
It stops counting 45 minutes after the last ping. An "outside" ping clears it immediately. **Use the presence response to
drive the report bar**: when `here` is false with `reason: "outside"`, dim the bar and show "You're {distanceM} m away. Get closer
to post." (`distanceM` and `radiusM` come from the server, so don't compute the geofence on the device). A 403 from a report
carries the same distance in its `message`.

### Posts

A **post** is a photo with a rating (1-10), taken with the in-app camera at the venue: the upload above with a
`rating`. The server checks the upload's coordinates against the 100 m geofence, applies the photo cooldown and
strips EXIF; the app only offers its camera (no library) for posts, and sends the position taken with the photo.
Without a rating it's a live-only photo, exactly as before (venue feed only, not on the profile, not likeable).
Captions: 280 characters for posts, 140 for live photos.

- **Share to venue page** (`shared`): default on for public accounts, off for private. Shared posts appear in the
  venue's photo feed (the same 3-hour live window and "Earlier") and can be liked and featured. Unshared posts are
  on the profile only.
- **Editing**: the rating (and adding one to a live photo) until the end of that night, 5am New York
  (`ratingEditableUntil`); after that 409. The caption stays editable, except 409 while it's under moderator review.
- **Delete from profile** hides it everywhere for good (`POST /remove`; nothing is ever deleted).
- Posts never affect consensus, counts, accuracy or reputation. **No venue average rating is shown anywhere.**

| Method & path | Auth | Request | Response | Errors |
|---|---|---|---|---|
| `GET /api/posts/:id` | public | none | `PostResponse` (author per privacy rules) | 404 (missing, removed, hidden, blocked, or an unshared post you can't see) |
| `PATCH /api/posts/:id` | author | `PostEditRequest`: only changed `rating`, `caption`, `shared` | `PostEditResponse` | 400, 403 (not yours), 404, 409 (rating locked, under review, hidden) |
| `POST /api/posts/:id/remove` | author | none | `RemovePostResponse` | 400 (live photo), 403, 404 |
| `GET /api/users/:handle/posts?before=` | public | `before` = previous page's `nextBefore` | `UserPostsResponse` (30 per page, newest first; includes unshared posts) | 403 `private_account`, 404 |
| `GET /api/users/:handle/places` | public | none | `UserPlacesResponse` (each venue with their post count and latest rating) | 403 `private_account`, 404 |

### Likes and the featured gallery

Anyone signed in can like a **shared** post they can see, once; never their own. Show the count and whether you
liked it (`likes` on `PhotoView`/`PostView`; null for live-only photos and unshared posts). Double-tap the photo to
like, plus a heart button. Likes never change the feed order, consensus or counts.

**Featuring.** Just after each night ends (5:05am New York), a job ranks that night's shared posts at each venue by
**eligible** likes: from USER accounts at least 7 days old with reputation 0.5+, not the author, not an owner of that
venue, not App Review. A post needs 3+ eligible likes; ties go to the earlier post; the top 20 are stored with their
rank, and each night's gallery shows the top 10 still visible (a hidden, removed or unshared one is replaced by the
next). Venues can't pick, hide or reorder anything.

On the venue page, `featured.thisMonth` is "This month's best": nights in the current New York calendar month, newest
first (`total` may exceed the 30 in the preview). `featured.archive` lists past months, newest first; label them
"September's best" and open them with `GET /api/venues/:id/featured?month=YYYY-MM`. Every photo keeps Report.

| Method & path | Auth | Request | Response | Errors |
|---|---|---|---|---|
| `PUT /api/posts/:id/like` | user | none | `LikeResponse` `{liked, count, viewerLiked}` | 400 (your own), 404 (not a shared post you can see), 429 (200/hour) |
| `DELETE /api/posts/:id/like` | user | none | `LikeResponse` | 401 |
| `GET /api/venues/:id/featured?month=` | public | `month` = `YYYY-MM` (default: this month) | `FeaturedMonthResponse` (nights newest first, top 10 each) | 400, 404 |
| `GET /api/me/activity` | user | none | `ActivityResponse`: `follow_request`, `new_follower`, `like` (on your posts), `featured` ("You were featured at ___"), newest first, last 30 days. In-app only | 401 |

### People and privacy

Every account is **private** by default. A viewer has **full access** to a profile when it's their own, when the
account is public, when they're an **approved** follower, or when they're a moderator. Everyone else gets the
**limited** view: the handle, the verified badge and a generic avatar, with "This account is private" and a
Follow (request) button.

Authors of photos, comments and replies are `AuthorView`, resolved per viewer on the server:
- `{kind:"user", handle, verified, regular}`: show the handle (link to the profile), a verified badge, and a Regular
  badge when `regular` is true.
- `{kind:"anonymous"}`: a private account the viewer doesn't follow. Show "Anonymous", no link, no badge.
- `{kind:"deleted"}`: show "Deleted user".

**Badges.** `verified` is handpicked by an admin (no application flow) and changes nothing but the badge: show it next
to the handle wherever the handle shows, never on "Anonymous". `regular` (on an author, at the venue being shown) and
`regularAt` (on a full profile) mean 3+ nights with posts at that venue in the last 60 days, computed from posts.

Lists (search, followers, following, requests) show everyone's handle and badge. `displayName` and `avatarUrl` are
null when the viewer lacks full access; show the handle and a generic avatar.

| Method & path | Auth | Request | Response | Errors |
|---|---|---|---|---|
| `GET /api/users?q=` | public | `q` ≥ 2 chars. Matches handles, and display names of accounts whose name you may see | `UserSearchResponse` (`PersonRow[]`: person + your `follow` state) | |
| `GET /api/users/:handle` | public | none | `ProfileResponse`: a union on `access`. `"full"`: display name, photo, bio, counts `{posts, followers, following}`, `reputation` (yourself and moderators only), plans (`goingTonight`, mutual follows only). `"limited"`: handle, `verified`, `isPrivate: true`. Both carry `relationship` `{isSelf, follow, followsYou, mutual}` | 404 (missing, deleted, blocked; suspended except for moderators) |
| `GET /api/users/:handle/followers` | public | none | `PeopleListResponse` | 403 `private_account` (no full access), 404 |
| `GET /api/users/:handle/following` | public | none | `PeopleListResponse` | 403 `private_account`, 404 |
| `PUT /api/users/:handle/follow` | user | none | `FollowResponse` `{state}`: `"following"` (public account, instant) or `"requested"` (private account; they approve) | 400 (yourself), 403 (blocked), 404, 429 (60 follows or requests per hour) |
| `DELETE /api/users/:handle/follow` | user | none | `FollowResponse` `{state:"none"}`: unfollows or cancels a pending request | 404 |
| `POST /api/users/:handle/block` | user | none | `BlockResponse` | 400 (yourself), 404 |
| `DELETE /api/users/:handle/block` | user | none | `BlockResponse` | 404 |
| `POST /api/blocks` | user | `BlockAuthorRequest` `{targetType: PHOTO\|COMMENT, targetId}` | `BlockResponse`. Blocks the author without revealing who it is: use it for "Anonymous" authors | 400 (your own), 404 |

Switching from private to public doesn't approve pending requests: after `PATCH /api/me/profile {isPrivate:false}`,
if `pendingRequests > 0`, ask "Approve N pending requests?" and call `approve-all` on yes.

Blocking hides each side's photos, comments, and profile from the other, and removes follows and pending requests
both ways. It doesn't change any counts or consensus.

### Flags and moderation

| Method & path | Auth | Request | Response | Errors |
|---|---|---|---|---|
| `POST /api/flags` | user | `FlagRequest` `{targetType: PHOTO\|COMMENT\|REPORT\|USER, targetId, reason 3–300}` (USER: id or handle) | 201 `FlagResponse` (`autoHidden` when 3 eligible users flagged a photo) | 400 (own content), 404, 409 (already flagged), 429 (20/hour) |
| `GET /api/mod/queue` | mod | none | `ModQueueResponse` | 403 |
| `GET /api/mod/hidden` | mod | none | `ModHiddenResponse`: hidden content and suspended accounts, newest first, for Restore / Unsuspend (items leave the queue once their flags are resolved) | 403 |
| `GET /api/mod/log` | mod | none | `ModLogResponse` | 403 |
| `POST /api/mod/actions` | mod | `ModActionRequest`: content `HIDE\|DISMISS\|RESTORE`; accounts (`USER`) `SUSPEND\|UNSUSPEND\|DISMISS`; optional `note` | `ModActionResponse` | 400 (wrong action for the target), 403, 404, 409 (deleted author's photo) |

"Report" in the app is `POST /api/flags`. Use `targetType: "USER"` for "Report account" on a profile.

### Venue owners

| Method & path | Auth | Request | Response | Errors |
|---|---|---|---|---|
| `GET /api/owner/venues` | user | none | `OwnerOverviewResponse` | 401 |
| `GET /api/owner/venues/:id` | owner | none | `OwnerDashboardResponse` (includes the full venue page, promos, cover history, **anonymous** recent reports, hidden replies) | 403 |
| `PATCH /api/owner/venues/:id` | owner | `OfficialInfoRequest`: send **only changed** fields (`name, address, hours, officialCover, dressCode`) | `OfficialInfoResponse` | 400 (incl. unknown fields such as `accuracyScore`), 403 |
| `POST /api/owner/venues/:id/photo` | owner | multipart `photo` | `OfficialPhotoResponse` | 403, 411, 413, 415 |
| `POST /api/owner/venues/:id/promos` | owner | `PromoRequest` (`startsAt`/`endsAt` New York `YYYY-MM-DDTHH:MM`; ends in the future, starts ≤ 90 days out, ≤ 30 days long) | 201 `PromoResponse` | 400, 403 |
| `POST /api/owner/promos/:id/end` | owner | none | `PromoResponse` | 403 |
| `POST /api/claims` | user | `ClaimRequest` `{venueId}` | 201 `ClaimResponse` | 400 (staff), 409 (pending/approved) |

Owners can't post reports, photos, or top-level comments for their own venue, can't RSVP or check in there, and can't
edit or hide user content. They reply and flag instead:
- **Flag a live report** from `recentReports` (anonymous: no reporter identity): `POST /api/flags` with `{ targetType: "REPORT", targetId: report.id, reason }`.
- **Flag a photo or comment** from `page.live`: `POST /api/flags` with `targetType: "PHOTO"` or `"COMMENT"`.
- **Reply**: `POST /api/comments/:id/reply`.

### Admin (web only, not for the app)

| Method & path | Auth | Request | Response |
|---|---|---|---|
| `POST /api/admin/claims/:id` | admin | `{ approve: boolean }` | `AdminClaimResponse` |
| `PATCH /api/admin/promos/:id` | admin | `{ isPaid: boolean }` | `AdminPromoResponse` |
| `PATCH /api/admin/users/:handle` | admin | `{ geofenceExempt: boolean }` | `AdminUserFlagsResponse` |
| `GET /api/admin/users?q=` | admin | handle, name or email | `AdminUserSearchResponse` (real accounts, private or not) |
| `POST /api/admin/users/:handle/verification` | admin | `VerificationRequest` `{verified, note}` (note required, 3-300) | `VerificationResponse` (409 if unchanged) |
| `GET /api/admin/verification-log?handle=` | admin | none | `VerificationLogResponse` (append-only, newest first) |

### Ops

| Method & path | Auth | Response |
|---|---|---|
| `GET /api/health` | public | `HealthResponse` (503 when the DB is down) |
| `GET\|POST /api/cron/reputation` | cron (`Authorization: Bearer $CRON_SECRET`) | `CronResponse` (`skipped: true` if another run held the lock) |
| `POST /api/cron/featured` | cron (`Authorization: Bearer $CRON_SECRET`) | `FeaturedCronResponse` (`nights` featured by this run; safe late or twice; `failed` nights retry next run) |
| `GET /api/uploads/:key?exp=&sig=` | signed URL | image bytes (local storage driver only; with R2 the URLs point at R2) |

## App Review account

The seed creates `@appreview` (geofence-exempt) in preview. It can post from anywhere, so reviewers outside NYC can
test reporting, but nothing it posts is counted, and its photos and comments are visible only to itself.
