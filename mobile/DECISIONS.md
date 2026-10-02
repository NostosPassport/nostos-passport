# Decisions (Nostos iOS)

Judgment calls made while building the app. The backend (`../backend/`) is the source of truth for every rule;
see its `API.md` and `DECISIONS.md`.

## Phase 1: scaffold, theme, API client, auth

- **Expo SDK 57** (`create-expo-app@latest`, default template, Expo Router with routes in `src/app/`). Template demo
  screens removed. Native packages added with `npx expo install` only; all are in Expo Go. `npx expo-doctor` passes.
- **zod stays on v3** (`^3.25`), as `API.md` requires; the contract file is copied verbatim.
  `npm run sync:contracts` re-copies it and a Jest test fails if the copy drifts from `../backend`.
- **Forward-compatible parsing.** The contract's response schemas are `.strict()` so the backend's drift tests catch
  changes. A shipped app can't be updated in lockstep, so the client accepts a response whose *only* problems are
  unknown keys (including inside union branches) and logs it in development. A missing or mistyped field is still
  a hard error shown as "Something went wrong on our end."
- **Errors.** `ApiError` carries the server's `error` code and `message`. Screens show the message inline unchanged
  (geofence distance, cooldown minutes, objectionable content). Network failures become `offline`; non-JSON or
  contract mismatches become `bad_response` with a generic sentence.
- **Dead tokens.** Any `401 invalid_token` clears the keychain token; the auth provider hears it, clears the React
  Query cache (no data leaks between accounts) and the protected routes send the user to sign-in.
- **Token storage.** `expo-secure-store` with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (not in iCloud backups or new
  devices) plus an in-memory copy so requests read it synchronously.
- **Base URL.** `EXPO_PUBLIC_API_URL` wins. In development without it, the app uses Metro's LAN host on port 3000,
  which is where the backend's `pnpm dev` listens, so Expo Go on a phone works with no config. Release builds without
  the variable fail loudly instead of guessing.
