# Nostos editorial design handoff

## Current status

The current design lives in the Nostos Figma file. **Only pages 9 and 10 are current.** Earlier pages and earlier directions are preserved as history but are not implementation authority.

See `CURRENT-SCOPE.md` before doing design or UI implementation work.

## Direction

Current visual language is an expensive printed travel-journal/editorial treatment:

- warm ivory paper
- dark ink
- electric-blue accent
- restrained rules and print texture
- expressive serif editorial hierarchy with clear native controls
- real photos/runtime map data instead of schematic fixtures in production

The app theme has already moved toward this system even though the legacy file/token names in `mobile/src/theme/midnight.ts` remain.

## Behavior that the design must not overwrite

- signed-in personal product; no guest preview flow
- Passport / Stamp / Map navigation
- geofence verification remains server-authoritative
- maximum six stamp photos
- Take Photo opens the native iOS camera
- Photo Library selection is supported and locally validated
- accepted uploads are prepared with metadata stripped
- caption/song/draft/retry behavior stays intact
- native permissions, keyboard, safe areas, Dynamic Type, VoiceOver, and Reduce Motion remain first-class

## Figma versus runtime

Figma may show native camera/library/system prompts schematically, but the app must use the real iOS interfaces. Figma artwork for maps and example content is not runtime geography or user data.

When a current frame conflicts with an older design handoff, the current pages 9 and 10 win. When a visual frame conflicts with a server/product invariant, preserve the invariant and adapt the presentation.
