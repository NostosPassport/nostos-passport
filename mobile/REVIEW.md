# Review (mobile)

What a reviewer can verify without a device, and what needs one (`DEVICE-CHECKLIST.md`).

| Area | Where | Tests |
|---|---|---|
| Contract copy matches the backend | `src/api/contracts.ts` | `api/__tests__/contracts-sync.test.ts` (in the gate) |
| API client: auth, errors, forward compatibility, endpoints | `src/api/client.ts` | `api/__tests__/client.test.ts` |
| Feed (social on), stamp detail, song picker never render blank | `app/(app)/(tabs)/index.tsx`, `stamp/*` | `features/stamps/__tests__/screens.test.tsx` |
| Composer rules (a photo, a caption or a song; fields sent; place choice; edits) | `features/stamps/composer.ts` | `features/stamps/__tests__/composer.test.ts` |
| "Checking account", never "Sign in" while loading | `auth/account-state.ts`, `features/account/account-gate.tsx` | `features/account/__tests__/account-gate.test.tsx` |
| 21+ gate (sign-up and guest), nothing stored or sent for under-21s | `lib/age.ts`, `app/age-gate.tsx`, `app/sign-up.tsx` | `lib/__tests__/age.test.ts`, `features/account/__tests__/age-gate-screens.test.tsx` |
| Going public confirm lists what changes | `features/people/edit-profile.ts` | `features/people/__tests__/edit-profile.test.ts` |
| Someone else's passport: limited view for private accounts (social on) | `features/people/profile-screen.tsx` | `features/people/__tests__/profile.test.tsx` |
| Report and Block on every stamp; reasons incl. underage, stalking, not at this place | `features/moderation/content-actions.ts` | `features/moderation/__tests__/guideline-1-2.test.tsx`, `reasons.test.ts` |
| Account deletion | `app/(app)/settings/delete-account.tsx` | `features/people/__tests__/delete-account.test.tsx` |
| Tabs are Passport, Stamp, Map; no feed, no bell | `app/(app)/(tabs)/_layout.tsx` | `features/account/__tests__/tabs.test.tsx` |
| Theme: black and brass only, no color literal outside the theme file, nothing white | `theme/midnight.ts` | `theme/__tests__/midnight.test.ts` (in the gate) |
| Cover, open animation: foil, emblem, sizes, swing and shade math | `features/book/Cover.tsx`, `OpeningCover.tsx` | `book/__tests__/cover.test.tsx`, `foil.test.ts`, `dimensions-emblem.test.ts`, `open.test.tsx` |
| Bearer page: dates, passport number from the handle, check digits, machine lines | `features/book/bearer.ts` | `book/__tests__/bearer.test.tsx` |
| Pages: spreads, slot placement and overlap, guilloche, edges, ribbons | `features/book/spreads.ts`, `slots.ts`, `guilloche.ts`, `edges.ts` | `book/__tests__/pages.test.tsx` |
| Page flip: progress, drag, release, flick, edges, tap, close | `features/book/flip-math.ts`, `FlipBook.tsx` | `book/__tests__/flip-math.test.ts`, `flipbook.test.tsx` |
| Worklet modules and stage helper serialize correctly | `features/book/*-math.ts`, `foil.ts`, `landing.ts`, `zoom.ts` | `book/__tests__/worklet-files.test.ts`, `worklet-transform.test.js` |
| The passport screen: states, open, close, first run | `features/book/PassportBook.tsx`, `book-state.ts`, `first-run.ts` | `book/__tests__/passport-book.test.tsx`, `book-state.test.ts`, `first-run.test.tsx` |
| Stamps: deterministic design, border by neighborhood, name fitting, shapes, motifs, completion stamp | `features/book/stamp-design.ts`, `StampMark.tsx` | `book/__tests__/stamps.test.tsx` |
| Landing timeline, copy, photo pins | `features/book/landing.ts`, `landing-copy.ts`, `LandingScene.tsx` | `book/__tests__/landing.test.tsx` |
| Visa spread: scrapbook layout, drag saved, zoom math, typewriter, New York time | `features/book/VisaSpread.tsx`, `scrapbook.ts`, `zoom.ts` | `book/__tests__/visa-logic.test.ts`, `visa.test.tsx` |
| Index: rows, first page per neighborhood, rings, jump | `features/book/index-data.ts`, `IndexList.tsx` | `book/__tests__/index.test.tsx` |
| Stamp flow: six-photo cap, here and nearby, calm disabled state, honest location note, in-app camera | `features/stamps/stamp-flow.ts`, `app/(app)/stamp/new.tsx`, `camera.tsx` | `features/stamps/__tests__/stamp-flow.test.ts`, `stamp-screens.test.tsx` |
| Map: lit and dim pins, culling, sheet words, swipe to close | `features/map/*` | `features/map/__tests__/map.test.tsx` |
| Place page words and screen | `features/place/place-page.ts`, `app/(app)/place/[id].tsx` | `features/place/__tests__/place.test.tsx` |
| Settings, welcome (personal mode) | `app/(app)/settings/index.tsx`, `app/welcome.tsx` | `features/account/__tests__/settings-welcome.test.tsx` |
| Design gallery: every section renders on made-up data; development only | `features/gallery/*`, `app/design/*` | `features/gallery/__tests__/gallery.test.tsx` |
| Km formatting ("1.8 km", never "1815 m") | `lib/format.ts` | `lib/__tests__/format.test.ts` |
| Error reporter off by default, no DSN committed, scrubbed | `lib/report-error.ts` | `lib/__tests__/report-error.test.ts` |
| Design tokens only, no emoji | `eslint-rules/` | `eslint-rules/__tests__/rules.test.js`, lint is part of the gate |

