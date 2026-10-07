# Nostos design

## Current authority

Only Figma pages **9 and 10** in the Nostos UI exploration are current design references. Earlier Figma pages, including the black/silver exploration and the original black/brass passport direction, are historical and must not be treated as implementation authority.

The app is being migrated screen by screen to the current editorial system. Existing behavior and data contracts should be preserved while layouts are updated.

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
- `mobile/src/app/(app)/place/[id].tsx`
- settings and account routes

The old guest preview route is no longer part of the app's root navigation.

## Photo flow

The `stamp/camera` route is now a photo-management screen, not a custom live camera preview.

- Add Photo opens a native iOS action sheet.
- Take Photo launches the Apple/system camera through `expo-image-picker`.
- Choose from Photo Library is supported.
- Selected library photos must pass local validation using available capture/source/time/location metadata.
- Accepted photos are prepared for upload, and upload preparation strips EXIF/GPS.
- Camera captures receive the Nostos watermark and may be saved to Photos when permission allows.
- Users can open, remove, and add photos until the six-photo limit.

Do not use historical references to `CameraView`, a custom shutter, or camera-only stamp photos as current design requirements.

## Implementation principles

- Current Figma pages 9 and 10 control visual direction.
- Existing hooks, server contracts, accessibility behavior, geofence logic, photo rules, and navigation semantics should survive visual migrations.
- Use theme tokens rather than one-off colors.
- Respect iOS safe areas, Dynamic Type, VoiceOver, keyboard avoidance, and minimum touch targets.
- Reduced Motion must remain functional where motion exists.
- The map must use real runtime map/location data, not schematic design artwork.
- Design screenshots are references, not proof that native behavior works.

## Historical material

`design/figma/`, older editorial notes, passport/Blender onboarding notes, dated reviews, and deliveries document earlier directions or implementation states. They remain useful provenance but are superseded when they conflict with this file or current Figma pages 9 and 10.
