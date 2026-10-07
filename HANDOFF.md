# Nostos current handoff

Updated 2026-10-07.

## Current state

Nostos is an iPhone-only personal passport for New York. The normal product experience requires an account. The previous guest `Look around first` preview flow has been removed from scope.

Primary app navigation is Passport, Stamp, and Map. Social routes/code may remain behind feature flags, but social behavior is not part of the current personal product.

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
- Photos can be viewed, removed, and added up to the six-photo maximum.

Relevant files:

- `mobile/src/app/(app)/stamp/camera.tsx`
- `mobile/src/features/photos/pick.ts`
- `mobile/src/features/photos/validate-library.ts`
- `mobile/src/features/photos/prepare.ts`
- `mobile/src/features/photos/save-camera-photo.ts`
- `mobile/src/features/stamps/photo-draft.ts`

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

## Documentation status

Current docs have been reconciled with the current code. Historical build prompts and old Figma onboarding docs are explicitly superseded. Dated reviews, deliveries, ledgers, and logs remain unchanged as historical evidence.

## Verification note

This handoff describes the current committed source. Documentation cleanup itself does not prove native camera behavior, Photo Library validation on every asset type, device permissions, animation performance, VoiceOver, or real-world geofence behavior. Use `mobile/DEVICE-CHECKLIST.md` for current physical-device checks.
