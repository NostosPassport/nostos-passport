# Last Call: social layer (profiles, privacy, posts, verified badge, Regulars, likes and featured photos)

You are the builder. The repo is `~/lastcall` with `backend/` and `mobile/`. Before writing code, read the root `README.md`, `CONTRIBUTING.md` (if present), both `REVIEW.md`, `DECISIONS.md` and `AI-LOG.md` files, `backend/API.md`, and `mobile/STORE.md`.

Work on a new branch, `feature/social`, created from the latest `main`. Work autonomously through every phase without stopping for approval. Commit after each phase, run the reviewer subagent, fix what it finds, and continue. Stop only for credentials, and only at the end. Log judgment calls in the relevant `DECISIONS.md`, and anything that needs a product decision from me in `OPEN-QUESTIONS.md` (make a sensible default choice and keep going; don't block on it).

## Product context

Last Call is a live nightlife map. This phase adds an Instagram-style social layer that creates exclusivity through **recognition, not access**: anyone can join, but status is earned (Regular at a venue, featured photos) or granted (verified badge).

## Rules that must not break

- Everything in the existing hard invariants and privacy decisions still holds: venues can't edit, hide, reorder, or rank user content; paying never buys influence; no user coordinates in any payload; plans stay mutual-friends only; owner report views stay anonymous; App Review (`countable = false`) data never counts.
- **Nothing in this phase changes the live data.** Posts, ratings, likes, featured status, verification, and Regular status never affect consensus, counts, accuracy, or reputation. Live reports stay anonymous to the public exactly as they are.
- **Bars cannot pick, hide, remove, or reorder posts, likes, or featured photos.** They can only report content to moderators, like everyone else.

## Feature 1: Profiles, followers, follow requests

- Profile fields: handle (unique, required), display name, profile photo (optional, uploaded and re-encoded through the existing sharp pipeline), bio (max 150 chars, run through the existing content filter).
- Counts: posts, followers, following.
- **Follow requests:** following a **private** account creates a pending request that the owner approves or declines. Following a **public** account is instant. Users can cancel their pending requests and remove existing followers.
- Existing follows are migrated as already approved.
- "Friends" for plans stays **mutual approved follows**, as it works today.
- Blocking removes follows and pending requests in both directions and prevents new ones, as it does today.

## Feature 2: Private vs public accounts

- **Every account starts private,** including existing accounts (migrate them to private).
- One toggle in profile settings switches between private and public, like Instagram.
- **What a viewer sees of a private account they aren't an approved follower of:** only the handle and a generic avatar, plus a "This account is private" state with a Request to follow button. No display name, profile photo, bio, posts, Regular badges, or featured history.
- **Approved followers and the owner** see everything.
- **Public accounts:** everyone sees everything on the profile.
- **Author display on venue pages** (shared photos, comments, replies) is resolved **per viewer**: public accounts and private accounts the viewer follows show the handle (and verified badge if any); private accounts the viewer doesn't follow show "Anonymous", with no handle and no link to the profile. The server must enforce this in every payload; never send a private author's handle to a viewer who can't see it. Add tests for every payload that includes an author.
- Switching private to public doesn't auto-approve pending requests; approve them all in one action with a prompt ("Approve 4 pending requests?").
- Moderators and admins always see real authors.

## Feature 3: Posts (photo + rating, proof of presence)

A **post** is the permanent, profile-level version of being somewhere. Live reports stay separate and unchanged.

- **The photo must be taken with the in-app camera, at the venue.** No camera-roll uploads for posts. The server accepts a post photo only if the upload's coordinates are inside the venue's geofence at capture time (reuse the existing geofence check and cooldown logic). Keep EXIF stripping.
- **Rating: whole number from 1 to 10, required.** A photo without a rating is not a post and does not appear on the profile.
- **Caption:** optional, max 280 characters, content-filtered.
- **Flow:** take the photo at the venue, then pick the rating and optionally add a caption. The rating and caption can be added or edited until the end of that night (the existing 5am America/New_York night boundary). After that, the rating is locked; the caption stays editable (use the existing comment edit-lock rules as a model: frozen once reported with an open flag).
- **"Share to venue page" toggle** on each post: default **on** for public accounts and **off** for private accounts. Shared posts appear in the venue's live photo feed (existing 3-hour live window and "Earlier" rules) and are eligible for likes and featuring. Unshared posts appear only on the author's profile.
- The existing live photo flow for non-post photos keeps working as it does. Decide whether it should be merged into the post flow (post without rating becomes a live-only photo) or kept separate, pick the simpler clean option, and document it.
- Owners still can't post for their own venue (existing rule).
- Account deletion hides all of the user's posts and removes their likes, using the existing anonymize pattern.
- **Venue average ratings are not shown anywhere in this phase.** Store ratings so an average can be added later, and note it in `OPEN-QUESTIONS.md`.

## Feature 4: Verified badge

- Admin-only, handpicked. **No application flow.**
- Admin web tools: search users, grant or revoke verification with a required note. Every grant and revoke is logged in an append-only table (DB trigger rejecting UPDATE and DELETE, like the moderation log).
- The badge shows next to the handle everywhere the handle shows (profiles, search, comments, photos, follower lists), only where that viewer is allowed to see the handle at all. It never appears on "Anonymous".
- **Badge only.** Verification never changes ranking, featured eligibility weight, consensus, or anything else.
- Design: one small custom badge in the theme (not the accent color, not blue, not a copy of Instagram's). Add it to the design system with a VoiceOver label "Verified".

## Feature 5: "Regular at ___"

- A user is a **Regular** at a venue when they have posts there on **at least 3 different nights within the last 60 days**. Hidden posts don't count. Keep the thresholds as named constants in one module.
- Regular status is computed, never stored as an editable field (same principle as the accuracy score). Cache it if needed for performance, but the source of truth is the posts.
- Shown on the profile as a row of venue badges ("Regular at Lantern & Lark"), subject to privacy rules, and next to the user's handle on that venue's page when the viewer can see the handle.
- A user can be a Regular at several venues.

## Feature 6: Likes and the featured gallery

**Likes**
- Any signed-in user can like a **shared** post (on the venue page or the author's profile, if they can see it). One like per user per post. You can't like your own post. Unlike is allowed.
- Show the like count and whether the viewer liked it. Double-tap on the photo to like, plus a heart button, with a haptic.

**Eligible likes** (the only ones that count toward featuring; everyone can still like)
- From a USER account at least 7 days old with reputation at least 0.5
- Not from the post's author
- Not from an owner of that venue
- Not from a `countable = false` account
- Put these rules in one pure, unit-tested module.

**Nightly featuring**
- A protected cron endpoint, `POST /api/cron/featured` (same `CRON_SECRET` pattern as the reputation job), runs just after each night ends (5:05am America/New_York). Add it to `DEPLOY.md` for cron-job.org.
- For each venue and the night that just ended, rank that night's shared, visible posts by eligible likes at the time of the run (ties: earlier post wins). Store the **top 20 with their rank** in a `featured_photo` table. Display the **top 10 visible** ones. If a featured photo is later hidden by a moderator, the next-ranked visible photo takes its place automatically.
- A post needs **at least 3 eligible likes** to be featured.
- Idempotent: rerunning for the same night produces the same result and never duplicates. It must be safe if the cron is late or runs twice.

**On the bar's page**
- A "This month's best" gallery showing all featured photos from the current calendar month (by night date in America/New_York), newest night first.
- **Monthly reset:** at the start of each month the gallery starts empty; past months move to an archive section on the bar's page ("September's best", and so on), newest month first.
- Author display follows the per-viewer rules from Feature 2.
- Every photo keeps the existing Report action.

**On the profile**
- "Featured at Lantern & Lark, October" entries, subject to privacy rules.

## Mobile app

Follow the existing design system strictly (tokens only, SF Symbols, the anti-pattern list, copy tone). New and changed screens:

- **Profile (own and others):** header with photo, display name, handle and badge, bio, counts, Regular badges row, and tabs: **Posts** (3-column grid) and **Places** (a small dark map of every venue the user has posted at, plus a list with their rating). Private-and-not-followed state. Follow, Requested, and Following button states. Your own profile has Edit profile and Settings.
- **Edit profile:** photo, display name, bio, and the Private account toggle with a one-line explanation of what it does.
- **Follow requests** screen: approve and decline, with a badge count on the profile entry.
- **Activity** screen: follow requests, new followers, likes on your posts, and "You were featured at ___". In-app only; no push notifications in this phase.
- **Post composer:** in-app camera only, then the 1 to 10 rating picker (a horizontal row of tappable numbers with haptics, clearly readable, accessible), caption, the Share to venue page toggle with its default, then post. Clear errors for being outside the venue.
- **Post detail:** photo, author (per privacy rules), venue, rating, caption, likes, and actions (Like, Report, Block author; Edit and Delete-from-profile for your own; delete means hide, following the existing no-delete rule).
- **Venue page:** the new "This month's best" section and its archive, likes on shared photos, Regular badges next to handles.
- **Followers and Following lists**, with remove-follower on your own.
- Update search results to show badges and respect privacy.

## Backend and contract

- Migrations for all new tables and columns, with DB-level guarantees where the existing code uses them (append-only audit tables, no deletes of content rows, CHECK constraints for rating 1 to 10).
- Authorization checks on every new route, and IDOR tests (user A can't approve user B's requests, see B's private posts, like as someone else, or read B's activity).
- Rate limits: follows and requests, likes, and posts, following the existing advisory-lock pattern.
- Update `API.md`, `backend/src/contracts/api.ts`, and the mobile contract copy. The contract drift test must pass.
- Update the demo seed with a realistic mix: public and private accounts, pending requests, posts with ratings at several venues, a few Regulars, likes, two past months of featured photos, verified accounts, and at least one private user whose shared photo shows as Anonymous to others. Keep it deterministic.

## Phases (commit points, not stopping points)

1. Schema, migrations, privacy resolution module (who can see what), with exhaustive tests
2. Follows, requests, private/public, blocks integration
3. Posts, ratings, the camera-only proof rule, sharing to the venue page
4. Verified badge and admin tools, Regular computation
5. Likes, eligibility, nightly featuring job, monthly gallery and archive
6. Mobile screens for all of the above
7. Seed update, polish pass, `DEVICE-CHECKLIST.md` additions for these features

After each phase: run typecheck, lint, and all tests in both folders. Spawn a reviewer subagent: "Review this phase's diff against the spec, the Rules that must not break, and the privacy rules. Look specifically for private-account data leaking to viewers who shouldn't see it, IDOR, and ways to game likes or featuring. List concrete bugs with file and line." Fix real findings, commit, append to `AI-LOG.md`, and continue.

## When done

1. Everything green in both folders, including CI if it exists.
2. Update both `REVIEW.md` files and regenerate the bundles as `REVIEW-BUNDLE-backend.txt` and `REVIEW-BUNDLE-mobile.txt`.
3. Push `feature/social` and open a pull request with `gh pr create` summarizing the features, the privacy model, and the decisions in `OPEN-QUESTIONS.md`.
4. Tell me in plain language what was built, how to try each feature on my phone, and what needs my decision.
