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

## Legal (for the lawyer session; nothing here is decided by the builder)

| # | Question | Default built |
|---|---|---|
| L1 | **Song metadata licensing.** Stamps store song title, artist and album art URL from Apple's public iTunes Search API, proxied through our backend, no audio playback. Are the iTunes Search API terms and artwork usage acceptable for an app that stores and displays this metadata? Is attribution required? | Metadata only, proxied, no user identifiers sent, short timeout and rate limit. |
| L2 | **Age gate.** A birthdate check blocks under-21s at signup and guest browsing and stores nothing about them. What exactly may and must we do (storing a refusal flag to stop retries, COPPA and state rules, wording)? | Nothing stored about a refused attempt, so a retry is possible. |
| L3 | **NY SAFE for Kids Act.** The feed is strictly chronological from followed accounts, no ranking, no personalization, to stay outside "addictive feed". Is that sufficient? | Chronological feed only. |
| L4 | **Geolocation data.** Coordinates are used for the geofence check and stripped from uploads; stamp coordinates are not shown to viewers. What disclosures does the privacy policy need? | Policy text carried over from Last Call and needs a rewrite for Nostos. |
