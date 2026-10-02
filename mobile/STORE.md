# App Store listing: Nostos

Everything to paste into App Store Connect. Placeholders are marked **REPLACE**.

## Basics

| Field | Value |
|---|---|
| Name | Nostos |
| Subtitle (30) | Live bar vibes, lines and cover |
| Bundle ID | `com.charlesjinn.nostos` |
| Primary category | Travel |
| Secondary category | Social Networking |
| Age rating | 18+ (see below) |
| Price | Free |
| Availability | United States |
| Privacy Policy URL | `https://nostos.app/privacy` |
| Terms (EULA) | Custom EULA: `https://nostos.app/terms` |
| Support URL | `https://nostos.app/support` |
| Marketing URL | optional |

## Promotional text (170)

Friday night, sorted. See which East Village and Lower East Side bars are packed right now, how long the line is, and what the door is charging.

## Description

Know before you go.

Nostos is a live map of bars in the East Village and the Lower East Side, updated by the people who are there right now.

LIVE, FROM THE ROOM
Every bar shows its vibe: Packed, Busy, Chill or Dead. Tap one to see the line, the cover, and how fresh each update is. When there aren't enough recent reports, Nostos says so instead of guessing.

POST WHAT YOU SEE
At a bar? Tap once to share the vibe, the line or the cover. Add a photo of the room. Updates only count when you're actually there, so what you see is real.

TONIGHT'S PLANS
Tap "I'm going" and friends who follow you back can see where you're headed. Find people by name or handle.

STRAIGHT FROM THE VENUE
Venues post their own hours, cover and dress code, labelled "From the venue". When what the venue says doesn't match what people report, you'll see both. Paid promotions are always labelled "Promoted" and never change where a bar appears.

SAFE BY DESIGN
Report any photo, comment or account in two taps. Block anyone. Moderators review reports, and you can delete your account from the app at any time.

For adults 21 and over. Please drink responsibly.

## Keywords (100)

`bars,nightlife,nyc,east village,lower east side,line,cover,vibe,going out,tonight,map,drinks,club`

## What's new (1.0)

First release.

## Age rating answers (18+)

