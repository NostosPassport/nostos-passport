# Nostos API

The Zod schemas in [`src/contracts/api.ts`](src/contracts/api.ts) are the API source of truth. The mobile app keeps an identical copy at `mobile/src/api/contracts.ts`, and the contract-sync test requires the files to remain byte-for-byte equal.

Nostos is owner-only. A signed-in account can read and mutate its own passport, stamps, pins, place history, profile, and neighborhood progress. There is no feed, follow graph, likes, people search, public/private passport mode, reporting, moderation, or staff-role API.

A **stamp** is one visit to a **place**. It can contain up to six photos, a caption, a song, or any combination of those, with at least one kind of content. In the database, stamps remain rows in `photo` and places remain rows in `venue` for migration continuity.

## Conventions

| | |
|---|---|
| Base URL | `EXPO_PUBLIC_API_URL` in the mobile app |
| Format | JSON, except stamp/avatar/photo uploads use `multipart/form-data` |
| Time | ISO-8601 UTC strings |
| Errors | `{ error: string, message: string }` |
| Passport paging | `nextAfter` is an opaque visit-date cursor passed back as `?after=`; `null` means the end |

### iOS authentication

Production authentication is passwordless and uses one-time email codes.

1. Start sign-up with `POST /api/auth/signup/start`, or sign-in with `POST /api/auth/login/start`.
2. Submit the returned challenge id plus the six-digit code to `POST /api/auth/signup` or `POST /api/auth/login`.
3. With `X-Client: ios`, completion returns `{ token, expiresAt, user }`.
4. Store the token in the iOS keychain and send `Authorization: Bearer <token>` on authenticated requests.
5. A 401 `invalid_token` means the client must clear the token and return to sign-in.

Web sessions use an httpOnly SameSite=Lax cookie instead. Bearer tokens and web cookies are channel-bound.

Development seed accounts may use the development-only password fallback on `POST /api/auth/login`. Production accounts do not store a password.

### Server-enforced rules

The client must not duplicate these as security checks:

- **Visit verification:** `mode=now` stamps are marked verified only when valid current coordinates are supplied and fall within the selected place's `geofenceMeters`, normally 100 m. Missing location or an out-of-geofence position does not reject the stamp; it creates an unverified visit. `geofenceExempt` is reserved for App Review/QA accounts; those stamps are `countable=false` and unverified.
- **Past visits:** `mode=past` requires `visitedAt`, never receives visit verification, must not be in the future, and may be at most one year old.
- **Visit-date edits:** a user may edit `visitedAt` within the same one-year/future bounds. Moving a verified visit to another New York calendar day clears verification.
- **Coordinate minimization:** coordinates submitted for verification are used for the server-side geofence decision and are not retained on the stamp.
- **Cooldown/rate limit:** one new stamp per place every 15 minutes and 20 stamps per hour across places.
- **Ownership:** another account receives 404 for an owner's stamp/passport/place-history resources.
- **Removal:** deleting a stamp means setting final `removed_at`; the content row is retained and cannot be restored.
- **Images:** uploads are decoded and re-encoded; EXIF/GPS metadata is stripped.
- **Sensitive data:** stamp payloads never expose raw storage keys or internal user ids.
- **Age gate:** sign-up eligibility is checked before a sign-up email challenge is created; birthdate is not persisted.
- **Text filtering:** blocked text is rejected with `objectionable_content`.

### OpenStreetMap attribution

When `GET /api/places` returns non-null `attribution`, display the supplied OpenStreetMap attribution text and link wherever the imported place data is shown.

## Endpoints

### Auth and account

| Method and path | Body | Response |
|---|---|---|
| `POST /api/auth/signup/start` | `SignupStartRequest` | `EmailChallengeResponse` |
| `POST /api/auth/signup` | `SignupRequest` | `TokenResponse` on iOS, otherwise cookie + `WebAuthResponse` |
| `POST /api/auth/login/start` | `LoginStartRequest` | `EmailChallengeResponse` |
| `POST /api/auth/login` | `LoginRequest` | `TokenResponse` on iOS, otherwise cookie + `WebAuthResponse` |
| `POST /api/auth/logout` | none | `OkResponse` |
| `POST /api/auth/logout-all` | none | `LogoutAllResponse` |
| `GET /api/me` | none | `MeResponse` |
| `POST /api/me/terms` | `AcceptTermsRequest` | `AcceptTermsResponse` |
| `POST /api/me/email/start` | `EmailChangeStartRequest` | `EmailChallengeResponse` |
| `PATCH /api/me/email` | `EmailChangeRequest` | `EmailChangeResponse` |
| `POST /api/me/delete/start` | none | `EmailChallengeResponse` |
| `POST /api/me/delete` | `DeleteAccountRequest` | `DeleteAccountResponse` |
| `GET /api/me/profile` | none | `ProfileSettingsResponse` |
| `PATCH /api/me/profile` | `ProfileSettingsRequest` | `ProfileSettingsResponse` |
| `POST /api/me/avatar` | multipart `photo` | `AvatarResponse` |
| `DELETE /api/me/avatar` | none | `AvatarResponse` |
| `GET /api/me/pins` | none | `PinsResponse` |
| `PUT /api/me/pins` | `PinsRequest` | `PinsResponse` |
| `GET /api/me/neighborhoods` | none | `NeighborhoodIndexResponse` |

