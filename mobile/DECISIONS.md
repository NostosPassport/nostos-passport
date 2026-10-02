# Decisions (mobile)

Judgment calls made while building the Nostos app from the Last Call app. Open questions: `../OPEN-QUESTIONS.md`.

- **Navigation: three tabs.** Passport (home), Stamp (a large center button that opens the composer) and Map. No feed, no bell: with
  `SOCIAL_ENABLED` off (the default) nothing social exists in the app. A gear on the Passport tab opens Settings. Edit profile moved
  into Settings (the Passport tab is the book now), and the Private account switch is hidden in personal mode.
- **The "checking account" state** (`auth/account-state.ts`, `features/account/account-gate.tsx`): while auth or `/api/me`
  is loading the screens say "Checking your account"; when `/api/me` failed they offer Try again; only a real guest sees
  "Sign in". This fixes the known device bug where a slow load read as signed out.
- **The place list comes from `/api/places/nearby`,** computed on the server from the phone's position, but the server
  checks the geofence again on the stamp. The composer picks the place for you only when exactly one geofence has you inside.
- **Song picking** goes through a tiny module (`features/stamps/song-draft.ts`) instead of route params, because the picker
  is a modal over the composer. The picker needs a network; with none it shows an error with Try again.
- **The age gate is on the phone first.** The birthdate is typed as MM/DD/YYYY, auto-formatted, checked locally, and an
  under-21 value is never sent or stored. Sign-up sends it once (the server checks again and keeps nothing). The guest
  gate checks and discards it. Nothing is remembered about a refusal (OPEN-QUESTIONS L2b).
- **Going public needs a confirm alert** (`goingPublicAlert`) that lists what changes: all stamps (photos, captions, songs)
  and every place, to anyone, signed in or not, including past stamps. "Keep private" does nothing.
- **Report reasons** are labels with categories: underage, stalking and "not at this place" were added. A report on a stamp
  you reported hides it from you for the session.
- **Distances** always go through `formatDistance`: from 1000 m up it is kilometers ("1.8 km").
- **Error reporting is off.** `lib/report-error.ts` loads Sentry only when the build sets `EXPO_PUBLIC_SENTRY_ENABLED=1` and an
  https DSN; no DSN is committed, the SDK is lazy-loaded, and events are scrubbed of user, request and breadcrumbs. The
  native config plugin is deliberately not in `app.json` (it needs an auth token to upload source maps). Turning Sentry on
  needs the plugin, a development build and the privacy answers in OPEN-QUESTIONS L5.
- **Dependencies removed** because nothing uses them any more: the bottom-sheet library, the date-time picker, blur, glass
  effect and `@expo/ui`. `DEPENDENCIES.md` lists them.
- **Theme tokens only.** The lint rules from Last Call stay: no raw colors or sizes outside `src/theme`, no emoji, SF Symbols.

## Session 2: the passport book
- **One position number drives the whole book.** `pos` (the spread position, 2.37 is 37 percent through a turn) is a Reanimated
  shared value; each turning page reads `clamp(pos - k, 0, 1)`. Two turning pages are always mounted, one lying on each side, over
  the pages they reveal. When a flip settles, JS state catches up to a position that is already right, so nothing flickers. Holding a
  page halfway is not a special state: the page follows the finger and stays where it stops.
- **Worklet math lives in files that start with `"worklet";`.** A plain imported function cannot be called on the UI thread, and Jest
  runs everything on one thread, so it cannot catch a missing one. `worklet-files.test.ts` reads the files and fails instead.
- **The closed cover is page-sized and the open book scales down to fit.** A phone is not wide enough for two pages at the cover's
  size, so the stage shrinks (`openScale`) as the cover opens. Pages are drawn at cover size and scaled, so text is sharp.
- **Stamps are SVG, not Skia.** `react-native-svg` has text on a path, renders in Jest, and is enough for flat brass ink. Skia is used
  where it earns it: the leather grain shader and the foil gradient. Ink "not taking" is a scatter of small dots painted in the
  paper's color, not true transparency.
- **A stamp is a pure function of its place** (`stamp-design.ts`): shape and figure from the place id, border family from the
  neighborhood id, so one neighborhood reads as a set. Variety is shape and design, never color.
- **The visa spread's pages are half the screen wide, so the caption, date and song sit in a typed slip under the spread**, not on the
  pages: at that size a 280 character caption does not fit a page. The scrapbook layout is saved as shares of the page.
- **The caption types out over a full, invisible copy of itself**, so the text wraps once and a screen reader has all of it from the
  start. With Reduce Motion it appears at once.
- **Photos come from the in-app camera only** (`expo-camera`, up to six). The library path was removed from the composer (it stays
  for the profile photo). A stamp's photos are proof you were there.
- **The location note on the composer says what is true:** the server saves the phone's position with the stamp, to audit the check,
  and never shows it. The earlier plan to say "never stored" would have been false. OPEN-QUESTIONS L6.
- **The map draws only places in view, at most 250,** lit ones first. Your position is a small bone ring, not the system's blue dot
  (nothing in the interface is another hue).
- **First run is remembered in `expo-secure-store`** (one key), so there is no extra storage dependency.
- **The Design gallery is development only:** its routes are behind `Stack.Protected guard={__DEV__}`, the screens redirect home when
  `__DEV__` is false, and the entries (Welcome, Settings) are conditional on `__DEV__`. It uses made-up data and no server.
- **The web pages follow the palette** (`backend/src/app/globals.css`): the old status colors all map to brass, dim brass or bone. The
  legal text is unchanged because it is a legal text (OPEN-QUESTIONS L7).
- **Nothing visual has been run on a phone.** See `DEVICE-CHECKLIST.md` and the session review.


## 2026-10-02 Codex integration

- The authorized combined working tree remains uncommitted on build-codex. Claude's source branch and checkout are not modified.
- `stageTransform` is explicitly workletized at function scope. Its regression uses the actual installed Babel plugin and executes
  the serialized code, rather than relying on Reanimated mocks. Native rendering and motion remain unverified.
- The development API fallback is port 3001 to match this lane's backend dev script; `EXPO_PUBLIC_API_URL` still takes precedence.
  A regression checks both LAN and localhost against backend/package.json. Release URL requirements are unchanged.

- Age eligibility uses `America/New_York` calendar parts, matching the backend rather than device-local dates. Summer and winter
  midnight boundaries are tested in independent Node processes under UTC, New York, Tokyo and Honolulu. Birthdates are still
  absent from refused responses; this fixes an implementation boundary and makes no legal decision.


## FlipBook boundary faces

The initial inside cover and terminal right page have no turning sheet carrying them. The underlying faces use the current spread at those two boundaries; interior underlays and turn geometry retain adjacent spreads. Component regressions verify both boundary faces and page-2 stamp navigation with Reduce Motion on/off. Physical-phone verification is still pending.
