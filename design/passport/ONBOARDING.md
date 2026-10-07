# Passport design onboarding

2026-10-02. Design work only. No app source, dependencies, database, or Blender scene changed.

## Current state and authority

- Actual app: `/Users/charlesjinn/nostos-codex/mobile`. `/Users/charlesjinn/nostos-review` is an older review checkout.
- Observed branch `build-codex`, HEAD `4251da3` (Integrate mobile passport app and backend fixes), clean before this note. Handoff descriptions of an uncommitted merge at `42a6c0d` are historical, not current Git state.
- Read root AGENTS.md, CLAUDE.md, ENGINE.md, both build prompts, DESIGN.md, reviewer-1, current HANDOFF.md, mobile AGENTS.md/README, latest phone-readiness report/delivery README/report, and book-pages delivery report. No ancestor AGENTS.md found in the three parent locations checked.
- Current product is personal, owner-only. Preserve geofence creation, up to six camera photos, photo layout persistence, oldest-first page/slot assignment, three stamps/page, first/last faces, index, pins, error states, and route contracts.
- Latest user direction authorizes warm paper and restrained physical motion despite older dark-page design guidance. Keep original compass/door emblem, brass cover and familiar navigation. Do not integrate until authorized. Do not commit, push, purchase, install, or alter unrelated source for this design task.
- Historical evidence: book fix report records 44 focused tests and full gate 292 backend / 413 mobile passed. No checks rerun during read-only onboarding; these are not new verification or physical-device evidence.

## Rendering and interaction findings

`mobile/package.json`: Expo ~57.0.25, React Native 0.86.3, Skia 2.6.2, Reanimated 4.5.1, Worklets 0.10.1, Gesture Handler ~2.32.0, SVG 15.15.4, expo-image ~57.0.5. No Three, GLTF loader, or expo-gl dependency. Expo SDK 57 Skia docs confirm bundled version 2.6.2 and inclusion in Expo Go: https://docs.expo.dev/versions/v57.0.0/sdk/skia/ . This is compatibility documentation, not a phone test.

Relevant paths relative to mobile/src:

| Area | Files read and important behavior |
|---|---|
| Book lifecycle | features/book/PassportBook.tsx, book-state.ts, dimensions.ts, use-passport.ts, spreads.ts. Closed/opening/open/closing; 1.42 aspect; whole open spread scaled to fit; fetches all stamp pages. |
| Cover | Cover.tsx, OpeningCover.tsx, open-math.ts, foil.ts, use-foil-sweep.ts, emblem.ts. Procedural Skia leather, original vector emblem, foil gradient, drag/tilt/idle sweep; rigid hinge rotation. Opening is tap-driven, not scrubbed. |
| Turns | FlipBook.tsx, flip-math.ts. Continuous pos, two turning sheets plus underlays, flat rotateY faces, flip/cast shading; drag, edge taps, velocity-based spring release; first/last face fix present. No physical curl. |
| Paper/layout | PageStock.tsx, PageView.tsx, Spread.tsx, InsideCover.tsx, BearerPage.tsx, slots.ts, guilloche.ts, edges.ts, lib/layout.ts. Dark stock, SVG security pattern, seeded placements, three slots, at most six stack-edge lines. |
| Ink | StampMark.tsx, stamp-design.ts. Deterministic place shape/motif, neighborhood border, brass ink, paper-color speckle circles. Warm-paper change needs proper transparency/masking, not dark speckles. |
| Creation | app/(app)/stamp/new.tsx, camera.tsx, landed.tsx; features/stamps/composer.ts, stamp-flow.ts, photo-draft.ts, landing-draft.ts. Animate success only after server accepts; preserve retry and draft behavior. |
| Landing | LandingScene.tsx, landing.ts. 1200 ms timeline, 1.7x hover, impact at 230 ms, shake/glow, expanding circular ink overlay. Current effect is not an ink-shaped reveal. |
| Memory | VisaSpread.tsx, ScrapbookPage.tsx, PhotoViewer.tsx, scrapbook.ts, zoom.ts, typewriter.ts, TicketStub.tsx; app/(app)/stamp/[id].tsx and _layout.tsx. Stack navigation to detail; photo modal fades, pinch 1-4x, double tap 2.5x, saved rearrangement. No source-anchored transition. |
| Controls/accessibility | IndexList.tsx, FirstRunHint.tsx, components/ui/text.tsx, stack-options.ts, lib/haptics.ts. Labeled buttons, page announcements, text scales to 1.6x. Existing reduced-motion paths in cover/turn/landing; photo zoom and scrapbook lift do not explicitly use Reduced Motion. |
| Theme | theme/midnight.ts, typography.ts, motion.ts. Bone #E8E4DC already exists; fonts Cormorant Garamond/Courier Prime/system. Add paper-specific semantics later instead of recoloring the global surface token. |

