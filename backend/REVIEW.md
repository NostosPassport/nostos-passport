# Nostos: build review

## What was built

A mobile-first Next.js 15 / React 19 / TypeScript-strict app with Prisma 6 on Postgres 16 (Docker, port 5434). It was built in 7 phases, each followed by an independent reviewer pass whose findings were fixed before moving on. See [AI-LOG.md](AI-LOG.md).

| Area | Where |
|---|---|
| Map home: pins coloured by live vibe (hollow "?" = no data, solid slate = dead), bottom sheet sorted by live activity / going tonight / distance, friend badges | `src/app/(home)`, `src/components/map/*`, `src/server/services/venues.ts#listVenuesForMap` |
| Venue page: **Official** panel (from the venue) vs **Live** panel (from people). Consensus with report count and newest-report age, cover mismatch callout, live photos (<3h) plus a collapsed "Earlier", comments with labelled venue replies | `src/app/v/[slug]`, `src/components/venue/*`, `venues.ts#getVenuePage` |
| One-tap reporting: vibe, line, cover (dollars → cents), photo + caption. 100 m server-side geofence, 15-min cooldown per type/user/venue. Dev-only location simulator | `src/server/services/reports.ts`, `photos.ts`, `src/components/venue/ReportPanel.tsx`, `src/components/location/LocationProvider.tsx` |
| Presence (45-min expiry), going-tonight RSVPs (reset at 5am ET), follows, profiles, people search | `src/server/services/social.ts`, `src/app/u`, `src/app/people` |
| Consensus engine (pure) | `src/lib/consensus/index.ts` (+ 36 unit tests) |
| Venue accuracy score (pure) | `src/lib/accuracy/index.ts` (+ 9 unit tests) |
| Reputation job (scheduled every 10 min, CLI, and seed) | `src/server/services/reputation.ts`, `src/instrumentation.ts` |
| Owner dashboard: official info + hours editor, append-only cover history, official photo, promos (NY time), venue replies, flagging | `src/server/services/owner.ts`, `src/app/owner/*` |
| Claims (admin-approved) and the admin-only paid flag | `src/server/services/admin.ts`, `src/app/admin` |
| Moderation: flags from users and owners, 3-distinct-user photo auto-hide, moderator hide/dismiss/restore, queue with reason and flagger, append-only log | `src/server/services/moderation.ts`, `src/app/mod` |
| Auth: email + scrypt, hashed-token DB sessions, httpOnly SameSite=Lax cookies, Origin check on mutations, login throttle | `src/lib/auth/*`, `src/server/services/auth.ts`, `src/server/http.ts` |
| Deterministic seed: 60 users, 25 fictional venues, a Friday-sized night, 30 days of history, all 4 required scenarios | `prisma/seed.ts`, `prisma/seed-data.ts` |

**Checks at the final commit:** `pnpm typecheck` clean, `pnpm lint` clean, `pnpm test` **246/246 passing** (24 files: 10 unit, 14 DB-backed integration). `pnpm test:pooled` runs the integration suite through PgBouncer in transaction mode. `pnpm build` succeeds, and `scripts/verify-linux-build.sh` builds on Linux. A fresh clone runs install → compose → migrate + seed → tests → dev successfully (see "How this was verified").

## How each hard invariant is enforced and tested

Enforcement is in the **service layer**. Route handlers in `src/app/api/**` only parse the request, resolve the actor, and call a service. Where it's cheap, the **database** backs the rule up with triggers and constraints.

### 1. A venue owner can't edit, delete, hide, or reorder user content (403)

- **Enforced:** `src/server/permissions.ts`
  - `assertCanEditOwnContent` (:59): author only, with an explicit 403 message for venue owners.
  - `assertCanModerateContent` (:68): hide/dismiss/restore are MODERATOR/ADMIN only.
  - `assertCanPostUserContent` (:47): owners can't post reports, photos, or top-level comments for their own venue.
  - Called from `comments.ts#editComment`, `moderation.ts#moderate` (:109), `reports.ts#submitReport` (:59), `photos.ts#submitPhoto`, and `comments.ts#addComment`.
