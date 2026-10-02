# Review: session 2, interim (C, D, E, F.1 to F.2 done; F.3 to H not started)
Commit range: f42e5e4..f5f0601 on branch `build` (`git log --oneline`). Written before F.3 so a lost session leaves a true record.
Working tree was clean at the start of this continuation; nothing was stashed. Baseline gate on f5f0601 is below.

## Gate output (last 15 lines)
```
   Start at  12:51:41
   Duration  57.11s (transform 420ms, setup 242ms, collect 2.72s, tests 48.38s, environment 2ms, prepare 874ms)

== gate: mobile check
PASS iOS eslint-rules/__tests__/rules.test.js (5.39 s)

Test Suites: 30 passed, 30 total
Tests:       210 passed, 210 total
Snapshots:   0 total
Time:        5.833 s, estimated 6 s
== gate: contract sync
== gate: invariants suite
== gate: dependency ledger
dependency ledger ok (69 lines)
GATE OK: backend 269 tests, mobile 210 tests
```
(An older gate run from a parallel shell held the lock for about a minute; I waited for it, did not kill it.)

## Done
- B.1, B.2: disk check on /System/Volumes/Data in `scripts/gate.sh:19`. b67381c is NOT in the archive log (the object does not exist there), as session 1's review said.
- C.1 SOCIAL_ENABLED flag, default off: `backend/src/server/privacy.ts:46`, `:82`, `backend/src/server/http.ts:7`, `mobile/src/config.ts:6`. Tests: `personal-mode.test.ts` "is off unless set", "every social route is a 404", "your own passport still works, and nobody else's stamp opens, not even for staff", "services agree: another person's passport is limited and has no stamps, for everyone".
- C.2 invariants with the flag off: `backend/tests/integration/invariants.test.ts:206`, "rule 11: with social off, nothing of another person's passport reaches anyone but its owner".
- C.3 tabs: `mobile/src/app/(app)/(tabs)/_layout.tsx:14`. Tests: `tabs.test.tsx` "social off: exactly Passport, Stamp and Map, with Passport as home", "social on: the feed and the bell come back".
- D.1 multi-photo stamps: migration `20261003100000_stamp_photos`, `stamps.ts`. Tests: `stamp-photos.test.ts` "holds up to 6 photos in the order they were taken, and refuses a 7th", "adds photos into the next free positions...", "strips EXIF and GPS from every photo", "persists the scrapbook layout and the order, owner only...", "is hidden, never deleted...", "only the owner edits photos...".
- D.2 place pages: `backend/src/server/services/places.ts:48` (`inside`), `stamps.test.ts:332` "my place page" > "stacks my stamps at a place by night, oldest first, and says whether I'm inside right now".
- D.3 collections: `backend/src/server/services/neighborhoods.ts:26` (import), `:41` (`locate`), `:85` (`recordProgress`), `:110` (`neighborhoodIndex`), migration `20261003120000_neighborhoods`. Tests: `neighborhoods.test.ts` "point in ring", "the real NYC boundaries", "the importer covers more than bars", "counts visited places over total, earns a completion once, and never takes it back", "a set needs at least 3 places...", "App Review stamps never count...".
- D.4 pinned stamps: `backend/src/server/services/pins.ts:12` (`MAX_PINS = 4`), migration `20261003110000_pinned_stamps`. Tests: `pins.test.ts` "up to four of your own...", "only your own stamps, in the service and in the database", "owner only...".
- D.5 oldest first, page and slot from one function: `backend/src/lib/layout.ts:14` (`pageAndSlot`), mobile copy `mobile/src/lib/layout.ts:5`. Tests: `tests/unit/layout.test.ts` "fills three slots a page, in order, never skipping" and four more, `stamps.test.ts:300` "numbers stamps oldest first, three to a page, from one shared function", `:319` "pages the passport oldest first with an after cursor and no gaps", `mobile/src/lib/__tests__/layout.test.ts`.
- E.1 Midnight theme: `mobile/src/theme/midnight.ts:14` (palette), `:29` (colors). Test: `midnight.test.ts` "is black, two near-black surfaces, brass, dim brass and three bone tones, and nothing else", "errors and states are brass, never another hue".
- E.2 color-literal and white check in the gate: `mobile/src/theme/__tests__/midnight.test.ts:78` "no color literal outside the theme file" ("finds no hex, rgb(a), hsl(a) or named color in any source file", "uses no white anywhere in the app, including the config", "the detector catches a planted offender").
- E.3 Customize teaser: `mobile/src/app/(app)/customize.tsx:10`. Test: `customize.test.tsx` "is a quiet note with a lock: nothing to buy, nothing to set up, and a way out".
- F.1 cover: `mobile/src/features/book/Cover.tsx:37`, `foil.ts:6`, `emblem.ts:11`, `use-foil-sweep.ts:11`, `dimensions.ts`. Tests: `cover.test.tsx` "is one button that opens the book, and it says what's inside", "shows three brass numbers under the book"; `foil.test.ts` (drag, tilt, idle shimmer, tracking); `dimensions-emblem.test.ts` (fit, deterministic emblem, eight-point star, 48 ticks and a doorway); `rng.test.ts`.
- F.2 open animation: `mobile/src/features/book/OpeningCover.tsx:19`, `open-math.ts:5`. Tests: `open.test.tsx` "turns the cover from 0 to minus 180 degrees and clamps", "shows the inside face only past halfway", "shades most edge-on and not at all when flat", "renders the cover and the page under it".

## Not started
F.3 bearer page, F.4 pages, F.5 page flip, F.6 stamps, F.7 landing, F.8 visa spread, F.9 index, F.10 stamp flow, F.11 map, F.12 restyled screens, F.13 Design gallery, G.1 and G.2, H.1 and H.2 (DESIGN.md is still the session 1 stub, no HANDOFF.md, no final review or regenerated bundles).

## Claims not proven
- Nothing visual or animated has run on a phone or in Expo Go: the Skia leather grain and foil shader, the highlight sweep and tilt response, the 3D cover swing, hinge shading, and the page shadow. Jest checks only the math (angles, shading, sweep position, emblem geometry) and that components render with Skia mocked (`mobile/jest.setup.tsx`). Whether it looks right, runs at 60 fps, or works in Expo Go is untested. All are listed in `mobile/DEVICE-CHECKLIST.md` under "Book (session 2)".
- Reduce Motion behavior (crossfade, no shimmer) is written but never observed.
- Expo Go compatibility of `@shopify/react-native-skia`, `react-native-svg`, `expo-camera` and `expo-sensors` rests on the SDK 57 docs, not on a run.
- The NYC neighborhood boundaries (D.3) are checked with two park landmarks in tests, not against a map.

## Decisions
See `backend/DECISIONS.md` and `mobile/DECISIONS.md`.
## Open questions
See `OPEN-QUESTIONS.md`. None new.
## Gaps
No device run exists for any session 2 visual work.
## Next task
F.3 bearer page.
