# Nostos build prompt

Checkboxes are hints. Git history, the gate and the tests are the truth. A session that picks up a task must first prove it is not already done (find its code and its test).

You are the builder for Nostos. Work autonomously. Phases are commit points, not stopping points. Do not ask for approval between steps. Stop only if truly blocked, and then write what you need to OPEN-QUESTIONS.md.

## 0. What Nostos is
A native iPhone app (Expo, iOS only) with a "passport" model. You go to a place in NYC, you get a stamp. Your profile is your passport, a collection of stamps. Every stamp is a post and can carry a photo, a caption, a song, or any mix (at least one). You can only stamp a place if your phone is inside its geofence (server-checked). Accounts are private by default. Nostos is a fork of the Last Call project, keeping its social layer and dropping everything else. The name is Greek for the longing to return home.

## 1. Fork (do this first)
- [x] 1.1 Run `df -h /`. If under 5 GB free, stop and tell the user.
- [x] 1.2 The source is the Last Call repo (found at /Users/charlesjinn/lastcall, which has backend/, mobile/ and HANDOFF.md; ~/Downloads/lastcall-feature-social did not exist). NEVER edit the source. It is the archive.
- [x] 1.3 Copy it to ~/nostos (exclude node_modules, .next, .expo, .git). `git init` there, branch `build`, one baseline commit. No remote. Never push, never open a PR.
- [x] 1.4 Rename everything: app name Nostos, bundle id and scheme nostos, docker compose project nostos, Postgres on port 5435 with databases nostos and nostos_test, so both projects can run side by side.

## 2. Write the infrastructure BEFORE building features
A builder session is disposable and stateless: each session reads the prompt file plus CLAUDE.md and ENGINE.md, checks what is already done, does the work, commits and writes a review. Anything not committed is expendable. Durable knowledge lives only in the repo. Limits are enforced by gates and ledgers, never by the builder's word. The reviewer verifies claims instead of trusting reports.