Read relevant test bodies: flipbook, flip-math, passport-book, pages, landing, visa, stamps, theme midnight. Preserve endpoint faces, center stamp taps, edge controls, server page numbers, deterministic placement, photo ordering, caption accessibility, Done, and reduced-motion behavior. Mocks do not prove native animation or hit testing. Test names about legibility do not establish actual phone-size readability.

At 390 pt wide with 16 pt margins, each displayed page is about 179 pt; a 40%-width stamp is about 72 pt. Its 11/120 name scale produces about 6.6 pt letters before long-name shrink. The spread is a browsing overview; provide legible full names/detail outside the miniature artwork, preserve 44 pt controls, and verify at actual phone size.

## Blender and references

- `get_addon_status` and `get_scene_info` both returned: "Could not connect to Blender. Make sure the Blender addon is running."
- Therefore Blender version, active file, unsaved state, scene objects/materials, and existing design work are unknown. No preservation or scene change has occurred.
- No .blend/.blend1 source or passport raster/3D reference was found in the two project file searches. App assets contain icon/splash images; passport artwork is generated by the source above. DESIGN.md names no external reference. Files elsewhere have not been assumed absent.
- User was asked to open Blender and start the MCP connection. Once connected: read status and scene, inspect viewport and current filepath/dirty state; save a timestamped copy before edits; use separate named collections and a new passport source file, never clear the user's scene.

## Recommended direction and milestones

1. **Visual approval:** editable closed passport and one open stamp spread. Fine black leather grain, softly worn corners/spine, restrained brass foil relief, warm bone paper, subtle fibers and gutter, dark legible stamp ink with distinctive borders. Original Nostos emblem. Soft broad key light plus a restrained foil highlight. Deliver closed/open beauty renders, material detail, and phone-scale front views. Wear must not damage lettering. Build the hinge, page stack and deformable sheet alongside the look.
2. **Motion approval:** opening/closing about 450-600 ms, ordinary page release about 220-350 ms, stamp press/reveal about 350-500 ms, memory transition about 220-300 ms. These are study targets, not measured performance. Show forward/back flip, halfway hold/reversal, contact shadow, page thickness, and a quiet press with ink-shaped reveal and one feedback event. Reduce Motion: stationary 150-220 ms fades, no bend, tilt, shake, moving light, or decorative typewriter delay. Include source-to-detail-and-back memory continuity in the motion specification.
3. **Integration agreement:** Blender supplies editable material/geometry source, reproducible texture/mask bakes and motion reference. Proposed runtime assets are modest PNG material/mask layers, original vector decoration, and app-generated dynamic text/stamps. Do not promise .blend/GLB playback with the current app. No full-spread image with personal content baked in; no video driving touch interaction.
4. **Authorized app work and phone proof:** prototype continuous page deformation using existing Skia before selecting final implementation. Local installed Drawings.ts exposes VerticesProps with vertices, textures and indices, so a textured projected mesh is a candidate, not an implemented or proven solution. Keep one progress parameter for drag, pause, reverse and spring release; cache only active/adjacent faces. Need correct backface order, paper edge, shadow, texture refresh and accessibility/hit-test mapping. If quality/performance fail, report evidence and choose a simpler treatment or explicitly agree on a new rendering dependency.

Use a fixed test dataset and deterministic seeds. Preserve text/vector masters, bake configuration, render settings and asset manifest with dimensions, byte sizes, source hashes and licenses. Start evaluation with 1K material textures and modest curl subdivisions; choose final budgets after on-device memory/frame measurements. A 1024x1024 RGBA texture alone is roughly 4 MiB decoded, so compressed file size is not the runtime budget.

Phone acceptance must record model/iOS/build/Reduce Motion and check frame pacing, memory over repeated turns, first/final spread, rapid repeated input, interrupt/cancel/reverse at 25/50/75%, background/resume, correct stamp navigation and return location, long names, Dynamic Type, VoiceOver and photo gesture conflicts. Target a stable 60 fps on the agreed baseline phone; currently unmeasured. Use focused tests in iteration, lint/typecheck and the required full gate at integration, not repeated full scans during design.

## Coordination and next action

Reviewer chat identified as `reviewer`, id `01a0fd7e-d65e-78f2-a0c4-f690e7f00c8a`. User explicitly authorized communication. Sent supplied findings/proposed milestone and requested focused feedback only. No preview yet. Reviewer accepted scope for design exploration and explicitly requires actual-phone-scale renders, readable dynamic content, original emblem/three slots, forward/back curl, pause/reverse/cancel, endpoint faces, accessible controls and Reduce Motion. It agrees the existing 1200 ms landing should be shortened for repeated use and that video proves appearance only. Demonstrate viable curl in the existing stack before finalizing animation assets or adding a renderer. Do not repeatedly retry the disconnected Blender service. No app integration until user approval.

Immediate blocker: live Blender connection. Resume with a read-only scene check, preserve existing scene, then create milestone 1 and inspect renders. Obtain visual approval before motion milestone, agree integration plan, and obtain app integration authorization. No design/render/motion/device result is claimed by this note.
