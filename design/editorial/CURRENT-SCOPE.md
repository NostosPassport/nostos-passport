# Current design scope

Updated 2026-10-20.

## Authority

Only Figma pages **9 and 10** in `Nostos · UI exploration` are current design authority.

Earlier Figma pages, the black/silver exploration, the original black/brass passport direction, and earlier five-screen-only scopes are historical. Do not implement from those older pages unless the user explicitly asks for comparison or restoration.

## Current direction

The active direction is the refined editorial Nostos system: warm cream/paper surfaces, dark ink, and electric-blue accent, with restrained print/travel-journal character.

The native theme lives in `mobile/src/theme/editorial.ts`. The app background is `#F3EFE5`, raised paper is `#F7F4EE`, deeper paper is `#EEE9DD`, and the electric-blue accent is `#123BFF`.

## Product behavior to preserve

Visual work must preserve the current app behavior and contracts:

- account-required app experience; no guest preview flow
- Passport / Stamp / Map navigation
- server-side geofence verification
- up to six stamp photos
- native iOS camera capture
- validated Photo Library selection
- caption/song attachment and draft preservation
- passport/memory navigation
- map/place runtime data and attribution
- accessibility, safe areas, Dynamic Type, keyboard handling, and Reduce Motion

The stamp photo manager is not a custom camera surface. Native camera and Photo Library interfaces come from iOS.

## Implementation note

Design files are visual authority, not proof of runtime behavior. Reuse existing hooks/actions/contracts. Do not invent endpoints or replace native system UI with mock Figma versions.
