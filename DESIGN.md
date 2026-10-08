# Nostos design

## Current authority

Only Figma pages **9 and 10** in the Nostos UI exploration are current design references. Earlier Figma pages, including the black/silver exploration and the original black/brass passport direction, are historical and must not be treated as implementation authority.

The app is being migrated screen by screen to the current editorial system. Existing behavior and data contracts should be preserved while layouts are updated, except where current approved product decisions explicitly replace older behavior.

## Editorial visual language

The current shared theme is implemented in `mobile/src/theme/midnight.ts`. The filename is historical and intentionally retained for import stability. The exported theme name is `Editorial`.

Current core colors:

| Role | Value |
|---|---|
| paper/background | `#F7F4EE` |
| raised paper | `#F3EFE5`, `#EEE9DD` |
| ink | `#171714` |
| secondary ink | `#5A5A55` |
| electric-blue accent | `#123BFF` |
| danger | `#B3261E` |

Some token names such as `brass`, `bone`, and `midnight` are legacy identifiers. Their names do not describe the current colors and should not be used as evidence that black/brass is still the active direction.

Typography currently uses Cormorant Garamond, Courier Prime, and the system sans in the native app. Figma may use visually compatible fonts for specific editorial compositions. Match the approved current frames rather than old font notes.

## Current product surfaces

Primary navigation is Passport, Stamp, and Map.

Important current routes include:

- `mobile/src/app/(app)/(tabs)/passport.tsx`
- `mobile/src/app/(app)/(tabs)/map.tsx`
- `mobile/src/app/(app)/stamp/new.tsx`
- `mobile/src/app/(app)/stamp/camera.tsx`
- `mobile/src/app/(app)/stamp/landed.tsx`
- `mobile/src/app/(app)/stamp/[id].tsx`
- `mobile/src/app/(app)/stamp/edit.tsx`
- `mobile/src/app/(app)/place/[id].tsx`
- settings and account routes

The old guest preview route is no longer part of the app's root navigation.

## Stamp trust hierarchy

Nostos verifies **visits, not photographs**.

- `Now` means the user is adding a current visit. If current device location is available and the server confirms proximity to the venue, the visit receives the Nostos verification seal.
- A Now stamp still works without location or outside the verification radius; it is simply unverified.
- `Past` means a historical memory from the previous year. Past stamps are always unverified.
- Verified status is a positive treatment. Use the Nostos mark prominently enough to feel collectible and trustworthy.
- Unverified is neutral, not a warning state. It should be absent from the Passport stamp face and appear only as low-emphasis fine print where explanation is useful.
- Changing the calendar day on a verified stamp removes verification.

## Photo flow

The `stamp/camera` route is a photo-management screen, not a custom live camera preview.

- Add Photo opens a native iOS action sheet.
- Take Photo launches the Apple/system camera through `expo-image-picker`.
- Choose from Photo Library is supported.
- Photo Library images are memories attached to the visit. Do not reject them based on EXIF GPS, timestamp, source application, screenshot status, or editing software.
- Accepted photos are prepared for upload, and upload preparation strips EXIF/GPS.
- Camera captures receive a subtle Nostos watermark and may be saved to Photos when permission allows.
- Users can open, add, remove, and reorder photos up to six, including after stamp creation.
- The camera watermark indicates a photo was captured through Nostos. It does not mean Nostos authenticated the content of the image.

Do not use historical references to `CameraView`, a custom shutter, camera-only stamp photos, or EXIF-gated Photo Library selection as current design requirements.

## Implementation principles

- Current Figma pages 9 and 10 control visual direction.
- Use theme tokens rather than one-off colors.
- Respect iOS safe areas, Dynamic Type, VoiceOver, keyboard avoidance, and minimum touch targets.
- Reduced Motion must remain functional where motion exists.
- The map must use real runtime map/location data, not schematic design artwork.
- Design screenshots are references, not proof that native behavior works.
- Location permission is optional. UI must never imply that the app is unusable without it.
- Passport chronology follows the user's visit date, not the time the database record was created.

## Historical material

`design/figma/`, older editorial notes, passport/Blender onboarding notes, dated reviews, and deliveries document earlier directions or implementation states. They remain useful provenance but are superseded when they conflict with this file or current Figma pages 9 and 10.
