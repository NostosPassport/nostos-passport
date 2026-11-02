# Nostos current project context

Read `README.md`, `AGENTS.md`, `ENGINE.md`, `DESIGN.md`, and `HANDOFF.md` before substantial work.

## Product

Nostos is an iPhone-only personal passport for the places a user goes. A signed-in user saves a place visit as a stamp. A stamp can contain up to six photos, a caption, a song, or a combination.

Users choose `Now` or `Past` when creating a stamp. A Now stamp may be location verified when the server confirms the current device position is inside the selected place geofence. Location is optional: missing location or an out-of-geofence position produces a normal unverified stamp instead of blocking creation. Past stamps are unverified, may be dated up to one year back, and cannot use a future date. Visit dates can be edited later; changing the calendar day of a verified stamp removes verification.

Google-backed restaurant and bar discovery is worldwide. Durable place locality uses optional `area`, `city`, `region`, `country`, and `countryCode` metadata from Google Places plus an IANA `timeZone`. `area` is descriptive and may represent a neighborhood, district, sublocality, quartiere, or similar label; it is not a required hierarchy. The old NYC neighborhood polygon tables, completion records, API, and required venue neighborhood fields have been removed.

The product is private by default. User-created collections may be explicitly shared through signed, revocable, unlisted read-only web links. The master Passport cannot be shared. Feed, follows, likes, Activity, other-user passports, public profiles, moderation/admin social tooling, pinning, and guest preview are not part of the product or active architecture.

## Photos

Stamp photos use system photo interfaces:

- `expo-image-picker` opens the native iOS camera or Photo Library.
- Verification applies to the visit, not individual photos. Library selections are not rejected based on EXIF, source, time, location, screenshot status, or editing software.
- Prepared uploads are re-encoded and have EXIF/GPS stripped.
- Camera captures receive a subtle Nostos watermark and may be saved to Photos when permission allows.
- Maximum six live photos per stamp.
- Owners can add, remove, and reorder photos after stamp creation.

Do not rebuild the old custom `expo-camera` CameraView/shutter flow unless the user explicitly changes direction.

## Design

Only Figma pages 9 and 10 are current. Earlier Figma explorations are historical.

The active design language is editorial: warm cream paper, dark ink, and electric blue accent. The theme is implemented in `mobile/src/theme/editorial.ts`; the app background is `#F3EFE5`, raised paper is `#F7F4EE`, deeper paper is `#EEE9DD`, and the primary accent is `#123BFF`.

Verified visits use the Nostos mark as a positive verification seal. On stamp detail surfaces, verification status belongs with compact bottom metadata. Unverified status is intentionally low-emphasis fine print and must not read as an error or punishment.

## Repository

- Default branch: `main`.
- `backend/`: Next.js 15, Prisma, Postgres.
- `mobile/`: Expo SDK 58, Expo Router, React Native.
- Historical review/delivery artifacts and superseded build prompts are retained in git history rather than the working tree.

Current local defaults in committed configuration:

- backend dev server: port 3001
- Docker Postgres host port: 5438

## Invariants

Preserve these unless the user explicitly changes product behavior and the corresponding tests/contracts are updated:

1. Visit verification is decided server-side from submitted current coordinates and the venue geofence. Outside/no-location Now stamps remain valid but unverified. `geofenceExempt` remains the App Review/QA exception.
2. Raw device coordinates used for visit verification are not retained on stamps. The stored trust artifact is verification status/time.
3. One account never receives another account's master Passport, private collection, stamp, place-history, or profile data. The only cross-account/signed-out stamp visibility is an explicitly enabled collection share link, which exposes only that collection's current stamps through the dedicated read-only web resolver.
4. The master Passport has no sharing primitive. Share records may reference only persisted `Collection` rows, are owner-controlled, and must become unavailable immediately when disabled or when their collection/account is deleted.
5. Removing a stamp is final and retained as `removed_at`; user content is not silently hard-deleted.
6. Uploaded images are re-encoded so EXIF/GPS does not survive the upload.
7. Raw storage keys and internal user identifiers are not exposed in normal API payloads or shared collection pages.
8. Under-age signup handling must remain consistent with the current age-gate implementation and legal review requirements.
9. Contract copies between backend and mobile must stay synchronized.
10. Passport chronology and page/slot assignment use `visited_at`, not database creation time.
11. Place discovery is worldwide. A place does not need an `area`, city hierarchy, or membership in a Nostos-maintained geographic polygon to be discovered, persisted, or stamped.

## Engineering rules

Use current code and tests as truth. Old review test counts and local paths are historical evidence only. Never commit secrets. Never reset shared or production databases. For Expo APIs, check the installed SDK 58 docs. For mobile code changes, run `npm run check` before declaring completion.