- **Routing.** `Stack.Protected` guards: signed-out users see `(auth)`, accounts on an old Terms version see
  `terms-update` (re-acceptance, required by the backend's `terms.needsAcceptance`), everyone else sees `(app)`.
  The splash stays up until the token is read and `/api/me` settles; offline, `me` pauses and the app still opens.
- **Onboarding is two screens** (welcome over a live dark map, then sign up or sign in). No carousel.
- **Sign-up** mirrors the server's rules for inline hints (email, 10+ char password, handle pattern) but the server
  still decides. Both consents are required checkboxes; the Terms and Privacy links open the backend's `/terms` and
  `/privacy` in `SFSafariViewController`. The terms line states there's no tolerance for abusive content (Guideline 1.2).
- **No password reset.** The backend has no reset endpoint yet; sign-in doesn't offer a dead link. Listed as a gap.
- **Design tokens are enforced by lint.** `eslint-rules/` adds `local/no-raw-design-values` (hex/rgb/hsl colors
  anywhere outside `src/theme/`, and raw numbers for spacing, size, radius and type properties in style objects and
  `size` props) and `local/no-emoji`. Jest tests the rules with `RuleTester` and lints the real tree in a child
  process, so switching the rule off in `eslint.config.js` also fails the tests.
- **Dynamic Type.** Text scales with the system setting up to a 1.6x multiplier (past XXXL), then stops growing.
- **react-native-maps prop name.** The Apple Maps POI toggle is `showsPointsOfInterests` (with an s) in 1.27.

### Phase 1 review fixes

- **Guest browsing (Guideline 5.1.1(v)).** The map and venue pages are public in the API, so the welcome screen offers
  "Look around first". Guests see everything read-only; any account action (post, RSVP, follow, flag) goes to sign-in
  through `useRequireAccount`. The choice is remembered on the device.
- **Account gate.** Signed-in users only reach the app after `/api/me` loads, so the Terms re-acceptance check can't be
  skipped by a failed or slow request. A `connect` screen shows progress, or an inline retry and Sign out.
- **Timeouts.** JSON requests abort after 15 s (`timeout` error with its own sentence); uploads after 90 s and can be
  cancelled with an `AbortSignal`.
- **Sign-out is local first.** The token is cleared at once and the old token is revoked in the background, so a slow
  network never traps someone in an account.
- **Dead-token scoping.** A `401 invalid_token` only clears the token if it's the one that request sent, so a late
  answer for a previous account can't sign out the next one. Error bodies parse leniently, and the `WWW-Authenticate`
  header is honoured if the body is unreadable.
- **Keychain before state.** Sign-in writes the keychain first; if that fails the user stays on the form with an error.
- **5xx and validation text.** Server sentences written for people (geofence, cooldown, suspended) are shown as is;
  `invalid_input`/`bad_request` and 5xx bodies are replaced by the screen's own sentence (`errorText`).
- **VoiceOver.** iOS ignores `accessibilityLiveRegion`, so errors are announced with
  `AccessibilityInfo.announceForAccessibility` and the first invalid field takes focus.
- **Native forms.** Inset grouped fields with inline labels (stacked at large text sizes), large-title headers, and
  whole-row checkboxes. The Terms and Privacy links are separate 44 pt buttons, not inline text.
- **Keyboard.** `automaticallyAdjustKeyboardInsets` on the scroll view instead of `KeyboardAvoidingView`.
- **Apple Maps legal label.** Every map passes `legalLabelInsets` so Apple's logo and Legal link stay visible above
  panels and sheets.
- **Lint rule coverage.** Now also catches CSS named colors on color props/keys, `PlatformColor`, literal-only
  arithmetic (`4 * 3`; token math like `size.marker / 2` stays allowed), `flexBasis` and numeric `hitSlop`/`size`
  props. The source-tree scan runs with inline config disabled, so `eslint-disable` comments can't hide a violation.

## Phase 2: map, markers, home sheet, dev simulator

- **Markers** are memoized with a field-by-field comparator, so a 60-second refetch only re-renders venues whose look
  changed. `tracksViewChanges` is on until the view settles (about 500 ms after any visual change), then off.
  Markers draw in a 52 pt box, so the tap target stays above 44 pt though the dot is 28 pt.
- **Packed glow.** A breathing halo (1.2 s per phase) behind packed markers. It is an ambient loop, not a transition, so
  it's the one exception to the 350 ms motion cap; with Reduce Motion on it's a static halo. All transitions (marker
  scale, sheet snaps, segmented control) are springs that settle within 350 ms.
- **Selection.** Tapping a marker or row springs the marker up, pans the map so the venue sits just under the top bar
  (the strip the venue sheet leaves visible), and opens the venue. Returning to the map clears the highlight.
- **Home sheet.** `@gorhom/bottom-sheet` with three snap points (peek, 50%, full), duration-based springs from the
  theme, and FlashList v2 through `useBottomSheetScrollableCreator`. The search field appears at the full snap point
  (or while a query is typed); the top bar's search pill snaps the sheet to full and focuses it.
- **Sorting** is client-side as `API.md` says: Live now by `activity`, Going tonight by `goingTonight`, Nearby by
  distance from the user. `promoted` only adds a neutral "Promoted" tag (tested: it never changes order).
- **Search** matches name, address and neighborhood, ignoring accents and apostrophes ("sophies" finds Sophie's),
  ranking name-prefix matches first.
- **Friend avatars** come from `/api/me/following` (mutual follows only, as the API returns), keyed by venue slug.
  Nostos has no profile photos, so avatars are initials.
- **Location.** When-in-use only. The app reads the permission at launch without prompting; the prompt only comes from
  the pre-permission screen (reached from Nearby, and later from posting). Denied shows a path to Settings. The map
  shows the user dot only when granted. `distanceMeters` exists only for the Nearby sort and later the 25 m presence
  re-ping threshold; geofence decisions are always the server's.
- **Dev location simulator** is `null` when `__DEV__` is false, the map then gets no `onLongPress` at all, and even the
  store's internal setter refuses. A Jest test loads the modules with `__DEV__ = false` and checks all three, plus that
  the "Simulated location" chip never renders.
- **Attribution.** "© OpenStreetMap contributors" floats just above the sheet's peek (right side; Apple's legal label
  is bottom-left) and repeats as the list footer. Both open the attribution URL.
- **Venue screen presentation.** A native `formSheet` at 86% height with a grabber: the map stays visible at the top
  and swipe-down dismisses. Stubbed until Phase 3.

### Phase 2 review fixes

- **`tracksViewChanges` is Google-only** (react-native-maps 1.27, `MapMarker.tsx`): Apple Maps renders custom markers
  as live views. The earlier settle-timer was removed; the prop stays `false` per spec, and the marker memo is what
  keeps 150–250 markers cheap.
- **Marker tap area is 44 pt**, with the packed glow drawn outside it, so a packed venue's halo can't steal taps from
  its neighbours. No clustering yet: at the default zoom EV/LES markers stay tappable; revisit if the venue count grows.
- **Search focus** waits for the sheet to reach full height (gorhom fires `onChange` after the animation), then
  focuses on the next frame. Collapsing to the peek clears the query and hides the keyboard; the segments hide while
  a query is typed.
- **Nearby sort anchor.** The location store keeps a sort anchor that only moves after 50 m, with stable identity, so
  the list doesn't re-sort on every GPS tick and memoized rows don't re-render.
- **Permission refresh on foreground**, so coming back from Settings with location on works without a relaunch.
- **Opening a venue collapses the home sheet** so the pan and selected marker are visible above the venue sheet.
- **Friend counts** always come from the API's `friendsGoing` (map badge and row agree); names come from
  `/api/me/following`, which now refetches every 60 s too.
- **Accessible sheet handle.** Custom handle with VoiceOver increment/decrement actions and a spoken state.
- **Designed states** for an empty venue list and for a failed refresh while cached data is showing; Nearby without
  location shows only the prompt, not a silently alphabetical list.
- **No-data outline** is 45% white at 1.5–2 pt, not the 8% hairline: on a dark map the hairline disappears. It stays
  hollow, never a fill, and is never drawn as "Dead".
- **4 pt grid.** Off-grid 2 pt and 6 pt values removed; the 6 pt radius token is gone (checkboxes are circles, badges
  use the chip radius).

## Phase 3: venue screen, report bar and sheet, presence, RSVP

- **Venue screen** is a native `formSheet` (86%) with its own `GestureHandlerRootView` (native modals sit outside the
  root one). While the page loads, the hero is drawn from the map's cached copy of the venue, then skeletons.
  Pull to refresh; React Query refetches every 60 s while it's open. A close button backs up the swipe-down.
- **Live now** shows the API's consensus only: the vibe word in its vibe color (always with the word), line and cover
  with "N reports · updated X min ago" from the server's `now`, "Not enough data" in neutral gray (never red),
  the cover-mismatch callout, here-now and going counts, and friends going by name.
- **RSVP** is optimistic (flag and count), reconciled with the server's `goingTonight`, rolled back with a warning
  haptic on error. Guests are sent to sign in. Owners see no RSVP (the API refuses it anyway).
- **Presence** follows `API.md`: ping on open, every 5 minutes, and after moving more than 25 m (at most every 30 s),
  plus on returning to the foreground after 5 minutes. It only runs for signed-in non-owners with location (or the
  dev simulator). A change in here/not-here refetches the page so counts update.
- **Report bar state** is a pure function of auth, ownership, permission and the server's presence answer (tested).
  Outside: dimmed, disabled, "You're 140 m away. Get closer to post." using the server's `distanceM`. A failed ping
  leaves the bar usable: the server decides on post.
- **Cooldowns.** The server's 429 sentence is kept per venue and kind and shown inline on the bar (clock icon on that
  kind, sentence above). It clears on a successful post of that kind or after 15 minutes of display. The app never
  computes when a cooldown ends.