Account deletion requires a fresh email challenge for the account's current email. It revokes sessions, anonymizes identity fields, clears profile media, marks live stamps removed, and deletes stored photo/avatar files.

### Places

| Method and path | Response |
|---|---|
| `GET /api/places` | `PlacesResponse` |
| `GET /api/places/:id` | `PlaceResponse` (`:id` may be id or slug) |
| `GET /api/places/nearby?lat=&lng=` | `NearbyPlacesResponse`, nearest first with `distanceM` and `inside` |
| `GET /api/places/:id/mine?lat=&lng=` | `MyPlacePageResponse`, containing only the signed-in owner's stamps at that place |
| `POST /api/places/:id/stamps` | `CreateStampResponse` |

Stamp creation is multipart. It accepts repeated `photos` fields, `caption`, optional song metadata (`songTitle`, `songArtist`, `songArtUrl`, `songSourceId`), optional internal `rating`, and:

- `mode=now`: optional `lat`/`lng`. If both are present, valid, and inside the venue geofence, the returned stamp has `verified=true`; otherwise it is created unverified.
- `mode=past`: required `visitedAt`; any submitted location is ignored for verification and the stamp is unverified.

A stamp must contain a photo, non-empty caption, or song.

### Stamps and passport

| Method and path | Body | Response |
|---|---|---|
| `GET /api/stamps/:id` | none | `StampResponse`, owner only |
| `PATCH /api/stamps/:id` | `StampEditRequest` (`caption`, `song`, and/or `visitedAt`) | `StampResponse` |
| `POST /api/stamps/:id/photos` | multipart repeated `photos`/`photo` | `StampResponse` |
| `PATCH /api/stamps/:id/photos` | `PhotoLayoutRequest` | `StampResponse` |
| `POST /api/stamps/:id/photos/:photoId/remove` | none | `StampResponse` |
| `POST /api/stamps/:id/remove` | none | `RemoveStampResponse` |
| `GET /api/users/:handle/stamps?after=` | none | `UserStampsResponse`, only when `:handle` is the signed-in owner |
| `GET /api/users/:handle/places` | none | `UserPlacesResponse`, only when `:handle` is the signed-in owner |

The `/api/users/:handle/...` path is retained for client stability, but it is not a social API. The service verifies that the requested handle belongs to the authenticated account.

`StampView` includes stamp content, signed photo URLs, page/slot placement, `createdAt`, `visitedAt`, nullable `verifiedAt`, boolean `verified`, edit time, and a place reference. It does not include raw verification coordinates or author/social/moderation fields.

Passport ordering, page/slot placement, place visit groups, and user-facing visit dates use `visitedAt`. `createdAt` remains record-creation metadata.

Owners may add photos after creation until the six-live-photo limit. Layout (`position`, `x`, `y`, `rotation`) may be edited later. Removing a photo sets final `removed_at`; photo rows are retained. Removing the final photo is refused if it would leave the stamp without a caption or song.

Nostos verifies the visit, not individual photo provenance. The server does not require Photo Library EXIF location/time/source evidence.

### Songs

| Method and path | Response |
|---|---|
| `GET /api/songs/search?q=` | `SongSearchResponse` |

Song search proxies metadata from Apple's iTunes Search API. No audio is stored or served by Nostos.

### Operations and media

| Method and path | Notes |
|---|---|
| `GET /api/health` | Health check, including database status |
| `GET`, `POST /api/cron/maintenance` | Maintenance endpoint protected by `Bearer $CRON_SECRET` |
| `GET /api/uploads/*` | Local-development signed media URL handler |

Production/preview media may use the configured object-storage provider instead of the local upload route.