Create at the repo root:
- [x] 2.1 NOSTOS-BUILD-PROMPT.md: a copy of this entire prompt, with a checkbox next to every task.
- [x] 2.2 CLAUDE.md: what Nostos is, repo layout, glossary (stamp = a row in the `photo` table, kept to avoid migration churn, but API, contract and UI say "stamp"), the rules in section 5, the team rules in section 6, commands, "read CLAUDE.md, ENGINE.md, NOSTOS-BUILD-PROMPT.md, DESIGN.md first".
- [x] 2.3 ENGINE.md: the session loop (orient with git log, LEDGER.md tail and reviews/, run the gate for a baseline, take the first unfinished task and prove it is not already done by finding its code and test, build test-first, gate, commit one task at a time as `phase N: <what>`, write a review file, continue), the hard stops (no push, no editing the archive, never loosen or skip a test or gate, no dependency without a DEPENDENCIES.md line, no legal decisions, no copying a real app's assets), and the review template: commit range, last 15 lines of gate output, each "Done" line with file:line plus test name, claims not proven, decisions, open questions, gaps, next task.
- [x] 2.4 DESIGN.md: see section 8 (missing from the prompt, see OPEN-QUESTIONS.md #4).
- [x] 2.5 scripts/gate.sh (the only definition of green), failing fast in this order: 5 GB free disk; no tracked .env, no file over 5 MB, no node_modules tracked; backend typecheck, lint, test (single process, never parallel); mobile `npm run check` and the contract-sync test; the invariants suite must exist and pass (backend/tests/integration/invariants.test.ts, one test per rule in section 5; deleting or skipping it fails the gate); dependency ledger (any package.json change needs a matching DEPENDENCIES.md line: name, version, why). On success it appends one line to LEDGER.md (UTC time, commit, backend test count, mobile test count). The gate is the only writer of LEDGER.md.
- [x] 2.6 LEDGER.md, DEPENDENCIES.md (seed it with current key deps), reviews/ (with a .gitkeep), per-folder DECISIONS.md and AI-LOG.md, and OPEN-QUESTIONS.md (carry over the existing one, then prune it to what still applies).
- [x] 2.7 Update both make-review-bundle scripts to write REVIEW-BUNDLE-backend.txt and REVIEW-BUNDLE-mobile.txt, and to include every src/app/api route handler, every test file, mobile/src/api/contracts.ts, mobile/src/auth/auth-context.tsx, the schema, migrations, DECISIONS.md, OPEN-QUESTIONS.md and the latest review file.
- [x] 2.8 Commit. Run the gate.

## 3. Strip (delete, in the new repo only)
Delete the code, routes, tests, screens, seed data and docs for:
- [x] 3.1 live reports (vibe, line, cover)
- [x] 3.2 consensus
- [x] 3.3 the accuracy score
- [x] 3.4 venue owner dashboards and claims
- [x] 3.5 promos
- [x] 3.6 the crowd map colors and report bar
- [x] 3.7 RSVP and "going tonight" and presence counts
- [x] 3.8 comments and replies
- [x] 3.9 the monthly featured gallery and nightly featuring (and the cron job and its docs)
- [x] 3.10 Regular badges
- [x] 3.11 block-by-content for Anonymous authors. Nothing in Nostos is shown as "Anonymous": a stamp is only ever shown to people who may see the author's full profile.

KEEP: auth and sessions (token auth for iOS), users, handle and bio and avatar, follows and follow requests, private and public accounts, blocks by handle, reporting and the moderation queue, account deletion, the privacy module, the geofence check, photo upload with EXIF stripping, likes (drop the featuring eligibility rules, keep it simple: one like per user per stamp, not your own, not on hidden or removed stamps), rate limits, content filter, verified badge with its append-only log, activity, storage, the append-only moderation log.
- [x] 3.12 Keep the venue table as "places" (name, location, geofence), with no live data. Keep the map, but as a map of stamps (a "Places" view on a passport), with no vibe colors.
- [x] 3.13 Handle DB cleanup with new forward migrations that drop the removed tables and columns, so the hand-written trigger history stays valid. Use `prisma migrate diff`, create the directory after generating, then `migrate deploy` and `prisma generate`. Never `migrate reset`.
- [x] 3.14 Remove dead code, dead contract entries and dead mobile query hooks. Run the gate after every removal batch. Commit per batch.

## 4. Build

### Phase 1: privacy foundation (these are launch blockers)
- [x] 4.1.1 Stamps and places of a private account reach only people with full access, in every payload: profile, stamp detail, feed, search, activity, lists. Add tests for signed out, stranger, requester (pending is not enough), follower, self, staff, blocked.
- [x] 4.1.2 Blocking by handle hides the pair from each other everywhere (profile, search, lists, feed, activity, likes). Test that nothing leaks either direction.
- [x] 4.1.3 Per-stamp visibility = the account's privacy. No "share to venue page" toggle.
- [x] 4.1.4 Going public changes what strangers can see (all stamps and places). The mobile app must show a confirm alert listing exactly that before switching private to public.

### Phase 2: stamps (backend)
- [x] 4.2.1 Make `photo.storage_key` nullable. Add nullable song fields (title, artist, album art URL, source id). Add a CHECK that at least one of photo, caption (non-empty) or song exists. Caption max 280. Update the immutability triggers carefully: stamps stay immutable except caption, song, moderation state and removed_at (final). Rating becomes optional and is not shown in the UI for v1.
- [x] 4.2.2 POST /api/places/:id/stamps (multipart: optional photo, caption, song fields, lat, lng). Geofence check server-side, EXIF stripped, per-place cooldown, post rate limit, content filter on caption and song text. Geofence-exempt accounts (App Review) are visible only to themselves.
- [x] 4.2.3 GET /api/stamps/:id (visibility rules), PATCH (caption and song, frozen while a flag is open), POST /api/stamps/:id/remove ("delete from profile" = removed_at, final), PUT and DELETE like.
- [x] 4.2.4 GET /api/feed: stamps from people you follow, newest first, cursor paging, strictly chronological, no ranking, no personalization (this keeps us outside NY's SAFE for Kids Act).
- [x] 4.2.5 Profile passport endpoints: stamps grid (cursor), places visited (distinct places with stamp count and latest stamp), counts.
- [x] 4.2.6 Songs: v1 stores metadata only (title, artist, art URL), no audio playback. Search via Apple's public iTunes Search API, proxied through our backend with a short timeout, a rate limit and no user identifiers sent. Put the licensing and terms question in OPEN-QUESTIONS.md for the lawyer session, do not decide it.
- [x] 4.2.7 Update the contract, API.md, tests for every rule, and the invariants suite.

### Phase 3: mobile passport
- [x] 4.3.1 Neutral components first (design comes in phase 5). Use theme tokens only, SF Symbols, no emoji, lint rules as already enforced.
- [x] 4.3.2 Home feed screen (followed people's stamps, chronological, pull to refresh, paging).
- [x] 4.3.3 Passport screen (own and others'): header, counts, a stamps grid, a Places view (map of places with stamp counts, plus a list), limited state for private accounts, Follow / Requested / Following.
- [x] 4.3.4 Stamp composer: choose a place near you (list of places inside or near the geofence, server confirms), in-app camera optional, caption, song picker (search), then Stamp. At least one of photo, caption, song. Show the server's message when outside the geofence.
- [x] 4.3.5 Stamp detail: photo, caption, song row, place, author, likes, Report and Block, Edit and Delete from profile for your own.
- [x] 4.3.6 Edit profile, follow requests, activity, followers and following, blocked users, settings, delete account: keep and adapt what exists.
- [x] 4.3.7 Fix known device bugs: distances over 1000 m show as "1.8 km" not "1815 m".
- [x] 4.3.8 Do not show "Sign in to post" while auth or /api/me is still loading or failed (add a "checking account" state).
- [x] 4.3.9 Make sure no sheet or screen can render blank.

### Phase 4: safety and compliance
- [x] 4.4.1 Birthdate age gate at signup and guest browsing: blocks under-21s and stores nothing about them (no DOB, no email, no record). Replace the "21+" checkbox. Legal specifics go to OPEN-QUESTIONS.md for the lawyer session.
- [x] 4.4.2 Report reasons: add underage, stalking, and "not at this place".
- [x] 4.4.3 Keep Apple Guideline 1.2 coverage: Report and Block on every stamp and profile, moderation queue, objectionable text filter, account deletion.
- [x] 4.4.4 Hook Sentry into the existing reportError hook behind an env flag (off by default, no DSN committed). Dependency ledger line required.

### Phase 5: design layer
- [x] 4.5.1 (skipped: DESIGN.md has no chosen reference, see the review) Read DESIGN.md. If it has a filled "Chosen reference" section, do a design pass: rebuild the navigation, tab bar, feed and profile layouts to match that app's patterns (the interaction model, layout structure and gestures people already know), using Nostos's own colors, icon set, name and logo. If the section is empty, skip this phase, note that in the review, and finish everything else. Never copy a real app's logo, icons, exact palette, name or proprietary assets.

### Phase 6: seed, checks, handoff
- [x] 4.6.1 Deterministic seed anchored to "now": public and private accounts, pending requests, follows, stamps with photos, captions and songs at several places, likes, one verified account, one blocked pair. Keep demo accounts (avaa@lastcall.dev style; owner and mod accounts can go, keep admin, mod_morgan and appreview), password DEV_SEED_PASSWORD or lastcall-dev.
- [x] 4.6.2 mobile/DEVICE-CHECKLIST.md for every screen and rule above (a physical iPhone is the only way to check it).
- [x] 4.6.3 Update both REVIEW.md files, regenerate both bundles, write the final review file, and finish with a plain-language summary for the user: what exists, how to try each feature on the phone, and what needs their decision.

## 5. Rules that must never break (each gets a test in the invariants suite)
1. A stamp is created only inside the place's geofence, checked server-side. Exempt (App Review) accounts are the only exception and are visible only to themselves.
2. Stamps and places of a private account never reach anyone without full access, in any payload.
3. Blocks (either direction) override everything except staff.
4. Hidden content is hidden, never deleted. The moderation log is append-only. No hard deletes of stamps.
5. EXIF and GPS are stripped from every upload.
6. No user coordinates, raw storage keys or user ids in any payload a viewer should not get.
7. Reputation is visible only to the user and moderators.
8. Under-21s are blocked at signup and nothing about them is stored.
9. The feed is chronological from people you follow, with no ranking or personalization.
10. Likes and badges never affect anything else.

## 6. Team rules
Branch `build` only. Never push, never force-push, never commit .env. Check `df -h /` before large installs. Never install Xcode. Never run two backend test processes at once (they share one test database). Use `npx expo install` for native packages and check the Expo SDK docs. No em dashes in any text you write. Legal questions go to OPEN-QUESTIONS.md, you decide nothing legal.

## 8. Design
DESIGN.md holds the design notes and the "Chosen reference" section the user fills in. Phase 5 depends on it.
