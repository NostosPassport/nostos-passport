# AI build log (Nostos iOS)

## Phase 1: scaffold, theme tokens, typed API client, auth and onboarding

- Scaffolded Expo SDK 57 with `create-expo-app@latest`, removed the template screens, installed maps, bottom sheet,
  location, image picker, haptics, secure store, blur, FlashList, NetInfo, React Query and zod v3.
- `src/theme/`: colors (incl. vibe palette), type scale, spacing/radius/size, motion tokens.
- `src/api/`: verbatim contract copy, `createApi` client (bearer + `X-Client: ios`, zod parsing, `ApiError`,
  401 handling, XHR upload with progress), base-URL resolution, React Query client wired to AppState and NetInfo.
- `src/auth/`: keychain token store and auth provider. Routes: welcome, sign in, sign up (21+ and Terms consents),
  terms re-acceptance, placeholder map home.
- UI kit: Text, Icon (SF Symbols), Button, TextField, Checkbox, InlineError, FormScreen, native stack chrome.
- Lint rules for design tokens and emoji, with RuleTester tests and a source-tree scan.
- Checks: `tsc` clean, `expo lint` clean (0 warnings), Jest 67 passing, `expo-doctor` 21/21.

### Phase 1 review

Reviewer subagent found 16 issues; all fixed: request/upload timeouts, local-first sign-out, stale 401 scoping,
lenient error parsing + WWW-Authenticate, keychain-before-state, VoiceOver announcements, guest browsing
(5.1.1(v)), account/terms gate, Apple Maps legal label insets, lint-rule holes (named colors, PlatformColor,
literal arithmetic, hitSlop, inline-disable), whole-row checkboxes and 44 pt legal links, native grouped forms with
large titles, keyboard insets, handle AutoFill hint, two-line buttons, friendly validation/5xx copy.
Checks: tsc clean, lint clean, Jest 87 passing.

## Phase 2: map, custom markers, home bottom sheet, dev simulator

- Full-screen dark Apple Map (no POIs, compass or scale), `legalLabelInsets` above the sheet, custom memoized vibe
  markers with ring, packed glow, hollow no-data, friend badge and spring selection.
- Home sheet (peek / half / full) with summary line, animated segmented control, FlashList rows (vibe dot, name,
  "Packed · 4 here · 18 going", stacked friend avatars, neutral Promoted tag), search, skeleton, inline retry,
  location prompt, attribution footer.
- Blurred top bar (search pill, avatar or sign-in), location store + pre-permission screen, dev-only simulator chip.
- Tests: sorting/search/summary/marker labels, dev simulator in development vs production. `expo export` for iOS OK.
- Checks: tsc clean, lint clean, Jest 99 passing.

### Phase 2 review

Reviewer found 12 issues; all fixed (search focus race, per-render re-sort, permission refresh, no-op
tracksViewChanges timers, overlapping marker tap areas, sheet collapse on open, accessible sheet handle, search at
peek, friend count source, search pill role/pressed states, empty/stale states, grid and wording nits).
Checks: tsc clean, lint clean, Jest passing.

## Phase 3: venue screen, report bar and sheet, presence, RSVP

- Venue formSheet: hero (official photo "From the venue" or vibe-tinted initial), Live now (vibe, line, cover,
  mismatch callout, counts, friends, optimistic "I'm going"), From the venue (tonight's hours, full week, cover, dress
  code, accuracy with explanation, promos with Promoted/From the venue badges, ODbL attribution), skeletons, 404 state.
- Floating blurred report bar with ready / outside / cooldown / sign-in / location states; report formSheet with
  one-tap chips and cover keypad; presence hook per API.md; cooldown notices; toast.
- Tests: report bar component states (inside, outside, cooldown, guest, location, owner), bar state function,
  presence re-ping rule, location sort anchor, venue copy. Live contract check against the local backend: 5/5.
- Checks: tsc clean, lint clean, Jest 120 passing.

### Phase 3 review

Reviewer found 14 issues; all fixed or logged (pull-to-refresh in a form sheet is marked for device check).
Checks: tsc clean, lint clean, Jest passing.

## Phase 4: photos (camera, upload, viewer), comments, replies

- Camera-first capture, composer (caption 140, retake, library), JPEG re-encode to 2048 px, XHR upload with progress
  via an upload store, optimistic tiles with retry/remove, inline server errors.
- Photos section: live grid (server-clock expiry with timer + refetch), "Earlier · Not live" collapsed, long-press
  menu; full-screen paging viewer with caption/author/age and Report/Block.
- Comments: list with venue replies, composer (new/edit/reply), 500-char limit, Report/Block/Edit/Reply-as-venue menus.
- Shared Report (reasons sheet) and Block (confirm) actions. Sign-in/up and profiles presented modally.
- Tests: live photo expiry, upload store (progress, success, settle, 429 sentence, retry, 5xx copy), comment labels
  and menus for others/deleted/own/owner. Checks: tsc, lint clean; Jest 129 passing; iOS export OK.

### Phase 4 review

Reviewer found 15 issues; all fixed (upload double-post and retry callbacks, composer races, camera-denied library
path, native image release, signed-URL cache keys, viewer by id with zoom/drag-dismiss/tap chrome, reporter-side
hiding, VoiceOver actions rotor, owner Reply button, frozen Edit, venue-reply Block, sign-in keeps the venue open,
expiry timer churn, stuck tiles). Tests extended; Jest 138 passing, exits cleanly.

## Phase 5: profile, people, follows, blocks, account deletion

- Profile, Find people, user profiles (follow, report account, block), Blocked users, Delete account.
- Follow hook with optimistic updates; inset grouped list components.
- Tests: delete-account flow (explains, confirms, calls API with password, signs out; wrong password inline; cancel).
- Checks: tsc, lint clean; Jest 138 passing.

