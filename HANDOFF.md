# Nostos current handoff

Updated 2026-10-20.

## Current state

Nostos is an iPhone-only personal passport for the places a user goes. The normal product experience requires an account and is private by default. The previous guest `Look around first` preview flow has been removed from scope.

Primary app navigation is Passport, Stamp, and Map. Feed, follows, likes, Activity, public profiles, moderation, and other social architecture are not part of the active product. User-created collections may be explicitly shared through signed, revocable, unlisted read-only web links. The master Passport cannot be shared.

Google-backed restaurant and bar discovery is worldwide. Durable venues carry optional `area`, `city`, `region`, `country`, and `countryCode` locality metadata plus an IANA `timeZone`. The former NYC neighborhood polygon/completion system has been removed rather than retained as a product layer.

The repository default branch is `main`. Ignore old handoff instructions that refer to `build`, `build-codex`, leaving a merge uncommitted, or a specific local checkout path.

## Collection sharing

- Sharing applies only to persisted user-created `Collection` rows. There is no master-Passport share model, nullable collection target, or special master identifier.
- Each collection can have at most one active `CollectionShare` record. Enabling an already-shared collection preserves the same URL; disabling sharing deletes the share record and invalidates the old URL immediately.
- Public URLs use a signed `cs1` token derived from the share-row ID and `SHARE_TOKEN_SECRET`; a reusable bearer token is not stored in plaintext in the database.
- Shared pages live at `/c/[token]`, require no account, are read-only, dynamically rendered, and configured `noindex`/`nofollow`.
- The public resolver loads only the stamps currently belonging to the selected collection. Collection edits, reorderings, removals, deleted stamps, collection deletion, and account deletion are reflected live.
- Photo storage remains private. A valid shared collection view receives the existing short-lived signed media URLs after authorization.
- The owner can create/share or disable the web link from the collection screen in the iOS app using the native share sheet.

Relevant files:

- `backend/prisma/schema.prisma`
- `backend/src/server/services/collection-sharing.ts`
- `backend/src/app/api/collections/[id]/share/route.ts`
- `backend/src/app/c/[token]/page.tsx`
- `mobile/src/app/(app)/collections/[id]/share.tsx`
- `mobile/src/app/(app)/collections/[id].tsx`

## Places and locality

- Google Places is the discovery source for restaurants and bars.
- Nearby search uses the location supplied for that request and is not constrained to NYC or the United States.
- Text search is not given an artificial NYC fallback or forced US region code. When a real device-location bias is available it may still be used to improve relevance.
- Google `addressComponents` are normalized into optional `area`, `city`, `region`, `country`, and `countryCode` fields in the same Places request; no extra reverse-geocoding call is required.
- `area` is descriptive and may represent a neighborhood, district, sublocality, quartiere, or similar local label. It is optional and must never gate whether a place can exist.
- Each durable venue also stores an IANA `timeZone`, used for visit-date grouping and verification-preserving calendar-day logic.
- Existing NYC venue rows are backfilled to New York / United States / `America/New_York` while preserving their old neighborhood label as `area` when available.
- The old `neighborhood`, `neighborhoodId`, `Neighborhood`, `NeighborhoodCompletion`, `/api/me/neighborhoods`, polygon import scripts, and completion UI/contracts have been removed.
- The Passport cover uses universal STAMPS and PLACES counts rather than geographic completion metrics.

## Stamp visits and verification

The current trust model verifies visits rather than photographs.

- Users choose `Now` or `Past` when making a stamp.
- A Now stamp is marked verified only when the server receives valid current coordinates and confirms the device is within the selected place geofence.
- Location is optional. No location or an out-of-geofence position still creates a normal unverified stamp.
- Past stamps are always unverified, are limited to one year back, and cannot be dated in the future.
- Owners can edit the visit date. Moving a verified stamp to a different calendar day in that venue's local time zone removes its verification.
- Passport page/slot chronology uses `visited_at`, not record creation time.
- Raw coordinates used to make the geofence decision are not retained on the stamp. The durable trust fields are `verified_at` and the visit date.
- `geofenceExempt` remains for App Review/QA accounts. Those stamps remain `countable=false` and are not verified.

## Stamp photos

The stamp photo flow does not use the old custom in-app camera preview.

- `stamp/camera` manages the pre-creation photo list.
- Take Photo opens the native iOS camera using `expo-image-picker`.
- Choose from Photo Library is supported without EXIF/source/time/location authenticity gating.
- Accepted uploads are re-encoded with EXIF/GPS removed.
- Native camera captures receive a subtle Nostos watermark and may be saved to Photos when permission allows.
- Up to six live photos may be attached to a stamp.
- Owners may add, remove, and rearrange photos after the stamp has been created.
- The Nostos camera watermark indicates capture through Nostos; it is not a claim that the image itself was authenticated.

## Backend and database

The backend exposes account/auth, owner profile/passport/stamp/pin/collection endpoints, owner-controlled collection-share endpoints, the public collection-share web resolver, worldwide places, songs, media, health, and maintenance routes.

The Prisma `photo` table remains the historical backing table for stamps. Legacy `lat`/`lng` columns remain nullable for migration stability but a database constraint requires them to be null. Collection sharing adds a narrow one-to-one `collection_share` table related only to `collection`.

The Prisma schema does not contain follows, follow requests, blocks, likes, reports, moderation events, staff roles, reputation, suspension state, private-account state, stamp moderation state, neighborhood polygons, or neighborhood completion records.

## Design

Only Figma pages 9 and 10 are current. All prior Figma pages are historical.

The active visual language is the ivory/electric-blue editorial theme. Verified visits use the Nostos mark as a positive seal. Unverified status is intentionally understated and must not look like an error state.

See `DESIGN.md` and `design/editorial/CURRENT-SCOPE.md` before visual work.

## Local configuration

Committed defaults currently use:

- backend dev server: port 3001
- Docker Postgres host port: 5438
- Expo SDK 58 / React Native 0.88
- local development share URLs at `http://localhost:3001` unless `PUBLIC_WEB_URL` is set

Preview/production must provide a unique `SHARE_TOKEN_SECRET` in addition to the existing backend secrets.

## Verification note

For worldwide-place changes, run the normal backend/mobile checks and the backend tests against a migrated local Postgres database. A useful manual smoke test is searching for a restaurant or bar outside the United States, persisting it through a Past stamp, and confirming its `area`/city/country/time-zone metadata is stored and rendered correctly.