| Question | Answer |
|---|---|
| Alcohol, Tobacco, or Drug Use or References | **Frequent/Intense** (the app is about bars) |
| Unrestricted Web Access | No (the in-app browser only opens our legal pages and OpenStreetMap's copyright page) |
| User-Generated Content | Yes (photos, comments; moderation, report and block are in the app) |
| Messaging / chat | No |
| Gambling, contests | No |
| Sexual content, nudity, violence, profanity, horror, medical | None |
| Mature/Suggestive Themes | None |
| Made for Kids | No |
| In-app controls (parental controls, content filtering) | Content filtering: yes (objectionable-language filter, report and block); no parental controls |
| Age assurance | Self-declared: sign-up requires confirming 21 or older |

Result: **18+**. In-app, sign-up also requires "I'm 21 or older".

## App privacy ("nutrition label")

Tracking: **No.** No third-party analytics, ads or SDKs that track.

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact info: Email address | Yes | Yes | No | App functionality (account, sign-in) |
| Contact info: Name | Yes | Yes | No | App functionality (the display name shown on your profile) |
| Identifiers: User ID | Yes | Yes | No | App functionality |
| Location: Precise location | Yes | Yes | No | App functionality (confirm you're at a venue when you post, and "here now" check-ins while a venue is open; stored with your reports and photos) |
| User content: Photos | Yes | Yes | No | App functionality (venue photos you post; location data is stripped from the file) |
| User content: Other user content | Yes | Yes | No | App functionality (vibe/line/cover reports, comments) |
| Usage data: Product interaction | Yes | Yes | No | App functionality (plans you RSVP to, who you follow and block) |
| Diagnostics | No | | | |
| Contacts, health, financial, browsing/search history, purchases, sensitive info | No | | | |

Location is when-in-use only and never collected in the background. Coarse location is not collected separately.
After account deletion, reports keep their coordinates without any identity (as the privacy policy says).
Security logs (sign-in attempts with IP address) are kept briefly for abuse prevention and pruned automatically.

## App Review information

- **Sign-in required?** No. Reviewers can tap **Look around first** to browse without an account. Posting, plans and following need an account.
- **Demo account** (geofence-exempt, on **production**, which is what the reviewed build uses):
  - Email: `appreview@lastcall.dev`
  - Password: **REPLACE** (the one you choose in "Create the review account" below)
- **Notes for the reviewer:**

  > Nostos shows live conditions at bars in two New York neighborhoods (East Village and Lower East Side). To keep
  > reports honest, posting a vibe, line, cover or photo only works within 100 m of the venue; this is checked on our
  > server. Because you're likely outside New York, the demo account above is exempt from that check so you can try
  > posting from anywhere. Posts from the demo account are visible only to that account and are never counted.
  >
  > To try it: sign in with the demo account, tap any bar on the map (or in the list), then use the bar at the bottom
  > of the venue sheet (Vibe, Line, Cover, camera). Live data depends on people nearby, so outside New York's
  > evening hours many bars will show "No reports in the last hour"; that neutral state is expected.
  >
  > User-generated content: every photo, comment and profile can be reported (the "..." menu or long-press), and every
  > author can be blocked. Reports go to our moderators, who can hide content and suspend accounts. The Terms prohibit
  > objectionable content and abusive users, and objectionable language is filtered on the server.
  >
  > Account deletion: Profile (top-right avatar on the map) → Delete account → Delete account.
  >
  > Location is requested with an explanation screen first, and only while the app is in use.

- **Contact:** **REPLACE** name, phone, email.

## Screenshots

Capture on the **preview** build with the demo seed loaded (run the seed just before, so "tonight" looks live).
Dark UI; caption text is set in SF Pro Display Bold, white, on the `#0A0A0D` background above the device frame.

Required sizes: **6.9"** (iPhone 16/17 Pro Max, 1320 × 2868) and **6.5"** (iPhone 11 Pro Max / XS Max, 1242 × 2688).
Use the same six shots and captions for both.

| # | Screen | State to set up | Caption |
|---|---|---|---|
| 1 | Map, sheet at peek | Default map region, several Packed and Busy markers, one friend badge | Know before you go. |
| 2 | Venue sheet, Live now | A Packed venue with vibe, line and cover all "ok", friends going | Packed. 20 min line. |
| 3 | Report sheet (vibe chips) | Open from the report bar at a venue | Post what it's like in one tap. |
| 4 | Venue photos | Live grid with 5–6 photos, "Earlier" collapsed | See the room before you get there. |
| 5 | Home sheet at half, Going tonight | Going tonight segment, avatars on rows | See where your friends are headed. |
| 6 | Venue Details + mismatch | A venue with an official cover and a mismatch callout | Venue says $10. People say $20. |

Optional 7th: Profile with Following and plans ("Plans, only with people who follow you back.").

## Create the review account (production)

Production has no demo seed, so create the account there by hand after deploying:

1. Sign up in the production app (or at `https://nostos.app/signup`) as `appreview@lastcall.dev`, handle
   `appreview`, with a password you'll put in App Review Information.
2. Make it geofence-exempt. Sign in as an admin with the iOS header to get a token, then set the flag:

   ```bash
   curl -s -X POST https://nostos.app/api/auth/login -H 'Content-Type: application/json' -H 'X-Client: ios' -d '{"email":"<admin email>","password":"<admin password>"}'
   ```

   ```bash
   curl -s -X PATCH https://nostos.app/api/admin/users/appreview -H 'Authorization: Bearer <token from above>' -H 'Content-Type: application/json' -d '{"geofenceExempt":true}'
   ```

   Its posts are then visible only to itself and never counted.

## Before submitting (blockers)

1. Deploy the backend (see `../backend/DEPLOY.md`) and create the review account above.
2. **Replace `support@REPLACE-ME`** on the web legal pages (`backend/src/components/legal/LegalPage.tsx`) with an
   inbox you answer, and have a lawyer review Privacy and Terms. An unanswerable support contact is a rejection risk.
3. Set `ascAppId` in `eas.json` (both `preview` and `production` submit profiles).
4. `eas build --profile production --platform ios`, then `eas submit --profile production --platform ios`.
5. Screenshots from the preview build (demo seed), per the plan above.