- **No path exists for the rest:** there is no delete endpoint for any user content (`src/app/api/comments/[id]/route.ts` exports only PATCH), and no API accepts an ordering parameter. Presence/RSVP writes by an owner at their own venue are refused (`social.ts`).
- **DB backstop:** DELETE triggers on report, photo, and comment (`prisma/migrations/20260923225646_init/migration.sql:357-361`). Immutability triggers mean only `hidden_at` (and a comment author's `body`/`edited_at`) can change (`…_review_fixes/migration.sql:62-64`).
- **Tests:**
  - `tests/integration/moderation.test.ts:18`: every moderation action on photo/comment/report returns 403 for the owner, the content is unchanged, and no event is logged. The same holds over HTTP, and no DELETE handler exists. Owner flags queue content but don't hide it, and owner flags don't count toward auto-hide.
  - `tests/integration/reporting.test.ts:155`: the owner can't post user content, and editing a user's comment returns 403.
  - `tests/integration/db-guards.test.ts`: the triggers work.

### 2. Paid promotions never change the order, visibility, or weight of user content

- **Enforced:** by construction. Nothing that orders, filters, or weights reports, photos, comments, or the map list reads the promo table.
  - `venues.ts#listVenuesForMap` (:124) loads promos in a separate query (:130) and uses them only for the `promoted` label.
  - `sortVenues` (`src/lib/sort-venues.ts:6`) has no promo key.
  - `getVenuePage` attaches promos to the **official** panel only.
  - Paid is admin-only (`admin.ts#setPromoPaid`). Owners' promo schema is `.strict()` and rejects `isPaid`.
- **Tests:** `tests/integration/reporting.test.ts:176`
  - The whole live panel (consensus, photos, comments) and the accuracy score are deep-equal with and without a paid promo.
  - Map order, activity scores, and vibe are identical with and without a paid promo on the quieter venue.
  - `owner.test.ts` covers "only admins can set the paid flag" and "isPaid in payload is rejected".

### 3. Reports from outside the geofence are rejected

- **Enforced:** `reports.ts#assertInsideGeofence` (:30), a haversine check that's inclusive at 100 m. It's called by `submitReport` and `submitPhoto` (`photos.ts:38`) before any write. Presence is recorded only inside the geofence (`social.ts#recordPresence`).
- **Tests:** `tests/integration/reporting.test.ts:29`: 1 km rejected / 20 m accepted, 99 m accepted / 101 m rejected, photos, invalid coordinates, and the HTTP route returns 403 with nothing written. `social.test.ts`: presence only inside the geofence. `tests/unit/geo-money.test.ts`: geofence boundary.

### 4. The accuracy score is computed only from data, never set directly

- **Enforced:**
  - There is **no accuracy column anywhere** (`prisma/schema.prisma`). The score is computed on read by `src/lib/accuracy/index.ts#computeAccuracy` (:56) from user cover reports and the append-only `venue_cover_history`.
  - Owner input schemas are `.strict()` (`owner.ts:25-35`), so `accuracyScore` in a payload returns 400.
  - Cover changes append history inside a row-locked transaction (`owner.ts:67`), and history rows can't be updated or deleted (triggers, `init/migration.sql:353-355`).
  - Scoring starts at the venue's first stated cover (a venue that never stated one shows "No official cover posted", status `no_official_cover`). From then on, a window matches only if *every* official cover in effect during that hour is within $2, and an unstated cover never matches. So clearing or flipping the cover can't hide the score.
- **Tests:** `tests/integration/owner.test.ts:78`: the payload is rejected by the service and over HTTP; `information_schema` has no accuracy column; changing the cover now doesn't rewrite past windows. `tests/unit/accuracy.test.ts`: qualifying rules, the $2 tolerance, the 5-window floor, mid-hour changes, never-stated covers, the first-cover boundary, and clearing after stating.

### 5. Hidden content is hidden, never deleted, and the moderation log is append-only

- **Enforced:** `moderation.ts#moderate` (:109) sets or clears `hidden_at` and writes a `moderation_event` in the same transaction, and there's no delete code anywhere.
- **DB backstop:** `moderation_event` rejects UPDATE and DELETE (`init/migration.sql:349-351`), and user content rejects DELETE (:357-361). (The early `*_hidden_sticky` triggers at :375-377 were dropped in `…_review_fixes` so moderators can restore after review.)
- **Tests:** `tests/integration/moderation.test.ts:112`:
  - Hide keeps the row and body, resolves flags, logs, and restores.
  - Dismissing an auto-hide restores it, and the whole history is kept.
  - Hidden reports stop counting in consensus but stay in the table.
  - The log can't be edited or deleted.
  - Only moderators see the queue.
  - `db-guards.test.ts` tests the triggers directly.

### 6. Photos older than 3 hours never appear in the live feed

- **Enforced:** `venues.ts#getVenuePage` queries live photos with `created_at > now − 3h` (:187), a half-open window the same as the consensus engine's. Older photos go to a separate collapsed "Earlier" list labelled "not live". Long-open pages re-fetch every 60 s (`AutoRefresh`), and each live photo removes itself client-side when it turns 3 h old (`ExpiresAt`).
- **Tests:** `tests/integration/reporting.test.ts:99`: the split is exact at 3:00:00 (179 min is live, 180 min is not), a photo ages out at exactly 180 min, and hidden photos appear in neither list.

## Consensus engine, in brief

`weight = clamp(reputation, 0.2, 1.5) × 0.5^(age/30 min)`, and zero at ≥ 3 h or for future timestamps. Only each user's newest report per metric counts. Vibe and line use a weighted mode (tie-break: newest, then scale order); cover uses a weighted median (exact half averages the middle two). "Not enough data" applies unless (now−1h, now] holds ≥ 2 reports from ≥ 2 users.

Reputation is computed by a scheduled job, not on read. Each report is judged 30 min later against the consensus that formed **after** it from other users. There's one verdict per user/venue/metric/hour, and the score is `0.5 + s·(1.0 | 0.3)` with `s = (agree − disagree)/(n + 4)`, bounded in (0.2, 1.5). Details and rationale are in DECISIONS.md.

## Day 1: production readiness for the iOS app

Built in 5 phases, each with a reviewer pass (≈50 findings fixed; see AI-LOG.md "Day 1"). Deployment steps are in **DEPLOY.md**.

| Requirement | Where | Tested in |
|---|---|---|
| Cron reputation job (`GET`/`POST /api/cron/reputation`, bearer `CRON_SECRET`, `vercel.json` every 10 min). The in-process scheduler runs in development only | `src/app/api/cron/reputation/route.ts`, `src/server/cron.ts`, `src/instrumentation.ts` | `serverless.test.ts`, `ops.test.ts` |
| Login throttle in Postgres, keyed on email + first-hop IP; race-free (advisory lock); per-IP ceiling | `src/server/services/auth.ts`, `src/server/http.ts#clientIp` | `serverless.test.ts` |
| R2 storage + 15–20 min signed URLs. Hidden photos get URLs only for moderators. Local driver HMAC-signs | `src/lib/storage/index.ts`, `src/app/api/uploads/[...key]/route.ts` | `storage.test.ts`, `serverless.test.ts`, `privacy.test.ts` |
| sharp on Vercel/Linux | DECISIONS.md, `scripts/verify-linux-build.sh` (traced binary re-encodes from the standalone output) | manual script |
| `vercel-build`, `/api/health`, production seed guard (also before `db:reset` drops anything) | `package.json`, `src/app/api/health/route.ts`, `prisma/seed-guard.ts` | `serverless.test.ts`, `ops.test.ts` |
| Neon pooled `DATABASE_URL` + `DIRECT_URL`; advisory xact locks behind the pooler | `prisma/schema.prisma`, `docker-compose.yml` (pooler profile), `scripts/test-pooled.mjs` | whole integration suite via `pnpm test:pooled` |
| Bearer tokens (`X-Client: ios`), channel-bound, cookie-only CSRF, dead token → 401 `invalid_token` everywhere, logout / logout-all, `/api/me` | `src/server/http.ts`, `src/lib/auth/session.ts`, `src/app/api/auth/*`, `src/server/services/me.ts` | `token-auth.test.ts` |
| **5.1.1(v)** account deletion = anonymize (identity scrubbed, sessions and social ties gone, photos hidden for good and files deleted, reports/comments kept as "Deleted user") | `src/server/services/account.ts`, `/api/me/delete`, `/delete-account` | `compliance.test.ts`, `compliance-hardening.test.ts` |
| **1.2** blocking (symmetric visibility, no follows, aggregates unchanged), content filter (all text entry points), account reports + moderator suspension | `src/server/services/blocks.ts`, `src/lib/content-filter`, `src/server/services/moderation.ts` | `compliance*.test.ts`, `content-filter.test.ts` |
| Terms + 21+ at signup (no DOB), re-acceptance; draft `/privacy`, `/terms`, `/support`, `/delete-account` | `src/server/services/auth.ts`, `src/app/{privacy,terms,support,delete-account}` | `compliance.test.ts` |
| App Review `geofence_exempt`: admin/seed only; a write-time `countable` snapshot keeps its posts out of every aggregate forever | `src/server/services/venues.ts#COUNTABLE_AUTHOR`, migration `countable_suspend` | `compliance*.test.ts` |
| Real venues: `pnpm venues:import` (Overpass, EV/LES outlines, dedupe, deterministic slugs, one transaction, idempotent, ODbL attribution) | `src/lib/osm.ts`, `src/server/services/osm-import.ts`, `scripts/import-osm-venues.ts` | `osm.test.ts` (incl. 15 real addresses), `osm-import.test.ts` |
| **API contract**: `API.md` + `src/contracts/api.ts` (strict zod), drift test over all 45 handlers + registry scan + request-schema agreement | `API.md`, `src/contracts/api.ts` | `contracts.test.ts`, `contract-requests.test.ts` |

The six original hard invariants still hold and are still tested. Day 1 added defenses rather than exceptions:
- **Invariant 1:** owners get anonymous report lists.
- **Invariant 2:** promo responses no longer carry creator ids.
- **Invariant 4:** accuracy starts only at a venue's first stated cover.
- **Invariant 5:** account deletion anonymizes instead of deleting, and the moderation log gained SUSPEND, UNSUSPEND, and ACCOUNT_DELETED.
- **Invariant 6:** photo URLs are signed and short-lived.

## Known limitations

1. **Location is self-reported.** The geofence is checked on the server, but from client-supplied coordinates. A spoofed GPS passes. Reputation limits the damage.
2. **Not deployed yet.** There were no Vercel or R2 credentials on the build machine; DEPLOY.md has every step. The Vercel Pro plan is needed for the 10-minute cron, and preview gets no scheduled cron (manual `curl` in DEPLOY.md).
3. **Signed-URL staleness:** a photo URL issued just before a hide keeps working until it expires (≤ 20 min). This is inherent to signed URLs.
4. **No realtime.** Clients poll (60 s).
5. **Account lifecycle** still lacks email verification and password reset. Suspension exists, but appeals don't.
6. **Deliberate deviations** (DECISIONS.md):
   - an ADMIN role;
   - mutual-follow-only plans;
   - the seed anchored to "now";
   - DISMISS undoes only auto-hides;
   - "cock", "cum", and "rape" are not filtered (innocent uses and safety warnings);
   - venue search is client-side.
7. **Neighborhood outlines are approximations** of fuzzy real-world borders. The 7 excluded bars were checked by hand against a live pull.
8. **OpenStreetMap's public tile servers** are fine for localhost but need a paid or self-hosted tile provider for production web traffic (the iOS app uses Apple Maps).
9. **`pnpm db:reset` wasn't run by the builder.** Prisma blocks AI agents from `migrate reset`. The equivalent (`migrate deploy` + seed) was verified on a fresh database.
10. **Policy pages are drafts** with a `support@REPLACE-ME` contact, pending legal review.

## Top 5 suggested next steps

1. **Deploy per DEPLOY.md**, run `venues:import` on production, and point TestFlight at preview.
2. **Location trust:** add impossible-travel and velocity checks and per-device report bursts, and feed them into reputation.
3. **Account security:** email verification, password reset, session list/revoke UI, and appeals for suspensions.
4. **Realtime:** push live updates (SSE, or a Postgres LISTEN/NOTIFY fan-out) instead of 60 s polling, plus APNs for "friends are heading out".
5. **Moderation tooling at scale:** per-venue queues, moderator notes on accounts, repeat-offender detection, and transparency stats for venues.

## Review round 1 (external reviewer, FIX FIRST on `ea74809`)

All 9 items are fixed. See the "External review round 1" section of DECISIONS.md and AI-LOG.md.

- **Payloads:** the venue page and owner dashboard use explicit selects. No user-content coordinates, storage keys, or user ids, and the owner report list is anonymous. `tests/integration/privacy.test.ts` walks the serialized payloads. The venue's own lat/lng is the one intentional exception.
- **Accuracy:** scoring starts at the first stated cover, and there's a `no_official_cover` state.
- **Auto-hide:** only users ≥ 7 days old with reputation ≥ 0.5 count.
- **Comments:** edits freeze after a venue reply or while a flag is open.
- **Reputation:** private (self and moderators only).
- **Uploads:** sharp re-encoding strips metadata, tested against a JPEG carrying EXIF with GPS.
- **Comment burst limit:** locked per user and venue.
- **DECISIONS.md:** reconciled with the code.

## How this was verified

- Every phase ended with `pnpm typecheck`, `pnpm lint`, `pnpm test`, and a reviewer subagent. Every real finding was fixed and logged in AI-LOG.md (58 findings across 7 reviews).
- A browser check at 390×844 of the map, venue page, reporting (accept, then 429), RSVP/presence, owner dashboard, mod queue, and admin. No page has horizontal overflow.
- `next build` + `next start`: `/dev/login` returns 404, no simulator code in `.next/static`, security headers present, and unknown venues/profiles return 404.
- A fresh `git clone` in a temp dir with its own Docker volume: `pnpm install` (creates `.env`), `docker compose up -d`, `prisma migrate deploy`, `pnpm db:seed`, typecheck, lint, and `pnpm test` (147/147) all pass, and `pnpm dev` serves `/`, `/v/velvet-anchor`, `/dev/login`, and `/api/venues`. This check found and fixed one real bug: the test-DB init script was bind-mounted, which fails on Docker VMs that only share `$HOME`.

## Social layer (`feature/social`)

Profiles, followers and follow requests, private/public accounts, posts (photo + 1-10 rating), a verified badge,
"Regular at ___", likes, and a nightly "featured" gallery. Built in 7 phases with a reviewer after each (see AI-LOG.md,
Phases 1-7; the builder changed after Phase 5, see "Handover check"). Product questions with the defaults built are
in `../OPEN-QUESTIONS.md`.

| Area | Where | Tested in |
|---|---|---|
| Privacy rules (pure): full vs limited profile, per-viewer authors (`AuthorView`: user / anonymous / deleted), photo visibility; blocks and suspension built in; staff see real people | `src/server/privacy.ts` | `tests/unit/privacy.test.ts`, `tests/integration/author-privacy.test.ts`, `privacy.test.ts` |
| Follows, requests (own table; every `follow` row is approved), private/public toggle, approve-all, remove follower, lists, search, profile settings, avatar | `src/server/services/people.ts` | `people.test.ts`, `social.test.ts` |
| Posts: rating 1-10 (CHECK), locked at 5am New York (service + trigger), share toggle, edit, remove (= hide, final), grid (opaque cursor), Places | `services/photos.ts`, `services/posts.ts` | `posts.test.ts`, `social-db-guards.test.ts` |
| Verified badge: admin-only with a note, append-only log, the DB ties the badge to the log | `services/verification.ts`, `/admin` | `verification-regulars.test.ts` |
| Regular: 3 separate visits in the last 60 nights, computed from visible posts, never stored | `src/lib/regulars.ts`, `services/regulars.ts` | `tests/unit/regulars.test.ts`, `verification-regulars.test.ts` |
| Likes, eligibility (pure), nightly featuring (cutoff 5:05am, top 20 stored, top 10 visible, 3-like minimum, 7-night catch-up), gallery and archive, activity | `src/lib/likes.ts`, `services/likes.ts`, `featuring.ts`, `gallery.ts`, `activity.ts` | `tests/unit/likes.test.ts`, `featuring.test.ts`, `likes-featuring.test.ts` |
| Rate limits (follow 60/h, like 200/h, post 20/h), advisory-lock pattern | `src/server/rate-limit.ts` | `people.test.ts`, `posts.test.ts`, `likes-featuring.test.ts` |
| Contract | `API.md` ("Posts", "Likes and the featured gallery", "People and privacy"), `src/contracts/api.ts` | `contracts.test.ts`, the app's drift test |
| Demo seed | `prisma/seed.ts` + `prisma/seed-social.ts` | read-only SQL + live API checks (AI-LOG Phase 7) |

### Privacy model
- Every account starts private, existing ones included. A viewer who isn't an approved follower sees a private
  account's handle, verified badge and a generic avatar only (`access: "limited"`); lists and posts are a 403
  `private_account`.
- Authors are resolved **per viewer on the server**. A private author's handle never reaches a viewer who can't see
  it: they get `{kind: "anonymous"}` with no handle, no badge and no link. Anonymous authors can still be blocked and
  reported, by content (`POST /api/blocks`), without revealing who they are.
- Moderators and admins always see real authors. Venue owners see their own venue's authors like any viewer.

### The rules that must not break
- **Posts, ratings, likes, featuring, verification and Regular status never touch live data.** Consensus, counts,
  accuracy and reputation read reports only. Tests: "likes never change consensus, counts or the feed order" and
  "verification changes nothing else" (`likes-featuring.test.ts`, `verification-regulars.test.ts`); "verified badges
  and Regular status don't change featuring".
- **Venues can't pick, hide, remove or reorder posts, likes or featured photos.** No owner endpoint touches them;
  owners' likes are ineligible for featuring at their own venue (`src/lib/likes.ts`); featuring tables are
  append-only with DB guards.
- **App Review data never counts:** posts and likes carry the write-time `countable` snapshot; an account flagged
  after liking doesn't count (tested).
- **No hard deletes:** "Delete from profile" sets `removed_at` (final, trigger-enforced); unlike removes the like row
  (a like isn't content).
- The six original hard invariants above still hold and are still tested.

### Checks (this handover, local repo)
`pnpm typecheck` and `pnpm lint` clean; `pnpm test` **434/434** (34 files). The app's `npm run test:live` against the
seeded local backend: 6/6, including the social endpoints. See the root `HANDOFF.md` for the repo state (a local git
repo made from a ZIP of the branch; nothing pushed).

### Known limitations (social)
- Posts, Regulars and featuring are only as trustworthy as the phone's GPS (OPEN-QUESTIONS 6).
- The eligibility bar for featuring (7-day-old account, reputation 0.5) can be met by a week-old sock-puppet ring
  (OPEN-QUESTIONS 2).
- Activity is derived from data (no notifications table, no push).
- Venue average ratings are stored per post but not shown (OPEN-QUESTIONS 1).