### Phase 5 review

Reviewer found 14 issues; all fixed (VoiceOver access to row controls, follow races/rollback, toast double
announce, guest Cancel → sign-in, deletion confirmation/retry/warning, profile presentation and Done, native search,
copy). Jest passing.

## Phase 6: owner and moderator screens

- Owner dashboard, details editor, hours editor, new promo (NY time), official photo upload, flag reports, inline
  replies, hidden replies. Moderation queue/hidden/log with confirmed actions and notes.
- Added @react-native-community/datetimepicker (Expo Go). New York time helpers with DST tests.
- Tests: owner field diffing, moderation queue rendering and actions, NY time. Live check extended (owner writes).
- Checks: tsc, lint clean; Jest 148 passing; live 5/5; iOS export OK.

### Phase 6 review

Reviewer found 16 issues; all fixed (photo pick/upload order, promo status and cancel wording, owner flag reasons
and Flagged state, moderation confirmations and wording, log empty state, hours layout and DST-proof pickers, promo
limits, unsaved-change guards, retries, deprecated picker callback, a11y labels). Jest passing.

## Phase 7: polish, App Store config, icon, eas.json, STORE.md

- Media URL resolution (found while checking LAN use), offline banner, zoomed-in marker labels (name + vibe word).
- Icon and splash from SVG, template assets removed, privacy manifest, eas.json, STORE.md (listing, keywords,
  18+ answers, privacy label, App Review notes with the geofence explanation and demo account, screenshot plan).
- Checks: tsc, lint clean; Jest 155 passing; expo-doctor 21/21; iOS export OK; live contract check 5/5.

### Phase 7 and whole-app review

Reviewer found 15 issues (2 App Review blockers: review account on the wrong environment, generic Always-location
strings in Info.plist); all fixed or documented. Checks: tsc, `expo lint` and `eslint .` clean; Jest 156 passing and
exits cleanly; expo-doctor 21/21; iOS export OK; live contract check 5/5.

## Wrap-up

README.md, REVIEW.md, REVIEW-BUNDLE.txt. EAS isn't logged in on this Mac, so no build was made; the commands are in
README.md. No iOS Simulator runtime is installed, so the app was verified by tests, bundling and the live contract
check, not by running it.

## Device feedback (2026-09-27)

First run on a real iPhone in Expo Go:
- The venue page was blank inside the detent-based `formSheet`, so it's now a standard card sheet (`presentation: "modal"`).
- Geofence-exempt accounts were still dimmed by distance; they can now always post.
- Broke the `queries` ↔ `auth-context` require cycle, which printed a Metro warning.

## Social layer, Phase 6: mobile screens
**Start:** repo from a ZIP (no git history), committed as a local baseline. `npm run check` 157/157 on fresh installs.
**Built (3 commits):**
- API layer: client methods, keys and hooks for every social endpoint (profile settings, avatar, requests, followers
  and following, activity, profile posts and places, posts, likes, featured months). `VerifiedBadge`, `Avatar` photos.
- Profiles (own and others', one screen): header with photo, badge, bio, counts, Regular badges, "Featured at";
  Posts grid (paged) and Places (small dark map + list); limited state; Follow / Requested / Following. Own profile:
  Edit profile, Follow requests with the pending count, Activity; the old settings content moved to Settings.
- Edit profile (photo, name, bio 150, Private toggle, approve-all prompt), Follow requests, Followers / Following
  (Remove follower), Activity, post detail (likes with heart and double-tap, Report/Block or Edit/Delete from
  profile), Edit post.
- Camera-only composer with the 1-10 rating picker, caption, and the share toggle with its account default; no rating
  = a live photo. Venue page: "This month's best", past months, month gallery; likes and badges in the viewer and
  comments. Search rows show avatars and badges.
- Tests: rating picker, follow button states, author label, composer camera-only rule and share default, profile
  limited/full/own states, likes cache, post and profile edit rules, featured section, client paths.
**Reviewer found (12; 5 should-fix):** the viewer opened the wrong photo when the venue was opened by slug (cache key
mismatch); "Not now" on the approve-all prompt left Edit profile open; your own Following count went stale after a
follow; Regular chips under 44 pt; Settings rows didn't speak "verified". Nits: private-toggle copy said all others
see Anonymous (approved followers see the handle); Edit post for someone else's post; removed post left in cache;
month viewer polled the venue page; a wrong DECISIONS note; raw numbers outside the theme; single vs double tap.
**Changed:** all 12 fixed (route key passed to the viewer and its index taken from the photo id; prompt dismisses on
both buttons; own profile and following list refreshed; 44 pt chips; labels; copy; ownership check; cache removal;
venue query skipped for months; note corrected; new theme tokens; `Gesture.Exclusive` for single vs double tap).
Regression test for the prompt.
**Checks:** `npm run check` (tsc, lint 0 warnings, Jest) **193/193**.
**Not verified on a device:** no simulator here. Check: the rating picker's cell size, double-tap in the viewer, the
Places map, modals above the venue sheet.

## Social layer, Phase 7: checklist, live check, polish
- `DEVICE-CHECKLIST.md` for the social features, against the new seed.
- `npm run test:live` now covers the social endpoints (profiles, grid and paging, places, lists and the 403 on a
  private account, requests, activity, post detail, a like round-trip, a month gallery): **6/6** against the seeded
  local backend.
- The map's top bar shows your profile photo. `npx expo export --platform ios` bundles.
- Reviewer (Phase 7, with the seed): fixed a conditional assertion and a like that could be left behind if the test
  failed midway.
- Checks: `npm run check` **193/193**.
