# Nostos current handoff

Updated 2026-10-08.

## Current state

Nostos is an iPhone-only personal passport for New York. The normal product experience requires an account. The previous guest `Look around first` preview flow has been removed from scope.

Primary app navigation is Passport, Stamp, and Map. Feed, follows, likes, Activity, public profiles, moderation, and other social architecture are not part of the active product. Passport, stamp, pin, place-history, profile, and neighborhood-progress data are owner-only.

The repository default branch is `main`. Ignore old handoff instructions that refer to `build`, `build-codex`, leaving a merge uncommitted, or a specific local checkout path.

## Stamp visits and verification

The current trust model verifies visits rather than photographs.

- Users choose `Now` or `Past` when making a stamp.
- A Now stamp is marked verified only when the server receives valid current coordinates and confirms the device is within the selected place geofence.
- Location is optional. No location or an out-of-geofence position still creates a normal unverified stamp.
- Past stamps are always unverified, are limited to one year back, and cannot be dated in the future.
- Owners can edit the visit date. Moving a verified stamp to a different New York calendar day removes its verification.
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

Relevant files:

- `mobile/src/app/(app)/stamp/new.tsx`
- `mobile/src/app/(app)/stamp/camera.tsx`
- `mobile/src/app/(app)/stamp/edit.tsx`
- `mobile/src/features/photos/pick.ts`
- `mobile/src/features/photos/prepare.ts`
- `mobile/src/features/photos/save-camera-photo.ts`
- `mobile/src/features/stamps/photo-draft.ts`
- `backend/src/server/services/stamps.ts`

`mobile/src/features/photos/validate-library.ts` is historical implementation code from the old photo-authentication model and must not be reintroduced as an acceptance gate.

## Backend and database

The backend exposes account/auth, owner profile/passport/stamp/pin/neighborhood endpoints, places, songs, media, health, and maintenance routes.

The Prisma `photo` table remains the historical backing table for stamps. The current model adds `visited_at` and nullable `verified_at`; legacy `lat`/`lng` columns remain nullable for migration stability but a database constraint requires them to be null. A forward migration also removes the old creation-only stamp-photo trigger and replaces the old parent-only content check with a deferred cross-table content invariant.

The Prisma schema does not contain follows, follow requests, blocks, likes, reports, moderation events, staff roles, reputation, suspension state, private-account state, or stamp moderation state.

## Design

Only Figma pages 9 and 10 are current. All prior Figma pages are historical.

The active visual language is the ivory/electric-blue editorial theme. Verified visits use the Nostos mark as a positive seal. Unverified status is intentionally understated and must not look like an error state.

See `DESIGN.md` and `design/editorial/CURRENT-SCOPE.md` before visual work.

## Local configuration

Committed defaults currently use:

- backend dev server: port 3001
- Docker Postgres host port: 5438
- Expo SDK 57

Do not copy old LAN IPs, process status, or QR codes from dated deliveries. They were valid only for those sessions.

## Verification note

The visit-verification work is being developed on `feature/visit-verification` with draft PR #5. The forward database migration must be rehearsed on an isolated database branch before production application. Runtime/device behavior still requires the normal repository gate and physical-device checklist before release.
