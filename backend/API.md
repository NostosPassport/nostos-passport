# Nostos API

The single source of truth for the iOS app. Every response shape below is a zod schema in
[`src/contracts/api.ts`](src/contracts/api.ts). Copy that file verbatim into the app, and parse responses with it.
It depends only on **zod v3**, so install `zod@^3.25` in the app, not v4, whose API differs.
`tests/integration/contracts.test.ts` calls every route and fails if a response drifts from those schemas, or if a
route exists without one.

A **stamp** is one visit to a **place**: a photo, a caption, a song, or any mix (at least one). Your **passport** is
your profile, a collection of stamps. (In the database a stamp is a row in `photo` and a place is a row in `venue`; the
API and the app say stamp and place.)

## Conventions

| | |
|---|---|
| Base URL | `EXPO_PUBLIC_API_URL`: local LAN URL in development, the Vercel preview URL for TestFlight, production for release |
| Format | JSON in and out, except stamp and avatar uploads (`multipart/form-data`) |
| Time | ISO-8601 UTC strings |
| Errors | `ErrorResponse` = `{ error: string, message: string }`. `message` is a human sentence written to be shown inline, as is |
| Paging | Lists return `nextBefore`, an opaque cursor. Pass it as `?before=` for the next page. `null` = the end |

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

- **Geofence**: a stamp needs the phone within the place's `geofenceMeters` (default **100 m**). Send current `lat`/`lng` with
  every stamp. Outside it you get 403 `forbidden`: "You need to be within 100 m of this place to stamp it (you're 140 m away)".
- **Cooldown**: one stamp per place every **15 minutes** (429 `rate_limited`), and **20 stamps an hour** across places.
- **Privacy**: a stamp or place of a private account is only returned to people with full access (see below). A stamp you
  may not see is a 404, never a 403, so its existence isn't revealed.
- **Feed**: chronological, newest first, from people you follow. No ranking, no personalization, no suggestions.
- **Objectionable text** returns 400 `objectionable_content` ("Your caption contains language we don't allow...").

### Who can see a person's stamps and places ("full access")

The author; staff (moderators and admins); anyone, when the account is public; an approved follower, when it is private.
**A pending follow request is not access.** A blocked pair (either direction) sees nothing of each other, staff excepted.
Accounts are private by default. Going public changes what strangers can see: **every stamp and place** becomes visible
to anyone, signed out included. The app must confirm that before switching.

`GET /api/users/:handle` returns `access: "limited"` (handle and badge only) or `access: "full"`. The stamp and place
lists return **403 `private_account`** without full access, and 404 when blocked.

### Attribution (ODbL)

Places imported from OpenStreetMap must be credited wherever they're shown. When `GET /api/places` returns a non-null
`attribution`, show `attribution.text` ("© OpenStreetMap contributors") on the map, linking to `attribution.url`.

### Photos and songs

Photo URLs are short-lived signed URLs (15-20 minutes): refetch rather than caching them long-term. EXIF and GPS are
stripped from every upload. A song is **metadata only** (title, artist, art URL); there is no audio. Song search is
proxied through the backend to Apple's public iTunes Search API with no user identifiers sent.

## Endpoints

### Auth and account

| Method and path | Body | Response |
|---|---|---|
| `POST /api/auth/signup` | `SignupRequest` | `TokenResponse` (with `X-Client: ios`), else cookie + `WebAuthResponse` |
| `POST /api/auth/login` | `LoginRequest` | same |
| `POST /api/auth/logout`, `/logout-all` | none | `OkResponse`, `LogoutAllResponse` |
| `GET /api/me` | | `MeResponse`: identity, role, pending follow requests, terms status |
| `POST /api/me/terms` | `AcceptTermsRequest` | `AcceptTermsResponse` |
| `POST /api/me/delete` | `DeleteAccountRequest` | `DeleteAccountResponse`: anonymizes the account, hides its stamps, removes the files |
| `GET`, `PATCH /api/me/profile` | `ProfileSettingsRequest` | `ProfileSettingsResponse` |
| `POST`, `DELETE /api/me/avatar` | multipart `photo` | `AvatarResponse` |
| `GET /api/me/activity` | | `ActivityResponse`: follow requests, new followers, likes on your stamps |
| `GET /api/me/following` | | `FollowingResponse` |
| `GET /api/me/blocks` | | `BlocksResponse` |

