# Open questions

Decisions Nostos needs from the user (or from the lawyer session). Each has a default already built, so nothing is
blocked. Legal questions are never decided by the builder.

## Product

| # | Question | Default built | Where |
|---|---|---|---|
| 1 | **Ratings.** `photo.rating` stays in the table and becomes optional. It is not shown in the UI for v1. Do you want it back, or dropped in a later migration? | Stored when sent, never shown. | `backend/prisma/schema.prisma` |
| 2 | **Follow requests show requesters in the limited view** (handle and badge, no name or photo) when they are private and you do not follow them. Show name and photo? | Limited, per the privacy rules. | `backend/src/server/services/people.ts#listFollowRequests` |
| 3 | **GPS spoofing.** A stamp is only as trustworthy as the phone's reported location. Worth a server-side signal later (velocity checks)? | Geofence on the submitted coordinates only. | `backend/src/server/services/photos.ts` |
| 4 | **DESIGN.md section 8 was not in the build prompt** ("DESIGN.md: see section 8"). DESIGN.md was written from the prompt's other sections, with an empty "Chosen reference". Fill that section to enable phase 5. | Phase 5 skipped until filled. | `DESIGN.md` |
| 5 | **Source repo location.** `~/Downloads/lastcall-feature-social` did not exist. The fork was made from `/Users/charlesjinn/lastcall` (branch main, clean, has backend/, mobile/, HANDOFF.md). Confirm that is the right source. | Forked from `/Users/charlesjinn/lastcall`. | n/a |
| 6 | **Reputation.** The accuracy score and consensus are removed, so nothing recomputes reputation. The column stays (default 0.5), visible only to the user and moderators. Keep it for moderation use or drop it? | Kept, moderator-only, no job. | `backend/prisma/schema.prisma` |
| 7 | **The place catalog.** `pnpm venues:import` still imports only bars, pubs and nightclubs from OpenStreetMap in the East Village and Lower East Side. Nostos is about any place in NYC (parks, cafes, landmarks, shops). Which categories and which area should the real catalog cover, and who may add a place? The seed includes six landmarks by hand. | Bars only through the importer; manual or seeded places otherwise. | `backend/src/lib/osm.ts` |
| 8 | **Stamp frequency.** One stamp per person per place per 15 minutes, 20 an hour. For a passport you may want "once per place per day", or repeat visits shown differently. | The old 15 minute cooldown. | `backend/src/server/services/geofence.ts` |

## Legal (for the lawyer session; nothing here is decided by the builder)

| # | Question | Default built |
|---|---|---|
| L1 | **Song metadata licensing.** Stamps store song title, artist and album art URL from Apple's public iTunes Search API, proxied through our backend, no audio playback. Are the iTunes Search API terms and artwork usage acceptable for an app that stores and displays this metadata? Is attribution required? | Metadata only, proxied, no user identifiers sent, short timeout and rate limit. |
| L2 | **Age gate.** A birthdate check blocks under-21s at signup and guest browsing and stores nothing about them. What exactly may and must we do (storing a refusal flag to stop retries, COPPA and state rules, wording)? | Nothing stored about a refused attempt, so a retry is possible. |
| L3 | **NY SAFE for Kids Act.** The feed is strictly chronological from followed accounts, no ranking, no personalization, to stay outside "addictive feed". Is that sufficient? | Chronological feed only. |
| L4 | **Geolocation data.** Coordinates are used for the geofence check and stripped from uploads; stamp coordinates are not shown to viewers. What disclosures does the privacy policy need? | Policy text carried over from Last Call and needs a rewrite for Nostos. |
| L2b | **Age gate retries.** Nothing is stored about someone who fails the 21+ check, so they can try again with a different birthdate. Is that acceptable, or must we remember a refusal (for example a flag on the device)? The app stores nothing and never sends an under-21 birthdate to the server. | No memory of a refusal. |
| L5 | **Sentry and privacy labels.** Error reporting is built but off (needs `EXPO_PUBLIC_SENTRY_ENABLED=1` and a DSN at build time). If you turn it on, does the App Store privacy label need "Diagnostics", is a data processing agreement needed, and where should the Sentry project live (EU or US)? Events carry no user, request or breadcrumbs. | Off. No DSN in the repo. |
| L6 | **What the stamp screen says about your position.** The server saves the phone's coordinates with each stamp (columns `lat`, `lng` on the `photo` table) as the record of the geofence check; they are never in any payload. The screen says: "When you stamp, our server checks where your phone is. That position is saved with the stamp and is never shown in the app." Is that wording enough, how long may the coordinates be kept, and should they be dropped after the check instead? (Related to L4. The nearby-places and place-page endpoints do not store the position.) | Saved with the stamp, never shown. Text in `mobile/src/features/stamps/stamp-flow.ts` (`HONESTY`). |
| L7 | **The privacy policy and terms still describe the social layer** (private and public accounts, follow requests, a feed, likes, blocking). Nostos is strictly personal for this version: with `SOCIAL_ENABLED` off none of that exists and only you can see your passport. The pages were only recolored to black and brass this session; the text is unchanged because it is a legal text. It needs a rewrite for personal mode, and the "Who can see what" section should say only you. | Text unchanged. Pages: `backend/src/app/privacy/page.tsx`, `terms/page.tsx`. |