- **Report sheet** is a second native sheet sized to its content: one tap on a vibe or line chip posts it; cover has a
  decimal keypad and a Free chip. Fresh coordinates are taken at post time. 403/429 messages show inline; success
  gives a success haptic, a short toast, and refetches the venue and map.
- **Toasts** only confirm success. Errors are always inline. Each native presentation hosts its own toast layer.
- **Live contract check.** `npm run test:live` runs the app's client against a running backend (default
  `http://localhost:3000`, dev seed accounts) and parses every response it touches with the app's contract copy:
  public, signed-in, owner, moderator and dead-token paths. It passes against the Day 1 backend.

### Phase 3 review fixes

- **Navigation after a post lives on the `mutate` call**, not the hook, so a sheet dismissed mid-request can't pop the
  venue screen when the answer arrives.
- **Presence throttles attempts, not successes** (a failing network can't cause a request per GPS tick), and a move
  that lands inside the 30 s window schedules one ping for the end of the window instead of being dropped. A 403 from
  the report sheet asks the open venue to re-check. When location goes away mid-screen, the old answer is discarded.
- **Venue cache keys.** Pages are cached under the route param (id or slug); `invalidateVenue` matches on the loaded
  page's id too, so a slug-opened page still refreshes after posts and arrivals.
- **Cooldown copy on the bar is timeless** ("You posted a vibe update here recently. You can post again soon."). The
  server's exact countdown is only shown where it arrived (the sheet), so it can't go stale on screen.
- **Report chips** give a light haptic, and a request paused by being offline says so inline.
- **Fewer boxes.** Line and cover are rows in one grouped list with the mismatch line inside the cover row; promos are
  rows in the details group. The section is "Details" with a "From the venue" badge, and the accuracy row is hidden
  when there's no official cover (the cover row already says so).
- **RSVP** keeps full style while its request is in flight (taps are ignored), with one success haptic.
- **Hero while loading** is a neutral skeleton, not the initial, so it doesn't flash into a photo. Hours list starts
  on Monday. Attribution link has a 44 pt target. The venue refetches on regaining focus if older than 30 s.
- **Unverified on device:** pull-to-refresh inside a single-detent form sheet may drag the sheet instead; the 60 s
  refetch and focus refetch cover freshness either way.

## Phase 4: photos, comments, replies

- **Camera first.** The report bar's camera button opens the system camera straight away (camera permission is
  requested there, with the purpose string; denied points to Settings). The composer that follows has the preview,
  a 140-character caption, Retake and Library. On a device without a camera (the Simulator) the composer opens
  empty and offers the library. The library uses the system picker, which needs no photo-library permission.
