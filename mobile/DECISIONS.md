# Decisions (mobile)

Judgment calls made while building the Nostos app from the Last Call app. Open questions: `../OPEN-QUESTIONS.md`.

- **Navigation: four tabs, neutral.** Home, Stamp, Activity, Passport. The Stamp tab doesn't open a screen of its own; its
  press opens the composer (or sign-in). Phase 5 (a design pass after a chosen reference app) was skipped because
  `../DESIGN.md` has no chosen reference, so these are standard Expo Router tabs with the existing theme tokens.
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
