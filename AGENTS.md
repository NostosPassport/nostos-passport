# Repository agent guidance

This file is current. Historical reviews, deliveries, old build prompts, and old `build-codex` instructions live in git history and are not current instructions.

## Before changing anything

Read `README.md`, `CLAUDE.md`, `ENGINE.md`, `DESIGN.md`, and `HANDOFF.md`, plus any scoped `AGENTS.md` in the folder being changed.

Use the current repository state as the source of truth. Check code and package manifests before trusting an older handoff.

## Current scope

- Default branch: `main`.
- Mobile: Expo SDK 57, iOS only.
- Current design authority: Figma pages 9 and 10 only. Earlier Figma pages are historical.
- Current product is personal and private by default. User-created collections may be explicitly shared through signed, revocable, unlisted read-only web links. The master Passport cannot be shared. The old guest preview flow is removed from scope.
- A stamp is a visit memory. Users may add a `Now` or `Past` stamp. Past stamps are unverified and limited to the previous year; a Now stamp is verified only when the server can confirm the submitted current position is within the place geofence.
- Location is optional. Lack of location or being outside the geofence must not block stamp creation; it produces an unverified stamp instead.
- Verification applies to the visit, not to individual photos. Photo Library selections are not authenticity-gated by EXIF/source/time/location evidence.
- Stamp photos may come from the native iOS camera or Photo Library, may be edited after stamp creation, and remain capped at six. Do not recreate the old custom `expo-camera` shutter UI.

## Working rules

- Follow explicit current user instructions over historical session notes.
- Do not recreate historical review/delivery artifacts as current instructions; use git history when that evidence is needed.
- Do not edit generated native `ios/` or `android/` directories. Configure Expo native behavior through `app.json` and config plugins.
- For Expo/React Native APIs, inspect the installed package version and use the matching Expo SDK 57 documentation rather than memory.
- Use `npx expo install` for native Expo dependencies.
- Never commit secrets or `.env` files.
- Never run destructive database reset commands against shared, preview, or production data.
- Preserve server-side visit-verification decisions, upload metadata stripping, content visibility rules, account deletion behavior, and the rule that raw verification coordinates are not retained.
- Preserve collection-sharing boundaries: only persisted user-created collections can be shared; the master Passport has no sharing primitive; public resolution must expose only the selected collection and stop working immediately after revocation or deletion.
- Use targeted tests while iterating. For mobile implementation work, run `npm run check` before declaring it complete. Run broader repository checks when the change affects both lanes or shared contracts.
- Documentation-only edits do not require pretending runtime tests were executed.

## Handoffs

A current handoff should describe the repository as it exists now and identify any unverified runtime behavior. Never copy old process IDs, local IPs, stale branch names, or old test counts into a new current-status document.