### Places

| Method and path | Response |
|---|---|
| `GET /api/places` | `PlacesResponse`: name, location, geofence. No live data |
| `GET /api/places/:id` | `PlaceResponse` (id or slug) |
| `GET /api/places/nearby?lat=&lng=` | `NearbyPlacesResponse`: inside or near the geofence, nearest first. The position is never stored |
| `POST /api/places/:id/stamps` | `CreateStampResponse` (201). multipart: optional `photo`, `caption`, `songTitle`, `songArtist`, `songArtUrl`, `songSourceId`, `lat`, `lng`, optional `rating` |

### Stamps, feed and passports

| Method and path | Body | Response |
|---|---|---|
| `GET /api/stamps/:id` | | `StampResponse` (404 unless visible) |
| `PATCH /api/stamps/:id` | `StampEditRequest`: caption and song only; frozen while a flag is open | `StampResponse` |
| `POST /api/stamps/:id/remove` | none | `RemoveStampResponse`: "delete from profile", final, never a hard delete |
| `PUT`, `DELETE /api/stamps/:id/like` | none | `LikeResponse`: one per person, not your own, not on hidden or removed stamps |
| `GET /api/feed?before=` | | `FeedResponse`: stamps from people you follow, newest first, 30 per page |
| `GET /api/users/:handle/stamps?before=` | | `UserStampsResponse` (403 `private_account`) |
| `GET /api/users/:handle/places` | | `UserPlacesResponse`: distinct places with stamp count and latest stamp |
| `GET /api/songs/search?q=` | | `SongSearchResponse`: signed in, rate limited (120 an hour) |

A `StampView` carries the author (always a full profile view), the place, the song, likes and `mine`. It never carries
coordinates, storage keys or user ids. `hidden` and `removed` are true only for staff.

### People

| Method and path | Response |
|---|---|
| `GET /api/users?q=` | `UserSearchResponse` (handle search; display names only where visible) |
| `GET /api/users/:handle` | `ProfileResponse` (counts: stamps, places, followers, following) |
| `PUT`, `DELETE /api/users/:handle/follow` | `FollowResponse`: public account -> `following`, private -> `requested` |
| `POST`, `DELETE /api/users/:handle/block` | `BlockResponse` |
| `GET /api/users/:handle/followers`, `/following` | `PeopleListResponse` (403 `private_account`) |
| `GET /api/me/follow-requests`, `POST /api/me/follow-requests/:handle`, `POST .../approve-all` | requests, decisions |
| `DELETE /api/me/followers/:handle` | `RemoveFollowerResponse` |

### Reports and moderation

| Method and path | Notes |
|---|---|
| `POST /api/flags` | `FlagRequest`: `targetType` `STAMP` or `USER`. You can only report a stamp you can see |
| `GET /api/mod/queue`, `/hidden`, `/log` | moderators only |
| `POST /api/mod/actions` | `HIDE`, `DISMISS`, `RESTORE` (stamps); `SUSPEND`, `UNSUSPEND`, `DISMISS` (accounts) |

Three flags from three eligible people (a regular account, 7+ days old, reputation 0.5+) auto-hide a stamp pending
review. Hidden stamps are never deleted, and every action is in the append-only moderation log.

### Web only

`PATCH /api/admin/users/:handle` (geofence-exempt flag), `GET /api/admin/users`, `POST /api/admin/users/:handle/verification`,
`GET /api/admin/verification-log`, `GET|POST /api/cron/maintenance` (daily housekeeping, `Bearer $CRON_SECRET`),
`GET /api/health`, `GET /api/uploads/*` (signed media URLs).
