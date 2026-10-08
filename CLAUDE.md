# Nostos current project context

Read `README.md`, `AGENTS.md`, `ENGINE.md`, `DESIGN.md`, and `HANDOFF.md` before substantial work.

## Product

Nostos is an iPhone-only personal passport for New York. A signed-in user visits a place and creates a stamp. A stamp can contain up to six photos, a caption, a song, or a combination. The server verifies the submitted location against the place geofence.

Current product scope is owner-only. Social code may remain behind feature flags for historical compatibility, but Feed, follows, likes, Activity, other-user passports, and guest preview are not part of the current product experience.

The old `Look around first` guest flow is removed. Signed-out users are routed to sign in or sign up.

## Photos

Stamp photos use the system photo interfaces:

- `expo-image-picker` `launchCameraAsync()` opens the native iOS camera.
- Photo Library selection is supported.
- Library photos are locally checked with available EXIF/source/time/location evidence before acceptance.
- Prepared uploads are re-encoded and have EXIF/GPS stripped.
- Camera captures receive the Nostos watermark and may be saved to Photos when permission allows.
- Maximum six photos per stamp.

Do not rebuild the old custom `expo-camera` CameraView/shutter flow unless the user explicitly changes direction.

## Design

Only Figma pages 9 and 10 are current. Earlier Figma explorations are historical.

The active design language is editorial: warm ivory paper, dark ink, and electric blue accent. `mobile/src/theme/midnight.ts` keeps its historical filename for import stability, but its exported theme is now Editorial.

## Repository

- Default branch: `main`.
- `backend/`: Next.js 15, Prisma, Postgres.
- `mobile/`: Expo SDK 57, Expo Router, React Native.
- Historical review/delivery artifacts and superseded build prompts are retained in git history rather than the working tree.

Current local defaults in committed configuration:

- backend dev server: port 3001
- Docker Postgres host port: 5438

## Invariants

Preserve these unless the user explicitly changes product behavior and the corresponding tests/contracts are updated:

1. Stamp geofence acceptance is enforced server-side.
2. Personal mode does not expose another person's passport data.
3. Hidden/removed content follows existing retention and moderation rules rather than being silently hard-deleted.
4. Uploaded images are re-encoded so EXIF/GPS does not survive the upload.
5. Sensitive coordinates, raw storage keys, and internal user identifiers are not exposed in normal viewer payloads.
6. Under-age signup handling must remain consistent with the current age-gate implementation and legal review requirements.
7. Contract copies between backend and mobile must stay synchronized.

## Engineering rules

Use current code and tests as truth. Old review test counts and local paths are historical evidence only. Never commit secrets. Never reset shared or production databases. For Expo APIs, check the installed SDK 57 docs. For mobile code changes, run `npm run check` before declaring completion.
