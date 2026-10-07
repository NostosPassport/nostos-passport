# Nostos Figma UI exploration

2026-10-02. Resumed after user stop. Current scope replaces Blender work with Figma app UI design, as explicitly requested by the user in the reviewer chat and relayed here. Existing Blender sources and renders remain preserved. No app implementation authorized.

## Access and source

- Figma MCP read-only account check succeeded for Charles, Full seat. Correction: existing blueprints are LOCAL, not in Figma. Do not request a source Figma link.
- Created destination successfully: https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj (Nostos · UI exploration). It is currently empty.
- Targeted discovery in both project checkouts found DESIGN.md and mobile screen code, but no separate mockup/blueprint images. Asked whether these are the intended blueprint or whether references live in another local folder.
- Actual app: `/Users/charlesjinn/nostos-codex/mobile`.
- Prior relevant source/test onboarding: `../passport/ONBOARDING.md`. Its Blender connection blocker and original milestones are historical and superseded by this note.
- Reviewer: `reviewer`, thread `01a0fd7e-d65e-78f2-a0c4-f690e7f00c8a`. Direct coordination authorized, supplied previews only, no polling loops.

## Feature and screen map

| Screen/flow | Existing capabilities to preserve |
| --- | --- |
| Passport home | Passport access, index/neighborhood progress, up to four pins, Settings; primary navigation Passport / Stamp / Map. |
| Passport content | Bearer page, oldest-first spreads, three stamps per page, stamp-to-memory navigation. Future passport object occupies the reserved center. |
| New stamp | Geofence eligibility, camera-only capture up to six photos, optional caption up to 280 characters and song metadata, at least one content item; loading, retry and successful creation. |
| Memory detail | Place/date/neighborhood, photos, caption/song, saved photo arrangement, full-screen photo viewing, edit, pin and remove. |
| Map/place | Stamped places, place sheets/pages, nearby places and eligibility. |
| Account/settings | Existing authentication, age gate, profile and settings. Personal owner-only product. |

## Design constraints and first milestone

- Inspect the user's existing frames, components and flows before designing. Preserve originals using a separate exploration page or clearly named duplicates.
- Middle passport area stays blank: no model, illustration, render, decorative object or visible placeholder label. Subtle background lighting is permitted; reservation notes belong outside the screen.
- First deliverable: one polished primary screen plus short feature map, for feedback before expansion. Aim for precise typography, generous spacing, controlled highlights and shadows, and familiar readable controls.
- Existing type families: Cormorant Garamond, Courier Prime, system sans. Existing palette: black/ink, brass and bone. These are starting references, subject to existing Figma inspection.
- Retain 44-point touch targets, safe areas, readable labels and large-text behavior. Later document loading/empty/error/success/pressed/selected states and Reduce Motion.
- No app code, paid services, commits or pushes. Figma previews do not prove native interaction or phone performance.

Next: resolve local reference location, inspect references and destination libraries, then build and visually review the first direction. Preserve local originals; Figma is the output destination.

## First screen delivered

User confirmed source blueprint is all in code, no images. User then explicitly replaced brass with black and silver and requested background gradients for depth. This overrides historical palette guidance for this exploration.

Editable frame: https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=2-2 . 393 × 852; central region intentionally blank, two grayscale light gradients. Settings, collection counts and Passport/Stamp/Map retained. Counts are fixture data. Visually inspected after correcting preview font rendering: SF Pro was invisible in renderer, so Inter is used for preview UI labels, with existing Cormorant Garamond/Courier Prime. Editable vector review icons replace missing system glyphs. No app source changes or runtime claims. Await first-screen feedback before expansion.

Reviewer navigation feedback addressed: Stamp action explicitly labeled, silver circle 48 pt, Passport selected capsule plus underline. Latest full-screen screenshot inspected. User grants broad creative freedom over sizing, placement and navigation presentation; code is a feature reference, not a layout constraint. First-screen feedback remains next milestone.

Latest focused refinement: compact 300 × 64 centered bar, three 84 × 52 touch regions, aligned 32-point icon slots and independently centered labels. Visible side icons 18 points; Stamp circle 32 points. Screenshot inspected. Reported app overflow/corner placement remains unverified and unfixed; reproduction and responsive/safe-area guidance recorded in PHONE-LAYOUT-HANDOFF.md.

Statistics refinement: centered 324 × 72 panel with 18-point corners and defined silver border; numbers reduced 32→26, labels12→11. Three matching 98 × 54 columns retain centered alignment and padding. Final screenshot inspected; compact navigation and blank center retained.

## Remaining screen set

User authorized rest of app after manually editing original. Current manual reference read first: statistics (35,634), navigation (47,733); no original mutations. Fingerprint7a7d38d5/49 descendants unchanged after work.

Created74 new frames across pages02–07:12 Passport/places,14 stamp,10 memory,18 account/settings,16 recovery/staff,4 phone-fit/motion. Representative screenshots inspected. Final structural check found no checked heading/footer overlap;706 editable text nodes, zero UI image fills. Static design, not interactive/runtime proof. Source-original code unchanged. README.md contains full links and integration limits; screen-manifest.json and build-screen-set.js retain construction inputs.

Focused reviewer follow-up: signup agreement row now345 ×44 with44 ×44 checkbox target; current submit-time consent validation preserved and explicit error frame36:101 added (75 new frames total). Composer21:52 now has88 ×44 Remove photo control using existing draft removal. Both examples visually inspected. No unrelated expansion; await user's visual feedback. Keyboard-open behavior remains native acceptance work.
