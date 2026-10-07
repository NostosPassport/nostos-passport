# Review: passport-opens
Commit range: none. All changes are uncommitted on build-codex (base HEAD 5485fb4), as instructed. Nothing pushed.

## Gate output (last 15 lines)
Only the mobile check was run (`cd mobile && npm run check`: typecheck, lint, all Jest suites). `scripts/gate.sh` was NOT run; the previous
session recorded it failing on 30 existing backend tests unrelated to this work.
```
Test Suites: 68 passed, 68 total
Tests:       510 passed, 510 total
```
Before this session: 62 suites / 468 tests. Added 6 suites / 42 tests. No existing test was changed, skipped or loosened.
`npx expo export --platform ios` succeeded (Hermes bundle 8.3 MB); the single bundled `.glb` is byte-identical to `mobile/assets/3d/passport-openable.glb`.

## Done
- The Blender passport now has a hinged cover and an `open` clip (2.0 s, 49 keys): `mobile/assets/3d/passport-openable.glb` (554 KB, 636 triangles,
  5 materials, 5 embedded images). Source and scripts live outside the repo in `~/nostos-blender` (`build_openable.py`, `export_openable.py`,
  `make_interior_textures.py`, `scene_v3_openable.blend`); the original v2 scene and `passport.glb` were not modified.
- Interior: cream inside cover and a bearer-page specimen, reproducing PageStock/InsideCover/BearerPage (fonts, colors, inset hairline, spine fold).
  Test: `lab3d/__tests__/load-openable.test.ts`, "interior pages face the viewer when open and are hidden inside the book when closed".
- Motion math: `lab3d/open-motion.ts`; tests `open-motion.test.ts` (17).
- Stage: `lab3d/passport-stage.ts` scrubs the clip with an AnimationMixer by `pose.open`, dollies the camera to fit the spread, squares the book to the
  viewer, stills tilt/bob, widens the shadow. `load-model.ts` now also returns the clips.
- Loop: `lab3d/lab-loop.ts` has `open` / `onOpenProgress` / `onOpenSettled`, ignores rotation while open or opening, stops scheduling frames once fully
  open. Tests: `lab-loop-open.test.ts` (8), including Reduce Motion jumping to the ends and monotonic open and close.
- Screen: `book/PassportBook.tsx`. Tap plays the 3D opening; the 2D reader joins at 82 percent; Close fades the reader out and plays the clip backwards;
  opening a stamp keeps the book open behind it; index jump and the "Open stamp pages" fallback skip the animation. Tests: `passport-open-flow.test.tsx` (8).
- A real bug was found and fixed by those tests: `open` took an `instant` parameter, so a touch or accessibility callback that passes an event object
  would silently skip the animation. `open` now takes no arguments; `openPages` is the separate instant path.

## Claims not proven
- NOTHING has run on a phone or in Expo Go. GPU rendering, the AnimationMixer in the React Native runtime, texture decode of the two new interior
  images through Skia, frame rate, and the visual match between the 3D spread and the 2D reader are all unverified. `REAL-PHONE-CHECKLIST.md` still applies.
- The container scale/translate that lines the 3D spread up with the reader is computed from layout, not measured. Expect a few points of misalignment.
- `PAPER_LIFT` (0.3, in `passport-stage.ts`) is a guess. In Blender previews the opened pages read greyer than the cream 2D pages; tune on a device.
- The framing preview (`~/nostos-blender/renders/app-framing-preview.png`) reproduces the app camera in Blender, not three.js.
- The interior right page is a specimen (placeholder name, handle, number); the 2D reader shows real bearer data after the handoff.
- `scripts/gate.sh` was not run.

## Decisions
- Animate only after the 3D view has reported `onReady`; otherwise open the reader at once (this also keeps every pre-existing test valid).
- Scrub the clip by progress instead of playing it, so closing is the same clip backwards and Reduce Motion is a plain jump.
- Interior pages are separate thin planes (0.1 mm proud), not new UVs on the welded mesh, so the existing atlas is untouched.
- The old `passport.glb` and its test are left in place and unused; remove them when convenient.

## Open questions
- Should the Blender sources move into `design/passport/source` so the openable model can be rebuilt from the repo?
- Should the opening be skippable (second tap) for returning users?

## Gaps
- No haptic or sound on the cover landing.
- The first-run hint still says "tap to read"; wording not revisited.

## Next task
Run `mobile/DEVICE-CHECKLIST.md` and `deliveries/2026-10-06-passport-focus/REAL-PHONE-CHECKLIST.md` on an iPhone, then tune `PAPER_LIFT`,
`SPREAD_FILL` and `READER_AT` in `lab3d/open-motion.ts` and `passport-stage.ts`.
