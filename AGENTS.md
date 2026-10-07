# Repository agent guidance

This file is current. Dated reviews, deliveries, old build prompts, and old `build-codex` instructions are historical unless the user explicitly asks to reproduce that state.

## Before changing anything

Read `README.md`, `CLAUDE.md`, `ENGINE.md`, `DESIGN.md`, and `HANDOFF.md`, plus any scoped `AGENTS.md` in the folder being changed.

Use the current repository state as the source of truth. Check code and package manifests before trusting an older handoff.

## Current scope

- Default branch: `main`.
- Mobile: Expo SDK 57, iOS only.
- Current design authority: Figma pages 9 and 10 only. Earlier Figma pages are historical.
- Current product is personal and owner-only. The old guest preview flow is removed from scope.
- Stamp photos may come from the native iOS camera or a validated Photo Library selection. Do not recreate the old custom `expo-camera` shutter UI.

## Working rules

- Follow explicit current user instructions over historical session notes.
- Do not rewrite dated files in `reviews/`, `deliveries/`, or `LEDGER.md` to make them look current.
- Do not edit generated native `ios/` or `android/` directories. Configure Expo native behavior through `app.json` and config plugins.
- For Expo/React Native APIs, inspect the installed package version and use the matching Expo SDK 57 documentation rather than memory.
- Use `npx expo install` for native Expo dependencies.
- Never commit secrets or `.env` files.
- Never run destructive database reset commands against shared, preview, or production data.
- Preserve server-side geofence enforcement, upload metadata stripping, content visibility rules, and account deletion behavior.
- Use targeted tests while iterating. For mobile implementation work, run `npm run check` before declaring it complete. Run broader repository checks when the change affects both lanes or shared contracts.
- Documentation-only edits do not require pretending runtime tests were executed.

## Handoffs

A current handoff should describe the repository as it exists now and identify any unverified runtime behavior. Never copy old process IDs, local IPs, stale branch names, or old test counts into a new current-status document.
