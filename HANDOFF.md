## Latest: the 3D passport opens (2026-10-06, Claude)

Tapping the Blender passport now swings the cover open (a hinged `open` clip in `mobile/assets/3d/passport-openable.glb`) into a two-page spread,
then the 2D page reader fades in over it; Close plays the clip backwards. If the 3D model is not live, a tap goes straight to the reader as before.
Checks: `npm run check` 68 suites / 510 tests, iOS bundle export OK. NOT run on a phone: see `reviews/2026-10-06-passport-opens-claude.md`
(claims not proven, and the three numbers to tune on a device). Still uncommitted. Blender sources are in `~/nostos-blender`.

## Current session — 2026-10-06 passport focus

Current base HEAD 5485fb4 on build-codex in /Users/charlesjinn/nostos-codex. This session's changes remain uncommitted; no push. Main passport restores the real static GLB; full-screen reader uses existing dynamic page rendering, with page taps and a Close control. An actual opening Blender interior remains blocked on an openable asset export.

Final mobile check: 62 suites / 468 tests pass, typecheck/lint clean. Full gate failed on 30 existing backend tests; not green. Backend 3001 and freshly restarted full-app Expo 8081 run on LAN 10.19.108.26. QR and exact evidence: deliveries/2026-10-06-passport-focus/. Physical phone still unchecked. Review: reviews/2026-10-06-passport-focus-codex.md. No contract or migrations changed.

The historical handoff below is preserved for context and does not supersede this session status.

# Handoff

Nostos is an iPhone app (Expo, iOS only) for New York: you go to a place and get a stamp. Your profile is a passport book you open
and flip through; stamps appear on its pages. This version is strictly personal: no feed, no likes, no follows, no sharing. Only you
can see your passport. The look is black and brass.

Read first: `CLAUDE.md`, `ENGINE.md`, `NOSTOS-BUILD-PROMPT.md`, `NOSTOS-BUILD-PROMPT-2.md`, `DESIGN.md`. The only definition of green is
`scripts/gate.sh`. `LEDGER.md` is written by the gate only. Current combined checkout: `/Users/charlesjinn/nostos-codex`, branch `build-codex`; never push.
Claude's committed `build` work at e639860 has been imported into this working tree alongside Codex HEAD 42a6c0d.
The user requested an uncommitted merge and uncommitted fixes; do not commit without renewed authorization.

## What exists
- **Backend** (`backend/`: Next.js 15, Prisma, Postgres): accounts and sessions, the geofence check on every stamp, up to six photos
  per stamp with EXIF and GPS stripped, songs as metadata (iTunes Search proxy), neighborhoods and completion, pinned stamps (up to
  four), the place page, oldest-first page and slot numbering, moderation, the age gate, account deletion. The social layer is still
  there behind `SOCIAL_ENABLED` (default off), and 404s when off.
- **App** (`mobile/`): Passport (the book), Stamp (the stamp flow), Map, and Settings behind a gear. A development-only Design gallery.
- **Rules that must never break:** `CLAUDE.md` lists eleven; each has a test in `backend/tests/integration/invariants.test.ts`.

## Run it
```
cd /Users/charlesjinn/nostos-codex
(cd backend && docker compose up -d db)    # nostos-codex, Postgres 5438 only
(cd backend && pnpm db:seed && pnpm dev)   # nostos_codex, API on :3001
(cd mobile && npx expo start --go --port 8082) # scan the QR code in Expo Go
scripts/gate.sh                            # everything: typecheck, lint, tests, invariants, dependency ledger
```
Demo sign-in after the seed: `avaa@lastcall.dev` (or `maya_r@lastcall.dev`), password `lastcall-dev`. The phone and the Mac must be on
the same network (or use `npx expo start --tunnel`). See `mobile/README.md`.

## Try each thing on the phone
- **The book:** Passport tab. Tap the cover: it swings open to the bearer page. Drag from the outer edge of a page, or tap the edge,
  to turn it. "Index" under the book lists neighborhoods; tap one to jump to its first page.
- **Stamp a place:** the large center button. The list says "Here" or "Nearby" with distances. Take photos with the in-app camera (up
  to six), add a caption or a song, tap Stamp, and watch it land. To try it away from a place in a development build, long-press the
  Map to pretend you are there (the server still checks the geofence).
