# Review: Nostos iOS (Days 2–4)

## What was built

A native iPhone app in Expo SDK 57 (Expo Router, React Native 0.86, TypeScript strict), built against the
backend's contract (`../backend/`). It runs in Expo Go. Seven phases, each followed by typecheck, lint, tests, a reviewer
subagent, fixes and a commit (see `AI-LOG.md`; every judgment call is in `DECISIONS.md`).

| Area | What's there |
|---|---|
| Onboarding and accounts | Welcome over a live dark map; sign up (email, password, handle, name, required 21+ and Terms/Privacy checkboxes, links open in-app); sign in; **Look around first** (guest browsing); terms re-acceptance; account gate; keychain token; any `401 invalid_token` signs out |
| Map | Full-screen dark Apple Map, no POIs; custom 28 pt vibe markers with a 2 pt ring, packed glow (static under Reduce Motion), hollow no-data, friend badges, spring selection with pan above the sheet, name + vibe labels when zoomed in; blurred top bar (Search bars, avatar); OSM attribution; dev-only location simulator |
| Home sheet | Peek / half / full with springy snaps; "12 spots live nearby"; Live now / Going tonight / Nearby; FlashList rows ("Packed · 4 here · 18 going", friend avatars, Promoted tag); client-side search; skeleton, empty, error and stale states; accessible handle |
| Venue sheet | Hero ("From the venue" photo or vibe-tinted initial), Live now (vibe word in its color, line, cover, "N reports · updated X min ago", neutral "Not enough data", mismatch "Venue says $10 · People say $20", here/going counts, friends, optimistic "I'm going"), photos, comments, Details (tonight's hours, week, cover, dress code, accuracy with explanation, promos) |
| Posting | Floating report bar (Vibe, Line, Cover, camera) with ready / outside ("You're 140 m away. Get closer to post.") / cooldown / sign-in / location states; one-tap chip sheet with cover keypad; presence pings per `API.md`; pre-permission screen; camera-first photo flow with caption, re-encode, upload progress and optimistic tiles |
| Photos and comments | Live grid that expires on the server's clock, "Earlier · Not live"; viewer with paging, zoom, drag to dismiss; comments with venue replies, edit, owner reply; Report (reasons) and Block everywhere, also in the VoiceOver actions rotor |
| People | Profile (following with mutual plans, settings, legal, sign out, delete account); Find people (native search bar); user profiles (follow, report account, block); blocked users |
| Owners and moderators | Owner dashboard (official photo, hours editor, details, promos with status, accuracy, anonymous reports with Flag, inline replies, hidden replies); moderation queue, hidden, log with confirmed actions and notes |
| App Store | `app.json` (name, bundle id, dark, purpose strings, encryption flag, privacy manifest), original icon and splash, `eas.json` (development, preview, production), `STORE.md` |

## How each design rule is met

| Rule | How |
|---|---|
| Tokens only in `src/theme/` | Colors, type scale, 4 pt spacing, radii (10/14/20/28), sizes and motion live there. The `local/no-raw-design-values` lint rule fails on hex/rgb/hsl/named colors and `PlatformColor` outside `src/theme`, and on raw numbers for spacing, size, radius and type. Tested with `RuleTester`, and a test lints the real tree with inline disables ignored |
| One accent, vibe colors only for vibe | Amber `#FFB224` for primary actions and selection only; vibe colors appear only on markers, dots and the vibe word |
| SF Pro, type scale, tabular numbers, Dynamic Type | System font with the spec's sizes; `tabular` on counts, money and times; text scales up to 1.6×, forms stack labels at large sizes, pills shrink labels instead of clipping |
| SF Symbols only, no emoji | `expo-symbols` everywhere; `local/no-emoji` lint rule |
| Motion | Reanimated springs with duration-based configs that settle within 350 ms (sheet, marker, segmented control); the packed glow and skeleton pulse are ambient loops, static under Reduce Motion |
| Haptics | Light impact on chip selection, success on a report, RSVP or post, warning on errors |
| Anti-patterns | No gradients on buttons or cards, no emoji, no nested cards, inset grouped lists instead of bordered boxes, skeletons instead of spinners for content, no "Welcome to…" copy, no exclamation marks |
| Copy tone | Short, sentence case, confident: "Packed. 20 min line.", "No reports in the last hour", "You're 140 m away. Get closer to post." |
| Designed states | Skeletons (lists, venue, profiles), one-sentence empty states with an action, inline retry for errors, an offline banner, a stale-data notice on the map |
| Accessibility | Every control labelled; VoiceOver reads vibe in words ("Velvet, Packed, 2 friends going"); comments and photos are single elements with Report/Block/Edit/Reply in the actions rotor; 44 pt targets; errors announced; color never the only signal (words next to every vibe color, labelled markers when zoomed in) |

## App Store requirements

| Requirement | How |
|---|---|
| 1.2 User-generated content | Terms with a no-tolerance line, agreed at sign-up; Report on every photo, comment, reply and profile; Block on every author; reported content hidden for the reporter; moderator queue in the app; server-side objectionable-language filter |
| 5.1.1(v) Account deletion | Profile → Delete account → Delete account (plus the system confirmation); explains the effect, asks for the password, confirms on the welcome screen |
| 5.1.1 Sign-in | Browsing works without an account; only posting, plans and following need one |
| 5.1.1 Permissions | When-in-use location only, after a pre-permission screen; camera requested at first use; library through the system picker (no permission); clear purpose strings; denied states point to Settings |
| 5.1.2 Privacy | Privacy label answers in `STORE.md` match what the backend stores; no tracking; privacy manifest |
| 4.0 Design | Native navigation, sheets, action sheets, alerts, search bar, grouped lists, haptics and Dynamic Type |
| Age | 18+ rating; sign-up requires 21+ |
| Encryption | `ITSAppUsesNonExemptEncryption: false` |

## Verification

- `npm run check`: `tsc` clean, ESLint clean (0 warnings), Jest 156 tests passing (summary in `REVIEW-BUNDLE.txt`).
- `npm run test:live`: the app's client against the running local backend, parsing every response with the app's
  contract, including owner writes and promo times: 5/5.
- `npx expo-doctor`: 21/21. `npx expo export --platform ios`: bundles.
- Required tests: API client parsing, formatting helpers (money, age, distance), design-token lint rule, report bar
  states (inside, outside, cooldown), delete-account flow, dev simulator unreachable in production.

## Known gaps

- **Not run on a device or simulator.** No iOS Simulator runtime is installed on this Mac and EAS isn't logged in,
  so visual checks, "no console warnings in Expo Go" and 60 fps were not verified by running the app. Items marked
  "check on device" in `DECISIONS.md`: pull-to-refresh inside the venue form sheet, VoiceOver on compact date pickers.
- **No EAS build yet** (needs `eas login`); commands are in `README.md`.
- **Backend not deployed**; `eas.json` assumes `preview.nostos.app` and `nostos.app` (see `../backend/DEPLOY.md`).
  The App Review account must be created on production by hand (steps in `STORE.md`).
- **`ascAppId`** in `eas.json` and the reviewer contact in `STORE.md` are placeholders until the App Store Connect
  record exists.
- **No password reset** (the backend has no endpoint for it).
- **No push notifications, no map clustering** (fine at EV/LES density; revisit if the venue count grows).
- **Screenshots** aren't captured; `STORE.md` has the plan.
- **Legal pages** need a real support inbox and legal review before launch (backend repo).

## Social layer (`feature/social`, Phases 6-7)

Screens for the backend's social layer, built on the same design system and rules as above. Judgment calls are in
`DECISIONS.md` ("Social layer"), the work and reviewer findings in `AI-LOG.md`, and what to check on a phone in
`DEVICE-CHECKLIST.md`.

| Area | What's there | Where |
|---|---|---|
| Profiles (own and others', one screen) | Photo, name, handle + verified badge, bio, tappable counts, "Regular at ___" chips, "Featured at ___, <month>", Posts grid (3 columns, paged by the server's cursor), Places (small dark map + list with latest rating); limited state for private accounts you don't follow; Follow / Requested / Following. Own: Edit profile, Follow requests with the pending count, Activity; Settings in the header | `features/people/profile-screen.tsx`, `profile-tabs.tsx`, `app/(app)/profile.tsx`, `user/[handle].tsx`, `settings/index.tsx` |
| Edit profile | Photo (system picker), name, bio (150), Private toggle with a one-line explanation; "Approve N pending requests?" after going public | `app/(app)/edit-profile.tsx`, `features/people/edit-profile.ts` |
| People | Follow requests (approve, decline, approve all), Followers / Following (Remove follower on your own), Activity (requests, new followers, likes, featured), search rows with avatars and badges | `follow-requests.tsx`, `connections.tsx`, `activity.tsx`, `features/people/person-row.tsx`, `use-requests.ts` |
| Post composer | In-app camera only (no library for posts), then the 1-10 rating picker (haptics; one adjustable control for VoiceOver), caption (280), Share to venue page (default on for public, off for private). No rating = a live photo, as before. Outside the venue: the server's message on the tile | `app/(app)/venue/photo.tsx`, `components/ui/rating-picker.tsx`, `features/posts/composer.ts`, `features/photos/upload-store.ts` |
| Posts and likes | Post detail (author per privacy, venue, rating, caption, likes; Report / Block, or Edit / Delete from profile), Edit post (rating until 5am). Likes: heart and double-tap (never unlikes), optimistic across every cache holding the post | `app/(app)/post/*`, `features/posts/*` |
| Venue page | "This month's best", past months ("August's best"), month gallery grouped by night; likes, verified and Regular badges in the photo viewer and comments | `features/venue/featured-section.tsx`, `app/(app)/venue/featured.tsx`, `venue/photos.tsx`, `features/comments/comments-section.tsx` |
| Design system | `VerifiedBadge` (champagne diamond with a check; `colors.verified`, not the accent, not blue), `titleAccessory` on list rows, `Avatar` photos, new tokens (`aspect`, `verifiedDiamondScale`, badge sizes) | `components/ui/*`, `src/theme/*` |

### Privacy in the app
The server decides who sees what; the app never infers it. `AuthorView` arrives resolved: "@handle" (with badges and a
profile link), "Anonymous" or "Deleted user" (no badge, no link, still reportable and blockable by content). Limited
profiles have their own response shape, so the screen can't show fields it never received. Tests:
`features/people/__tests__/profile.test.tsx` (limited, full and own states; author label; follow button states),
`features/venue/__tests__/featured.test.tsx` (Anonymous and badged authors).

### Checks
- `npm run check`: tsc clean, ESLint 0 warnings, Jest **193/193** (24 suites).
- `npm run test:live` against the seeded local backend: **6/6**, including the social endpoints.
- `npx expo export --platform ios` bundles.
- Required tests present: rating picker, follow button states, author label, the composer's share default and
  camera-only rule, the profile's limited state (plus likes cache, edit rules, featured section, client paths).

### Known gaps (social)
- **Not run on a device or simulator** (none on this Mac). `DEVICE-CHECKLIST.md` lists what to check: the rating
  picker's cell size, single vs double tap in the viewer, the Places map, modals above the venue sheet.
- Camera-only is an app rule; the server can only check the upload's coordinates against the geofence.
- No push notifications (Activity is in-app only).