Needs a physical iPhone: every visual and animated effect (the leather grain and foil shader, the highlight sweep and tilt,
the cover swing, the page flip and its shading, the stamp landing, the pinch zoom, the typewriter, the map pins), the camera,
location permission and the geofence in the real world, haptics, Reduce Motion, VoiceOver, the native action sheets and alerts,
keyboard behavior, and the flows in `DEVICE-CHECKLIST.md`. Jest checks the math and that components render; it cannot see.


## Codex integration, uncommitted

The user authorized importing Claude's e639860 and completing mobile in build-codex. HEAD remains 42a6c0d; no new commit
has been made. Combined checks passed 292 backend/407 mobile tests, including contract sync and required invariants.
The iOS/Hermes production export and backend production build passed; these do not prove native runtime or visuals.

- Passport stage helper: `features/book/book-state.ts:20`; installed-plugin serialization and isolated execution in
  `features/book/__tests__/worklet-transform.test.js`, "serializes stageTransform with the installed Worklets plugin and runs its UI-thread code".
- Development API: port 3001, `api/base-url.ts:7`; `api/__tests__/base-url.test.ts`, "connects to the backend dev server configured for this lane, including localhost fallback".
- Age boundary: `lib/age.ts:40`, New York date; `lib/__tests__/age-timezones.test.js`, "%s agrees with the backend in summer and winter" across four device zones.
- Song picker: `features/stamps/__tests__/screens.test.tsx:161`, idle, debounce/loading, selection, empty, upstream failure/retry/recovery; shared loading View is accessible at `components/ui/skeleton.tsx:25`.

No new contract change. Prior contract-changing commit 2723315 and its generated mobile copy are retained.

Current continuation report: ../reviews/2026-10-02T185815Z-codex-2.md

Latest focused fix report: ../reviews/2026-10-02T191304Z-codex-3.md. Single full gate: backend 292 / mobile 413. First inside-cover and final right-page regressions pass with Reduce Motion on/off; four-stamp page-2 navigation is covered. Native results remain unverified.