- **A stamp:** tap one on a page. The photos are on the right; drag them about (it saves), tap one for full screen and pinch.
  The ellipsis menu pins it, edits it or deletes it from your profile.
- **Map:** places you have stamped glow; tap a pin for its sheet and the place page.
- **The Design gallery (development builds only):** on the Welcome screen tap "Design gallery (development)", or in Settings under
  Development, or open the link `nostos://design` (in Expo Go: `exp://<your Mac's address>:8082/--/design`). Every piece of the design
  is there on made-up data with no account and no server.

## What needs your decision (`OPEN-QUESTIONS.md`)
- **L6:** the server saves the phone's position with each stamp (to audit the geofence check) and never shows it. The stamp screen
  says so. Is that wording right, and should the position be dropped after the check?
- **L7:** the privacy policy and terms still describe the social layer. Only recolored this session; the text needs a lawyer.
- L1 to L5 (songs terms, age gate, SAFE for Kids Act, geolocation disclosures, error reporting) are unchanged.
- Product questions 1 to 8 (ratings, place catalog, stamp frequency and others) are unchanged.

## What has not been run
**Nothing in session 2 has run on a phone.** The app type-checks, lints, and passes Jest, which tests the math and that screens render,
but the leather and foil shaders, the cover swing, the page flip, the stamp landing, the typewriter, the pinch zoom, the camera, haptics,
Reduce Motion, VoiceOver and the map have never been seen. `mobile/DEVICE-CHECKLIST.md` lists every effect to check. Expect to fix
things on first contact with a real device. Skia, `react-native-svg`, `expo-camera` and `expo-sensors` are claimed to work in Expo Go
from the Expo SDK 57 docs, not from a run.

## Where things are
`backend/src/app/api` (routes), `backend/src/server/services` (logic), `backend/src/contracts/api.ts` (the API contract, copied to
`mobile/src/api/contracts.ts` by `node scripts/sync-contracts.mjs`), `mobile/src/app` (screens), `mobile/src/features/book` (the
book), `mobile/src/theme` (Midnight), `reviews/` (one file per session), `DEPENDENCIES.md` (one line per dependency).

## Codex integration fixes

Creation-only photo content, indistinguishable foreign/missing stamp mutation 404s, personal-mode service guards (including
moderation/admin), and atomic live-content database guards remain present from the prior Codex session. Photo layout edits and
final removal remain allowed. Contract documentation changed only in prior commit 2723315; its generated mobile copy is already
synchronized. Run `npm run sync:contracts` after a future merge rather than resolving generated-file conflicts by hand.

The remaining mobile fixes and final check results are recorded in the newest `reviews/*-codex-2.md` session report.
No native rendering, camera, location permission, haptics, VoiceOver or animation performance claim is proven by automated tests.

## Current automated evidence

Final combined gate: 292 backend tests (34 files), 407 mobile tests (51 suites), plus required invariants, contract sync
and dependency ledger, all passed. Backend production build and final iOS/Hermes export passed. Full details and gaps:
`reviews/2026-10-02T185815Z-codex-2.md`. These changes remain uncommitted.

## Verification workflow for future work

Use targeted tests while fixing individual issues. Run the full gate once after combined changes and repeat only if a check fails or a later change affects the result. Do not start speculative audits. The user requested no commits. Both review bundles have been regenerated and their fresh summaries and complete test-file inclusion verified.

## Latest fix: book boundary pages

The first inside cover and final right page now render. Focused tests passed 44/44; one full gate passed backend 292 / mobile 413. Details: `reviews/2026-10-02T191304Z-codex-3.md`. Real-phone checklist: `mobile/BOOK-PAGES-PHONE-CHECKLIST.md`. The merge and changes remain uncommitted. Review bundles are regenerated from the working tree using the recorded gate results, without repeating checks.

## Phone startup ready

Backend 3001 and Expo Go Metro 8082 are running on LAN 10.19.108.26. Isolated empty dev database seeded once. Health, demo login, manifest and iOS bundle HTTP checks passed. Exact opening steps and QR: `deliveries/2026-10-02-phone-setup/HOW-TO-OPEN.md`. Physical device checks remain pending. No new commits or contract changes.
