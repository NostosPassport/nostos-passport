# Nostos current handoff

Updated 2026-10-08.

## Current state

Nostos is an iPhone-only personal passport for New York. The normal product experience requires an account. The previous guest `Look around first` preview flow has been removed from scope.

Primary app navigation is Passport, Stamp, and Map. Feed, follows, likes, Activity, public profiles, moderation, verification, and other social architecture have been removed from the active codebase. Passport, stamp, pin, place-history, profile, and neighborhood-progress data are owner-only.

The repository default branch is `main`. Ignore old handoff instructions that refer to `build`, `build-codex`, leaving a merge uncommitted, or a specific local checkout path.

## Stamp photos

The current stamp photo flow no longer uses the old custom in-app camera preview.

- `stamp/camera` manages the photo list.
- Take Photo opens the native iOS camera using `expo-image-picker`.
- Choose from Photo Library is supported.
- Library selections are validated locally using available metadata and stamp/place context.
- Accepted uploads are prepared with EXIF/GPS removed.
- Native camera captures receive the Nostos watermark.
- The app attempts to save accepted camera captures to Photos when add permission is available.
- Photos can be viewed, removed, and added up to the six-photo maximum before stamp creation.
- Photos cannot be appended remotely after a stamp has been created. Layout and final photo removal remain editable owner actions.

Relevant files:

- `mobile/src/app/(app)/stamp/camera.tsx`
- `mobile/src/features/photos/pick.ts`
- `mobile/src/features/photos/validate-library.ts`
- `mobile/src/features/photos/prepare.ts`
- `mobile/src/features/photos/save-camera-photo.ts`
- `mobile/src/features/stamps/photo-draft.ts`

## Backend and database

The current backend exposes only account/auth, owner profile/passport/stamp/pin/neighborhood endpoints, places, songs, media, health, and maintenance routes.

The Prisma schema no longer contains follows, follow requests, blocks, likes, reports, moderation events, verification events, staff roles, reputation, suspension state, private-account state, or stamp moderation state. A forward migration removes those objects from existing databases while retaining historical migration files.

`geofenceExempt` remains for App Review/QA accounts. Those stamps are accepted outside the geofence but are written `countable=false`.

## Design

Only Figma pages 9 and 10 are current. All prior Figma pages are historical.

The active visual language is the ivory/electric-blue editorial theme. The old `midnight.ts` filename and token names remain for compatibility, but the values have already migrated to the editorial palette.

See `DESIGN.md` and `design/editorial/CURRENT-SCOPE.md` before visual work.

## Local configuration

Committed defaults currently use:

- backend dev server: port 3001
- Docker Postgres host port: 5438
- Expo SDK 57

Do not copy old LAN IPs, process status, or QR codes from dated deliveries. They were valid only for those sessions.

## Verification note

The social-removal migration has been rehearsed successfully on an isolated Neon temporary branch. Production database application is a separate explicit step.

This handoff describes committed source structure, not proof of every runtime/device behavior. Use `mobile/DEVICE-CHECKLIST.md` for physical-device checks, and run the repository gate after pulling the branch locally.
