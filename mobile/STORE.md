# App Store listing: Nostos (draft)

Everything to paste into App Store Connect, as a first draft. Placeholders are marked **REPLACE**. Age rating, privacy
labels and review notes touch legal questions that are open in `../OPEN-QUESTIONS.md`; treat them as drafts until a
lawyer has seen them. Nothing here has been submitted.

## Basics

| Field | Value |
|---|---|
| Name | Nostos |
| Subtitle (30) | A passport for New York |
| Bundle ID | `com.charlesjinn.nostos` |
| Primary category | Social Networking |
| Secondary category | Travel |
| Age rating | decide with the lawyer (see below) |
| Price | Free |
| Availability | United States |
| Privacy Policy URL | `https://nostos.app/privacy` (placeholder host, page needs a rewrite) |
| Terms (EULA) | `https://nostos.app/terms` (same) |
| Support URL | `https://nostos.app/support` (same) |

## Promotional text (170)

Go somewhere in New York, get a stamp. Your profile is a passport of places, with a photo, a few words or a song from each.

## Description

Go somewhere. Get a stamp.

Nostos is a passport for New York. Every time you go somewhere, you can stamp it: a photo, a caption, a song, or any mix.
Your profile is your passport, a collection of every place you have been.

ONLY WHEN YOU'RE REALLY THERE
You can only stamp a place when your phone is inside its geofence. We check on our server, so every stamp is a real visit.

PRIVATE BY DEFAULT
Only people you approve see your stamps and places. Make your passport public if you want to, and Nostos tells you exactly
what that changes first.

YOUR FEED, IN ORDER
Home shows stamps from the people you follow, newest first. No ranking, no suggestions, nothing you didn't choose.

SAFE BY DESIGN
Report any stamp or account in two taps. Block anyone. Moderators review reports, and you can delete your account from the
app at any time. Nostos is for adults 21 and over.

## Keywords (100)

`passport,stamps,nyc,new york,places,check in,travel,photos,music,friends,private,memories`

## What's new (1.0)

First release.

## Privacy ("nutrition label"), draft

Tracking: **No.** No analytics, ads or tracking SDKs. Error reporting (Sentry) is off by default; if a build turns it on,
add "Diagnostics" (see `../OPEN-QUESTIONS.md` L5).

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact info: Email address | Yes | Yes | No | App functionality (account, sign-in) |
| Contact info: Name | Yes | Yes | No | App functionality (the display name on your passport) |
| Identifiers: User ID | Yes | Yes | No | App functionality |
| Location: Precise location | Yes | Yes | No | App functionality (confirm you are at a place when you stamp; the position is kept with the stamp for auditing and is never shown to anyone) |
| User content: Photos | Yes | Yes | No | App functionality (location data is stripped from the file) |
| User content: Other user content | Yes | Yes | No | App functionality (captions, the song you attach, likes) |
| Usage data: Product interaction | Yes | Yes | No | App functionality (who you follow and block) |
| Birthdate | **No** | | | Checked once for 21+ and never stored |

Location is when-in-use only. After account deletion, stamps are hidden and the account is anonymized.

## App Review information

- **Sign-in required?** No: reviewers can tap **Look around first** (a birthdate check) and look up public passports.
  Stamping, following and likes need an account.
- **Demo account** (geofence-exempt): Email `appreview@lastcall.dev`, Password **REPLACE**.
- **Notes for the reviewer:**

  > Nostos is a passport for New York: you stamp places you visit with a photo, a caption, a song, or any mix. A stamp
  > can only be made within the place's geofence, checked on our server. Because you are likely outside New York, the
  > demo account above is exempt from that check so you can try stamping from anywhere. Its stamps are visible only to
  > that account.
  >
  > To try it: sign in with the demo account, tap the Stamp tab, choose a place from the list, add a photo, a caption or a
  > song, and tap Stamp. Song search uses Apple's public iTunes Search API through our server; nothing plays.
  >
  > User-generated content: every stamp and profile can be reported (the "..." menu) and its author blocked. Reports go to
  > moderators, who can hide stamps and suspend accounts. The Terms prohibit objectionable content and abusive users, and
  > objectionable language is filtered on the server.
  >
  > Account deletion: Passport (gear) > Delete account.
  >
  > Location is requested with an explanation screen first, and only while the app is in use. Nostos is for people 21 and
  > older: sign-up and guest browsing ask for a birthdate, which is checked once and never stored.

- **Contact:** **REPLACE** name, phone, email.

## Before submitting (blockers)

1. Deploy the backend (see `../backend/DEPLOY.md`) and create the review account (sign up, then
   `pnpm user:role` is not needed: ask an admin to set the geofence-exempt flag with `PATCH /api/admin/users/appreview`).
2. Replace `support@REPLACE-ME` in `backend/src/components/legal/LegalPage.tsx` with an inbox you answer, and have a lawyer
   rewrite and review Privacy and Terms (they are drafts carried over from Last Call).
3. Settle the open legal questions in `../OPEN-QUESTIONS.md` (songs, age gate, age rating, geolocation disclosures).
4. Set `ascAppId` in `eas.json`, then `eas build` and `eas submit`.
5. Screenshots from a preview build with the demo seed: the feed, a passport (Stamps view), the Places view, a stamp with a
   song, the composer.