- **Uploads.** Photos are re-encoded to JPEG with the long edge capped at 2048 px (the server's cap) before upload,
  which also converts HEIC and keeps files well under the 5 MB limit. The upload runs in a small store outside the
  composer: the composer closes on Post, and the venue screen shows an optimistic tile with a progress bar that
  turns into the real photo, then disappears once the refetched page includes it. Failures keep the tile with Retry
  and Remove, and the server's sentence (geofence, cooldown, objectionable caption) shows inline under the grid.
  A 403 re-checks presence; a 429 sets the photo cooldown notice.
- **Content-Length.** React Native on iOS builds multipart bodies in memory (`RCTNetworking.mm`) and sends them as
  `HTTPBody`, so `NSURLSession` sets `Content-Length`, which the backend requires (411 otherwise).
- **Live photos expire on the server's clock.** The page's `now` plus local time elapsed since the fetch decides when
  a photo crosses 3 hours; a timer drops it at that moment and refetches (as `API.md` asks). "Earlier" photos are
  collapsed under "Not live".
- **Viewer** is a full-screen modal with horizontal paging, caption, author ("Deleted user" when null), age, a
  "Not live" badge for earlier photos, and Report/Block in the "..." menu and on long-press. Your own photos have no
  menu (the API has no photo delete).
- **Report and Block** use native action sheets and alerts (Guideline 1.2): five reasons, a note that reporters stay
  anonymous, and a block confirmation that explains the effect. Flag conflicts and limits show the server's sentence.
  Blocking invalidates all cached queries, because it hides content everywhere.
- **Comments.** Newest first as the API returns them, in one grouped list. Venue replies are nested with the venue's
  name and a "Venue" badge. Your own comments have Edit (the 409 "frozen after a reply" sentence shows inline);
  owners get "Reply as [venue]" and no top-level composer on their own venue (the API refuses it). Guests see a
  sign-in button in place of the composer.
- **Modals above sheets.** Sign in, sign up and user profiles are presented modally, so they appear above the venue
  sheet when opened from it (a pushed card would land underneath a presented sheet).

### Phase 4 review fixes

- **Uploads can't double-post.** A running upload ignores a second Retry, and retries reuse the original callbacks
  (toast, refetch, cooldown, presence). The composer's Post guard is a ref, Cancel is disabled while preparing, and a
  composer dismissed mid-prepare never starts the upload. Posted tiles keep the local file (no flash) and clear after
  2 minutes if the photo never appears in the page (auto-hidden, venue closed).
- **Resize uses the decoded image's dimensions** (already rotated) and releases native image objects right away.
- **Camera denied still lets people post from the library:** the composer opens with the reason and the Library
  button. The Settings alert only appears if access was refused before this tap, never right after a fresh
  "Don't Allow". The Simulator is detected with `expo-device` instead of guessing from errors.
- **Signed photo URLs are cached by photo id** (`cacheKey`), so 5-minute URL rotation doesn't re-download or flicker.
- **The viewer tracks the photo by id.** Expiry, a report, or a block can't make the menu act on a different photo;
  if the current one disappears, the viewer says so. Pinch to zoom, drag down to close (off while zoomed), tap to hide
  the chrome; it's a transparent modal so the venue shows through while dragging.
- **Reported content is hidden for the reporter** for the session (and on 409 "already reported"), with a success
  haptic; moderators decide for everyone else. The venue page refetches.
- **VoiceOver.** Each comment, reply and photo is one element with a full sentence ("Reply from Velvet, 5 min ago:
  ..."), and Report, Block, Edit, Reply and View profile are in the actions rotor, so nothing depends on long-press.
- **Owners get a visible Reply button** on comments at their venue; Edit is hidden on comments that already have a
  venue reply (the API freezes them). Venue replies offer Report only, not Block.
- **Signing in from inside a venue keeps you there.** Sign-in loads `/api/me` with the new token before switching,
  so the app stays mounted instead of passing through the account gate.
- **Tests no longer leave timers running** (query clients with no GC timers in tests).

## Phase 5: profile, people, follows, blocks, account deletion

- **Profile** (from the map's avatar): identity, "Manage [venue]" for owners and "Moderation" for staff, Following
  with each person's plans ("Going to Velvet tonight" only for mutual follows, as the API returns), Find people,
  then Settings (Blocked users, Privacy Policy, Terms, Support), Sign out (confirmed) and Delete account.
- **Delete account is two taps from Profile to the button** (Profile → Delete account → Delete account, plus the
  system confirmation). The screen says plainly what happens (identity erased, photos removed, reports and comments
  kept as "Deleted user", signed out everywhere), asks for the password, shows `wrong_password` inline, and signs out
  locally without calling logout (the token is already dead). Covered by a component test.
- **People.** Search by handle as you type (250 ms pause, 2+ characters, leading @ ignored), with Follow/Following
  toggles that update optimistically across the profile and search results and roll back on error.
- **User profiles** show counts, a "Venue account" badge (staff roles are never shown, per the API), plans only when
  mutual (otherwise a line saying how plans are shared), venues, Follow, and Report account / Block in the header menu.
  Blocking closes the profile. A 404 reads "This profile isn't available" (the API doesn't say why).
- **Blocked users** lists blocks with Unblock, and a footer explaining what blocking does.
- **Settings lists are inset grouped** (`ListGroup`/`ListRow`) with sentence-case headers.

### Phase 5 review fixes

- **VoiceOver can reach row controls.** A non-tappable row with a trailing control (Unblock) no longer merges into
  one element; a tappable row (a person in search) carries its control (Follow/Unfollow) as a VoiceOver action.
- **Follow is race-free.** Optimistic updates cancel in-flight fetches, errors restore saved copies of the profile
  and search caches, and taps are ignored while that person's request is pending, so follow and unfollow never race.
- **Toasts are announced once** (in `toast.show`), not by every mounted host; hosts are hidden from VoiceOver.
- **Account deletion.** The welcome screen confirms "Your account is deleted." once. A retry that gets `invalid_token`
  (the first attempt succeeded but timed out) counts as done. The warning now covers follows and plans, and owners are
  told they lose access to their venues. No success haptic for a deletion.
- **Profiles push from Profile and People** (chevrons are honest), and open as a modal with a Done button only from
  inside the venue sheet. Cancel in the profile menu no longer sends guests to sign in; only Block is red.
  "Reports" on profiles is "Updates", so it can't be read as moderation reports.
- **Native search bar** for Find people (`headerSearchBarOptions`), matching names and handles, keeping previous
  results while typing.
- **Copy.** "Privacy policy" in sentence case, curly quotes, legal rows use an outward arrow (they open a browser
  sheet, not a push), nothing centered.

## Phase 6: owner and moderator screens

- **Owner dashboard** ("Manage [venue]" on Profile): view the public page; official photo (library, re-encoded like
  user photos), hours, and name/address/cover/dress code; promos with Promoted labels and End (confirmed); accuracy
  (read-only, "You can't edit it"); anonymous recent reports with Flag; comments waiting for a reply with an inline
  reply box; hidden replies. Owners never get report UI or RSVP for their own venue, and can't edit or hide user
  content (the API enforces all of this; the app just doesn't offer it).
- **Edits send only changed fields** (tested, and validated against the contract's `OfficialInfoRequest`).
- **Hours editor.** One row per day (Monday first) with an open switch and compact native time pickers in 15-minute
  steps; a close earlier than the open means the next morning, as the API defines. Times are wall-clock, so the
  phone's time zone doesn't matter.
- **Promo times are New York local.** The pickers are pinned to `America/New_York` (`timeZoneName`) and the value is
  sent as the API's `YYYY-MM-DDTHH:MM`, correct across DST (tested, and round-tripped against the backend).
- **Moderation** (staff only, from Profile): Queue / Hidden / Log in a segmented control. The queue shows each item
  once with its content (photo, text, or account), author and reputation, every flag with reason, who, role and
  owner markers, and the history. Hide/Dismiss for content and Suspend/Dismiss for accounts, each confirmed with an
  optional note that goes into the log (`Alert.prompt`). Hidden lists content and suspended accounts with Restore /
  Unsuspend. The log is read-only. Admin tools (claims, paid flag, geofence exemption) stay on the web.
- **Live check** now also edits owner info and creates and ends a promo against the backend.

### Phase 6 review fixes

- **Official photo** is picked first, then uploaded; the row shows a spinner only while sending and ignores taps.
- **Promo status** (Scheduled / Live now / Ended / Cancelled) is derived from the server's times; the API cancels a
  future promo by collapsing it to a 1 ms window, which reads as "Cancelled". Future promos offer "Cancel promo"
  ("It won't run"), running ones "End promo".
- **Owners flag reports with their own reasons** ("Looks inaccurate" first) and copy that fits anonymous reports.
  Flagged reports show "Flagged" instead of a button; flags refresh owner dashboards too.
- **Moderation.** Confirmations name the item ("Hide: photo by @maya at Velvet?") and warn when dismissing an
  auto-hidden item makes it visible again; buttons follow state (Keep hidden, Unsuspend). Report previews,
  reputation ("trust 160%"), actions and notes are in words, and FLAGGED events aren't repeated in the history.
  The log has an empty state. Buttons carry item-specific VoiceOver labels. Actions refresh venues, profiles and
  owner dashboards.
- **Hours editor** uses the Alarms pattern (day and switch, then From/To when open), so it fits 375 pt phones and
  large text. Time pickers run in UTC on a fixed date, so a daylight-saving day on the phone can't skip 2:00. With
  every day off, the footer says the page will show "Hours not posted" (the API's meaning of an empty list).
- **Promo form** defaults to the next quarter hour (what's shown is what's sent), limits the start to 90 days out and
  the length to 30 days, and says why Create is disabled.
- **Forms guard unsaved changes** (`beforeRemove` → "Discard changes?"), and load errors offer a retry. "View page"
  moved to the header; the duplicate hours list folded into the Hours row.
- **`onValueChange`** replaces the deprecated `onChange` on date pickers (no dev warning).

## Phase 7: polish and App Store readiness

- **Media URLs.** In development the backend's local storage driver returns relative paths (`/api/uploads/...`);
  every image now resolves through `mediaUrl`, so photos load in Expo Go over the LAN. R2 URLs pass through.
- **Offline banner.** "You're offline. Showing what was last loaded." slides in at the top (root and venue sheet)
  when NetInfo reports no connection, and is announced to VoiceOver. Queries pause offline and resume on reconnect.
- **Color is never the only signal on the map.** Zoomed in (latitude span under about 8 blocks) or selected, markers
  carry a small label with the venue name and vibe word; `centerOffset` keeps the dot on the coordinate.
- **Icon and splash.** An original mark: a single amber dot with a soft glow on the night background, no text.
  1024 × 1024, opaque (App Store requirement), rendered from SVG by `scripts/make-icons.cjs`. The template's icon
  assets are gone.
- **app.json.** "Nostos", `com.charlesjinn.nostos`, dark only, iPhone only, `ITSAppUsesNonExemptEncryption:
  false`, the three purpose strings from the spec (when-in-use location only, camera, photo library; no microphone),
  and an app-level privacy manifest with the required-reason APIs React Native uses (Expo's guidance, since Apple
  doesn't always read the manifests inside static CocoaPods).
- **eas.json.** `development` (internal simulator build against preview), `preview` (internal distribution/TestFlight,
  preview API), `production` (production API, remote build numbers auto-incremented). No update channels: the app
  doesn't include `expo-updates`.
- **Age rating 18+** (frequent alcohol references, user-generated content); in-app sign-up also requires 21+. Privacy
  label answers in `STORE.md` match what the backend stores (email, user id, precise location with reports and
  photos, photos, comments, plans/follows), no tracking.

### Final review fixes

- **App Review uses production.** The reviewed build points at `https://nostos.app`, which has no demo seed, so
  `STORE.md` now says how to create the geofence-exempt review account there (sign up, then the admin API), and the
  review notes explain that live data is sparse outside New York's evenings.
- **Only when-in-use location in Info.plist.** The `expo-location` plugin otherwise adds generic "Always" and motion
  strings; those keys are now turned off. The encryption flag is set once; `buildNumber` is gone (EAS manages it).
- **`preview` is a TestFlight build** (App Store distribution, preview API) with its own submit profile.
- **Privacy label** adds Name (display name) and covers "here now" check-ins; it notes coordinates kept anonymously
  on reports after deletion, as the privacy policy says.
- **One definition of offline.** Reachability is checked against our `/api/health`, not NetInfo's Google URL, and the
  same `isOffline` drives the banner and paused queries. Banners sit below each screen's own chrome (map top bar,
  venue sheet grabber, composer bar); the root announces the change once.
- **Marker labels** only below a ~4-block span, only for Packed/Busy (and the selected venue), max 112 pt wide.
- **A failed map load shows at the peek** ("Couldn't load bars" with Retry). The photo viewer has loading, error and
  failed-image states. The hero caches by URL path. Protocol-relative URLs aren't rewritten.
- **Tooling.** ESLint covers the Node scripts with Node globals; a posted photo's cleanup timer is cleared when it
  settles (it kept Jest alive, and leaked a timer per post).

### Device feedback

- **Venue page is a standard card sheet** (`presentation: "modal"`), not a detent-based `formSheet`. On a real iPhone
  the formSheet rendered its scroll content blank. The card sheet still leaves the map visible at the top and
  dismisses with a swipe down.
- **Geofence-exempt accounts** (App Review, demo) never get the dimmed "Get closer" bar. The server lets them post
  from anywhere, so the app no longer dims the bar based on their real distance.

## Social layer (feature/social)

### Phase 2 (API adaptation)
- **Authors come resolved from the server** (`AuthorView`): `features/people/author.ts` turns them into "@handle",
  "Anonymous" or "Deleted user". Only a handle opens a profile or offers Block.
- **Follow button states**: Follow, Requested (tap to cancel) and Following (`followButton`). Unfollow and cancel are
  optimistic; a follow waits for the server, because only it knows whether the account is private.
- **Private profiles** show the handle, a generic avatar, "This account is private" and the follow button. The full
  profile screens (tabs, edit profile, requests) come in Phase 6.
- **"Block this person"** appears for Anonymous authors and blocks by content, so every author can be blocked
  (Guideline 1.2) without the app ever learning who it is. The blocked list shows those as "Someone you blocked
  from a photo" and unblocks by the block's ref. Display names never appear there.

### Phase 6 (mobile screens)
- **Rating is optional in the composer** (the "merge" option). Without a rating the button reads "Post live photo"
  and the footnote says it's on the venue page for 3 hours, not on your profile; with one it's "Post" and the share
  toggle appears. This keeps one camera flow for both, matching the backend (no rating = live-only photo).
- **Posts are camera-only.** The composer lost its Library button, and the camera notes no longer suggest the
  library. The server can't tell a camera shot from a library pick (it checks the upload's coordinates against the
  geofence), so camera-only is an app rule; the geofence is the real proof. Profile photos and the owner's official
  photo still use the system picker.
- **Share toggle default** follows the account (public on, private off, the server's default too) until the person
  flips it; the composer always sends `shared` explicitly for a post.
- **Own profile = the same screen as everyone else's** (`features/people/profile-screen.tsx`), plus Edit profile,
  Follow requests (with the pending count) and Activity. The former settings-style profile moved to Settings (gear in
  the header) unchanged: plans of people you follow, venue and moderation entries, blocked users, legal, sign out,
  delete account.
- **Rating picker**: ten equal cells across the screen width (about 32 pt wide, 50 pt tall, with vertical hit slop),
  because ten 44 pt cells don't fit on a phone and a scrolling row hides 9 and 10. For VoiceOver it's one adjustable
  control ("Rating, 8 out of 10", swipe up or down), so nobody has to find ten small targets. Check on device.
- **Verified badge**: a small champagne diamond with a check (`colors.verified`, not the accent, not blue, not a seal
  shape). Rows that carry their own label say "verified" in it; alone, the badge says "Verified".
- **Liked hearts use the accent**: a liked heart is a selection state, which is what the accent is for.
- **Likes are optimistic** and patched into every cache that holds the post (detail, venue live/earlier/featured,
  month galleries). Double-tap only likes, never unlikes. You see the count on your own posts but can't like them.
- **The month gallery opens as a modal**, because it's reached from the venue sheet and must present above it (same
  reason as user profiles; authors in the photo viewer open profiles as modals too). Post detail is only reached from
  profiles and Activity, so it's a normal pushed screen.
- **Delete from profile** asks first and says it's for good (the server hides it; nothing is deleted).
- **Places map** is a small non-interactive dark map framing every venue (minimum span so one venue isn't one
  building), with the list below doing the navigation.
