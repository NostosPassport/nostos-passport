# Decisions

Judgment calls made during the autonomous build, and why. Newest at the bottom of each section.

## Stack and tooling
- **Pinned versions**: Next 15.5.26, React 19.3.0, Prisma 6.19.3, Tailwind 4.3.3, Vitest 3.2.7, TypeScript 5.9.3, Leaflet 1.9.4, zod 3.25.76. Exact versions in `package.json`, and pnpm lockfile committed.
- **pnpm 11 build approvals** live in `pnpm-workspace.yaml` (`allowBuilds`) so Prisma engines and esbuild install without an interactive `pnpm approve-builds`.
- **`.env` on a clean clone**: `postinstall` copies `.env.example` to `.env` when missing, so `pnpm install && docker compose up -d && pnpm db:reset && pnpm dev` works without a manual copy step. `.env` stays gitignored.
- **Test database**: the test harness creates `nostos_test` in the same Postgres container on first run. An init-script bind mount failed on Docker VMs (Colima) that only share `$HOME`; the clean-clone check found this. Integration tests refuse to run unless the URL contains `nostos_test`. Global setup runs `prisma migrate deploy` (non-destructive), and each test `TRUNCATE`s all tables. Prisma refuses `migrate reset` when an AI agent invokes it, and deploy + truncate is the safer design anyway.
- **Plain Leaflet instead of react-leaflet**: one imperative map component loaded with `next/dynamic` (no SSR). Fewer moving parts and no React 19 peer-version friction.

## Auth
- **scrypt** N=2^15, r=8, p=1, 64-byte key, 16-byte salt, stored as `scrypt$N$r$p$salt$hash` so parameters can be raised later. Constant-time compare. Unknown emails still pay for a scrypt verify against a dummy hash (flat timing).
- **Sessions**: 32 random bytes in an httpOnly, SameSite=Lax cookie (`Secure` in production). The DB stores only `sha256(token)`. **Fixed lifetimes** (not sliding): 30 days for web cookies, 90 days for iOS bearer tokens. The credential and the DB row expire together (`src/lib/auth/session.ts`).
- **CSRF**: SameSite=Lax plus an Origin/Host check on every mutating API route (`src/server/http.ts#assertSameOrigin`).
- **Login throttle**: in-memory, 10 failures per email per 15 minutes. Fine for a single-node localhost app. A multi-instance deploy would move this to Redis or the DB.
- **Roles**: the spec lists USER, VENUE_OWNER, and MODERATOR, and says some things are "admin-approved" or "set by admin". So I added an **ADMIN** role (claims approval, promo paid flag). Public signup can only create USER.
- **Seeded accounts share one password hash** (same salt) so seeding stays fast. Dev only.

## Data model
- `venue_cover_history` is an append-only log of the official cover so the accuracy score compares each past hour with what the venue claimed *at that time*, not with today's value.
- `presence` has one row per user (you are in one place at a time). "Here now" counts rows with `last_seen_at` in the last 45 minutes.
- `rsvp` is keyed by `night` (YYYY-MM-DD of the 5am-to-4:59am America/New_York night), so "going tonight" resets at 5am with no job.
- **No accuracy-score column exists** (invariant 4). It is computed on read.
- **DB-level guarantees** (hand-written SQL in the migrations):
  - `moderation_event` and `venue_cover_history` reject UPDATE and DELETE.
  - `report`, `photo`, and `comment` reject DELETE.
  - Those three rows are immutable apart from `hidden_at` (and a comment author's `body`/`edited_at`), enforced by `*_immutable` triggers in `…_review_fixes`.
  - `hidden_at` is **not** sticky: the init migration's `*_hidden_sticky` triggers were dropped in `…_review_fixes` so moderators can RESTORE after review. Every change to `hidden_at` goes through `moderation.ts#moderate`, which logs it.
  - CHECK constraints keep reputation in [0.2, 1.5] and ensure a report's value matches its type. A partial unique index allows one OPEN flag per user per item.

## Seed
- Content comes from a fixed-seed PRNG (mulberry32) with explicit ids. Timestamps are laid out relative to an anchor (the current minute, or `SEED_NOW`) so the Friday-night data is live whenever you run it. `SEED_NOW=...` gives byte-identical output.
- The fixture `here` counts are relative crowd sizes, scaled ×0.35 to fit ~52 regular users (one location per user).
- **"Friday night" is anchored to now, not to the calendar.** Live data must be under 3 hours old to show on the map. A seed pinned to last Friday would look empty on any other day. So the seed lays a Friday-sized crowd (volumes, venues, scenarios) over the 3 hours before the anchor. To get a literal Friday, run `SEED_NOW=<a Friday ~11:30pm ET in UTC> pnpm db:seed` and view it with the same clock.
- **Hidden content can be restored** by a moderator (a RESTORE moderation action), for example a photo auto-hidden by 3 flags that turns out fine. Deletion is still impossible at the DB level. Report, photo, and comment rows are immutable apart from `hidden_at`, and for comments the author's `body`/`edited_at`.
- **Login throttle is keyed per email.** Anyone can therefore lock an account out of password login for 15 minutes by failing 10 times. That's acceptable for localhost. Production would key on email+IP and add a CAPTCHA or backoff.

## Consensus engine (`src/lib/consensus`)
- **Live window is half-open, (now−3h, now].** A report exactly 3h old has weight 0. The same boundary applies to photos: exactly 3h old is "Earlier". The data floor uses (now−1h, now].
- **Only each user's newest report per metric is weighted.** Otherwise one person re-reporting every 15 minutes could outvote a crowd. `reportCount` shown in the UI is all live reports; `userCount` is distinct reporters.
- **The "not enough data" floor** is applied literally: ≥2 reports and ≥2 distinct users in the last hour.
- **Weighted mode tie-break**: the tied value with the most recent report wins. If that also ties, scale order decides (PACKED>BUSY>CHILL>DEAD; NONE<…<30+).
- **Weighted median**: textbook. When cumulative weight lands exactly on half, it averages the two middle values (rounded to the cent).
- **Cover mismatch callout** fires when |user consensus − official| > $2, the same tolerance as the accuracy score.

## Reputation (`src/server/services/reputation.ts`)
- **Scheduled job, not on read.** It runs every 10 min in-process (`src/instrumentation.ts` → `src/server/scheduler.ts`), via `pnpm job:reputation`, and 3 passes in the seed. Reads, and therefore page loads, never pay the cost. A Postgres transaction-scoped advisory lock keeps concurrent runs from interleaving writes, and the write is one batched UPDATE.
- **What "agrees with the consensus that formed around them" means:** a report is judged 30 min after it was made, against the consensus of *other users' reports made after it* (in (t, t+30m]), using the normal engine (decay, weights, data floor). Only later peers count, so copying a consensus already on screen earns nothing unless independent reporters confirm it afterwards. No floor, no verdict.
- **Verdicts**: vibe/line same bucket = agree, adjacent bucket = neutral, 2+ buckets apart = disagree. Cover within $2 = agree, more than $5 off = disagree, anything between = neutral.
- **At most one verdict per user/venue/metric/clock-hour**, which prevents farming by re-reporting.
- **Formula**: s = (agree − disagree)/(agree + disagree + 4). The rep is 0.5 + s·1.0 when s ≥ 0, and 0.5 + s·0.3 when s < 0. It's bounded in (0.2, 1.5), and no record gives exactly 0.5. The +4 prior means a handful of verdicts can't swing anyone to an extreme.
- **Lookback 90 days.** Users with no verdicts in the lookback *keep* their current reputation, so a troll can't reset by going quiet.
- **Peers are weighted by current reputations**, so each run is one step of a fixed-point iteration. The seed runs 3 passes. Hidden reports are ignored on both sides.

## Accuracy score (`src/lib/accuracy`)
- **Windows** are completed clock hours (UTC-aligned, which are also ET clock hours) that start within the last 30 days. The in-progress hour is excluded so the score can't flicker.
- **Qualifying** needs ≥3 distinct users, and each user's newest report in the hour counts, so ≥3 reports too. The consensus is the reputation-weighted median without decay, which makes it troll-resistant.
- **Anti-gaming**: a window matches only if *every* official cover in effect during that hour is within $2 of the consensus. Once the venue has stated a cover, an unstated (null) official cover never matches. Before its first stated cover there's nothing to score (see "External review round 1"). Clearing or flipping the cover can only hurt the score and can't remove windows.
- The official cover history is the append-only `venue_cover_history` table, so past windows are judged against what the venue claimed at that time.

## Map & venue page
- **Venue owners can't post user reality for their own venue**: reports, photos, and top-level comments get a 403. They reply to comments instead. Owners can still act as normal users at other venues.
- **Comments don't require the geofence.** The spec requires it for reports only, and photos are treated as reports (geofence + 15-min cooldown). Comments have their own burst limit of 5 per venue per 10 min.
- **Live activity sort** = 2 × here-now + distinct reporters in the last hour. It's a pure function of user data and promos are not an input.
- **"Earlier" photos** cover the 21 hours before the live window, collapsed and dimmed, labelled "not live".
- **Map tiles**: standard OSM tiles darkened with a CSS filter. No API key and no third-party style server.
- **Upload serving**: `/api/uploads/<key>` sends `nosniff`, `default-src 'none'`, and a type derived from the sniffed extension. Hidden photos return 404 except to moderators.

## Presence, RSVP, follows
- **"Friends" means mutual follows.** The spec says "see which people you follow are going". But follows are one-way and need no consent, so letting a follow reveal someone's plans would let anyone (a stranger, a venue) track where a person will be tonight. Plans and the friends-going badges/counts are therefore shared only between mutual follows. Total going counts stay public, and individual presence is never shown to anyone.
- **Presence pings**: on page open, every 5 minutes while open, and on real movement (>25m, at most every 30s). A ping from outside the geofence clears your presence at that venue immediately.
- **One presence per user**: checking in somewhere else moves you.

## Owner dashboard, promos, claims
- **Owners can edit name, address, hours, official cover, dress code, and official photo.** Coordinates are not owner-editable because moving a pin would move the geofence. That would be an admin/data-ops change.
- **Promo times are New York wall-clock time**, the same as hours. The form says so and the server converts. Promos must end in the future, start within 90 days, and run for at most 30 days.
- **Ending a scheduled promo** cancels it by moving its window into the past. There are no deletes, so the history stays auditable.
- **Co-owners are allowed** (a venue can have several approved accounts). The admin page warns when a venue already has owners.
- **Validation lives in the service layer.** Routes pass raw JSON (`readJson`) where a schema transforms values, so nothing is parsed twice.

## Moderation
- **Everyone signed in can flag** photos, comments (including venue replies), and individual reports. Flagging never hides anything. The one exception is the spec's photo rule: 3 OPEN flags from distinct **eligible users** (role USER, account ≥ 7 days old, reputation ≥ 0.5) auto-hide a photo pending review. Flags from venue accounts (any venue) and staff don't count, so venues can't get photos hidden by flagging them. The queue labels owner flags ("this venue's owner", "owner of another venue").
- **DISMISS** closes flags and undoes an *auto*-hide only. A moderator's own HIDE stays until an explicit **RESTORE**. Each step is its own append-only event.
- **Re-flagging**: one OPEN flag per user per item (partial unique index). After a review you can flag it again, for example if a comment is edited afterwards.
- **Flag limit**: 20 per user per hour, exact under concurrency via a per-user advisory lock.
- **Hiding a parent comment** hides its venue replies from the public page as well (they render under the parent). The rows still exist. Owners see their own hidden replies listed on the dashboard.

## External review round 1 (FIX FIRST on ea74809)
- **Venue page payload uses explicit `select`s.** Photos reach the client as `{ id, url, caption, createdAt, authorHandle, mine }`, and comments/replies as `{ id, body, createdAt, editedAt?, authorHandle, mine }`. No photo/report coordinates, raw storage keys, or user ids. **The venue's own `official.lat/lng` stays** because the map pin and the "you're 22 m away" geofence hint need it, and it's a public fact like the address. A test asserts it's the only lat/lng in the payload. `/api/venues` items have a fixed field whitelist. The mod queue and owner dashboard also use `url` rather than keys.
- **Owner dashboard reports are anonymous**: id, type, value, and age only. Promo and cover-history rows no longer carry `createdById`/`changedById`. Comment and photo author handles still show, because they're public on the venue page anyway.
- **Accuracy starts when the venue first states a cover.** Windows ending at or before the first non-null official cover are skipped. A window straddling that moment is judged only on the part after it (the fair reading of "after that point"). After it, a cleared (null) cover is still a mismatch. A venue that never stated a cover gets status `no_official_cover` and shows "No official cover posted".
- **Auto-hide eligibility**: a photo flag counts toward the 3-flag auto-hide only if it comes from a USER account at least 7 days old with reputation ≥ 0.5. Everyone else's flags still reach the queue.
- **Comment edits freeze** (409) once the comment has any venue reply (even a hidden one) or an OPEN flag. After a moderator resolves the flags it's editable again.
- **Reputation is private**: returned only to the account itself and moderators. The dev login page still lists it (dev only).
- **Uploads are re-encoded with sharp** for user and official photos. It applies EXIF orientation, caps each side at 2048px (never enlarges), re-encodes in the sniffed format (JPEG/WebP q85, PNG level 9), and drops all metadata (EXIF, GPS, XMP, ICC). Files sharp can't decode return 415. Input is capped at 50 MP.
- **Comment burst limit** runs inside a transaction with a per user+venue advisory lock, so it's exact under parallel posts.

## Day 1: production readiness (Vercel, Neon, R2)

### Serverless
- **Reputation cron**: `/api/cron/reputation` accepts **GET and POST**. Vercel Cron always sends GET with `Authorization: Bearer $CRON_SECRET`; POST is for manual runs. The secret comparison is constant-time and fails closed when `CRON_SECRET` is unset or under 16 chars. `vercel.json` schedules it `*/10 * * * *`. **Vercel Hobby only allows daily crons**, so the 10-minute schedule needs Pro (see DEPLOY.md). The same run prunes day-old login attempts. `maxDuration = 60`.
- **In-process scheduler** runs only when `NODE_ENV=development` (and `DISABLE_JOBS` isn't set).
- **Login throttle** lives in Postgres (`login_attempt`): 10 failures per (email, client IP) per 15 minutes, same limits as before. Keying on the IP means a stranger can no longer lock an account out from elsewhere. Check, password verification, and insert run under an advisory xact lock on (email, IP), so parallel guesses stop at exactly 10. A **per-IP ceiling of 50 failures / 15 min** across all emails bounds table growth and account spraying, and login requires a syntactically valid email (no row for garbage). The IP is the first `X-Forwarded-For` hop (Vercel's edge sets it to the real client), then `X-Real-IP`. It's used only for rate limiting.
- **Neon pooling**: `DATABASE_URL` is the pooled `-pooler` host with `?pgbouncer=true` (Prisma disables prepared statements), and `DIRECT_URL` is the direct host used by `prisma migrate`. Every lock in the app is **transaction-scoped** (`pg_advisory_xact_lock` / `pg_try_advisory_xact_lock`) inside an interactive transaction, and a transaction keeps one server connection in PgBouncer transaction mode. **Verified:** `pnpm test:pooled` runs the whole integration suite through PgBouncer 1.25.2 in `pool_mode=transaction` (Neon's pooler mode), with migrations over the direct URL. All integration tests pass, including the concurrency tests (report cooldown race, flag limit race, comment burst race, concurrent auto-hide).
- **Photo storage**: `STORAGE_DRIVER=local|r2`. Photos are never public. The API returns **signed GET URLs** only for content the viewer may see:
  - R2: presigned against R2's S3 endpoint.
  - Local: an HMAC-signed `/api/uploads/<key>?exp&sig`.
  - Signing time is floored to 5-minute buckets with a 20-minute expiry, so every URL is valid for **15 to 20 minutes** and stays byte-identical within a bucket, which keeps browser and iOS image caches effective across the 60s refreshes.
  - Trade-off: a URL issued just before a photo is hidden keeps working until it expires (≤ 20 min). That's inherent to signed URLs.
  - `STORAGE_DRIVER=local` refuses to start on Vercel (read-only, ephemeral disk).
- **sharp on Vercel**: Next 15 keeps `sharp` external by default (`serverExternalPackages`). Vercel installs dependencies on Linux, so pnpm fetches the matching `@img/sharp-linux-*` binary, and `pnpm-workspace.yaml` already allows sharp's install script. No extra config needed. **Verified** with `scripts/verify-linux-build.sh`, which builds a clean `git archive` of HEAD in `node:22-bookworm` with Next's standalone output (the same file tracing Vercel uses). The sharp Linux binary is traced into the server output, and an EXIF-tagged 3000×1000 JPEG re-encodes to 2048×683 with EXIF stripped from there. The check ran on linux-arm64 (Colima on Apple Silicon); Vercel's x64 install pulls `@img/sharp-linux-x64` the same way.
- **Build**: `vercel-build` = `prisma generate && prisma migrate deploy && next build` (migrations run over `DIRECT_URL`). `/api/health` runs `SELECT 1` and returns 200 or 503.
- **Environments**: `APP_ENV=development|preview|production`. The demo seed (and `db:reset`, which checks **before** `prisma migrate reset` drops anything) refuses when `APP_ENV=production` or `VERCEL_ENV=production`, when `APP_ENV` is unknown, or when `APP_ENV` is unset and the database isn't local (`prisma/seed-guard.ts`). A forgotten variable fails safe.
- **Vercel runs crons on production deployments only.** Preview never recomputes reputation on a schedule. The preview seed runs 3 reputation passes itself, and DEPLOY.md gives the one-line `curl` to rerun it on preview. A skipped run (lock held by another run) returns `{ ok: true, skipped: true }`.
- **`.gitignore` bug fixed**: `uploads/` also matched `src/app/api/uploads/…/route.ts`, so the image route had never been committed. It's now anchored as `/uploads/`, and a sweep found no other ignored source files.
- **`.env` upgrades**: `ensure-env` now appends keys added to `.env.example` into an existing `.env` without touching existing values.

### Token auth (Phase 2)
- **Same `session` table for both channels**: sha256 at rest, 256-bit random tokens. `session.client` is `WEB` or `IOS` and is **enforced**: IOS tokens authenticate only as `Authorization: Bearer`, and WEB tokens only as the `lc_session` cookie, so a token can't be replayed on the other channel. iOS tokens last **90 days** (fixed) to avoid monthly forced sign-outs. Web stays at 30.
- **Precedence**: if an `Authorization` header is present it is the only credential considered. A bearer token that doesn't resolve (malformed, expired, revoked, or wrong channel) gets **401 `invalid_token`** with `WWW-Authenticate: Bearer error="invalid_token"` on **every** route, public ones included, so the app never silently shows signed-out data. The scheme is case-insensitive.
- **CSRF**: the Origin check applies to cookie-authenticated mutations only. Bearer requests are exempt because a cross-site page can't attach `Authorization` without a CORS preflight, which this API never grants.
- **`X-Client: ios`** (case and whitespace tolerant) on login/signup returns `{ token, expiresAt, user }` in the body and never sets a cookie. Without it, web behavior is unchanged.
- **Logout** revokes exactly the presenting session (401 for a dead bearer). **Logout-all** revokes every web and iOS session.
- **`/api/me`**: `user` (including the private reputation), `ownedVenues`, and read-only `settings` (`plansVisibleTo: "mutuals"`). Phase 3 adds terms acceptance.

### App Store compliance (Phase 3)
- **Account deletion anonymizes; it never deletes content.** `POST /api/me/delete {password}` (403 `wrong_password` on mismatch) runs one transaction:
  - scrubs email to `deleted-<hex>@deleted.invalid`, display name to "Deleted user", and the password hash to an unusable value; handle becomes `deleted-<hex>` (hyphens can't occur in real handles);
  - sets `deleted_at`, drops the role to USER and clears `geofence_exempt`;
  - revokes all sessions and removes follows (both ways), RSVPs, presence, blocks (both ways), **all** claims (pending and approved, so a deleted owner no longer manages the venue), and their login-attempt rows;
  - hides **all** their photos for good, each with a system `ACCOUNT_DELETED` event, and deletes the image files after commit. Moderation refuses RESTORE for a deleted author's photo, and DISMISS never un-hides one.
  Reports and comments stay and render as "Deleted user" (`authorHandle: null`). Deleted accounts can't authenticate by password or token, and their handle 404s on profile, follow, and search. No DB trigger changes were needed because no content row is deleted or rewritten.
- **Blocking is symmetric in effect.** It removes follows both ways and blocks future follows (403) either way. Each side's photos, comments, and replies are hidden from the other on the venue page (including venue replies, if you blocked the owner account). Profiles return 404 both ways, and each is excluded from the other's search. Aggregates (consensus, here/going counts, accuracy, reputation) are computed without regard to blocks. Moderators' queue is unaffected.
- **Content filter**: `src/lib/content-filter` (wordlist in its own file). It's high-precision:
  - It normalizes case, accents, leetspeak, separators, and spelled-out letters.
  - Each term is a **letter-run pattern** (`faggot` → `f{1,}a{1,}g{2,}o{1,}t{1,}`), so stretched spellings match but different words don't ("cons" ≠ "coon", "Nigerian" ≠ the slur).
  - Terms match whole tokens, and a short list of unambiguous slurs also matches *inside a single token* (handles like `xx…xx`), never across word breaks ("wet backyard", "zucchini gazpacho", "drag heads" pass).
  - Deliberately not listed: "cock" (Cock & Bull), "cum" (cum laude), and "rape": people must be able to warn others about assault at a venue.
  - It covers **slurs and sexually explicit terms**. Ordinary profanity is allowed in a nightlife app; moderators handle the rest.
  - It applies to comments, comment edits, venue replies, photo captions, handles, display names, promo title/body, and venue name/address/dress code. The error is 400 `objectionable_content` with "Your <field> contains language we don't allow. Please rephrase it."
- **Terms**: signup requires `acceptTerms: true` and `confirm21: true` (literal `true`, no DOB stored). It stores `terms_accepted_at` and `terms_version` (`CURRENT_TERMS_VERSION` = `2026-09-24`). `/api/me.terms.needsAcceptance` tells the app to re-prompt after a version bump, and `POST /api/me/terms {version}` records it.
- **Public pages** `/privacy`, `/terms` (zero-tolerance section, 24h moderation SLA), `/support`, and `/delete-account` (with a signed-in web form). Each source file starts with `DRAFT: have a lawyer review before launch`. The contact is `support@REPLACE-ME`.
- **`geofence_exempt`** (App Review / QA). It's settable only by an admin (`PATCH /api/admin/users/:handle`) or the seed; strict schemas reject it anywhere else.
  - Exempt accounts skip the 100 m check (coordinates must still be valid) and still obey cooldowns.
  - Every report, photo, comment, presence, and RSVP row records a **write-time `countable` snapshot** (`false` for exempt authors). All aggregates filter on it: consensus, activity, here/going counts (including the count returned by RSVP), friends going, accuracy, reputation, and the owner's recent-report list.
  - Because it's a snapshot, deleting the review account or toggling its flag later can never retroactively add or remove data. A DB trigger makes `countable` immutable on reports, photos, and comments.
  - Their photos and comments appear only to themselves, so a reviewer can verify the flows without polluting a real venue.
  - Their flags never count toward the 3-user auto-hide.
  - The seed creates `@appreview` (exempt). Its password is `APP_REVIEW_PASSWORD` if set.
- **Preview seed safety**: preview is a public URL, so the seed refuses `APP_ENV=preview` unless `DEV_SEED_PASSWORD` is strong (16+ chars and not the dev default) and `APP_REVIEW_PASSWORD` is set. Otherwise anyone could sign in to the seeded admin.
- **Removing abusive users (Guideline 1.2 / the Terms' promise)**: accounts can be reported (`targetType: "USER"`, `targetId` = id or handle; profile "Report account"). Moderators can **SUSPEND** (`suspended_at` set, all sessions revoked, sign-in returns 403 `account_suspended`, the profile 404s for everyone but moderators, excluded from search) or **UNSUSPEND**. Both are logged. Content stays until moderated separately. HIDE/RESTORE don't apply to accounts, and SUSPEND/UNSUSPEND don't apply to content.
- **Web block/report UI**: profiles have Block and Report account. `/people` lists blocked accounts with Unblock (blocked profiles 404, so that's where unblocking lives).
- **Presence retention**: the cron deletes presence rows once they stop counting (older than 45 min). The privacy draft says so, and states plainly what survives account deletion: reports keep venue, time, and coordinates on an anonymized account; moderation records and sent flags are kept; photo files are deleted.

### Real venues from OpenStreetMap (Phase 4)
- **`pnpm venues:import`** pulls `amenity=bar|pub|nightclub` from Overpass for a bounding box of Canal/Division to 14th St and Bowery/3rd Ave to the East River (`EV_LES_BBOX`). It keeps named elements with coordinates (`out center` for ways and relations). A live dry run on 2026-09-24 returned 245 elements and 243 named venues. `--dry-run` previews, `--file` imports saved Overpass JSON, and `OVERPASS_URL` overrides the endpoint.
- **Neighborhood outlines** (`src/lib/osm.ts`) are approximate polygons drawn from real intersections:
  - East Village: 14th St to Houston St, Bowery/3rd Ave to Avenue D.
  - Lower East Side: Houston St to Canal/Division, Bowery north of Delancey and Allen St south of it, to the FDR.
  - Houston itself is a polyline through its Bowery, 2nd Ave, A–D, and FDR intersections because it bends.
  - Points outside both outlines (NoHo, Nolita, the Village, Chinatown, Two Bridges) are not imported. The Overpass bbox is just a superset. Refined against a live pull (2026-09-24): 14th St's north frontage, the Bowery frontage, Chrystie/Forsyth, and East Broadway east of Rutgers are in. Exactly 7 named bars fall outside (University Pl, Broadway, Lafayette/Bond, Market St, western East Broadway). The result is 235 venues, 44 with no mapped street address. `tests/unit/osm.test.ts` pins 15 real addresses.
- **Duplicates**: OSM sometimes maps one bar twice (a node plus a building way). Same normalized name within 60 m collapses to one, chosen deterministically: has a street address, then node over way over relation, then lowest id.
- **Missing addresses stay empty** (`""`, about 18% of OSM bars) instead of a made-up placeholder. The UI shows only the neighborhood. The owner schema allows an empty address, and the owner form sends only changed fields, so an imported value never blocks an unrelated save.
- **Import safety**:
  - One transaction (all or nothing).
  - The fetch has a 120s timeout.
  - Overpass's HTTP-200 failure `remark`s and non-JSON error pages are rejected.
  - A live pull that parses fewer than 50 venues (`OSM_MIN_EXPECTED`) is refused as partial.
  - It refuses databases containing demo-seed venues unless `--allow-demo` is passed.
- **Idempotent upsert on `osm_id`** (`node/123`, `way/456`):
  - New venues start unclaimed with **no official cover** (shows "No official cover posted") and no hours (shows "Hours not posted").
  - On re-import, coordinates always follow OSM because they define the geofence, and the neighborhood is recomputed from them. Name and address are refreshed only while **unclaimed**; once claimed, the owner owns those facts.
  - Slugs are set once and never change.
  - Venues that disappear from OSM are kept (they may have history).
- **Slugs** come from OSM data alone: `slugify(name)`, or `<slug>-<n|w|r><osm id>` for **every** venue sharing a name within the import, or when a non-OSM venue already owns the plain slug. They're independent of import order. A slug is assigned once and never changes, and a clash fails the (transactional) import.
- **ODbL attribution**: `/api/venues` returns `attribution: { text: "© OpenStreetMap contributors", url, license: "ODbL-1.0" }` whenever any listed venue is from OSM (each venue has `fromOsm`), and the venue page returns `official.attribution`. The web map shows "© OpenStreetMap contributors" in the bottom sheet at all times (Leaflet's own control sits under the sheet), and the venue page shows it for imported venues. API.md (Phase 5) tells the app where to show it.
- The demo seed is unchanged for development and preview. Production gets only real venues.

### API contract (Phase 5)
- **`src/contracts/api.ts`** is standalone (depends only on zod) so the Expo repo can copy it verbatim. Every response schema is `.strict()`, so an extra field is drift too, which catches accidental data leaks.
- **Drift test** (`tests/integration/contracts.test.ts`) calls every route as the iOS app would (bearer tokens, multipart uploads) against a realistic fixture and parses each response. A registry check scans `src/app/api/**/route.ts` and fails when a handler has no schema or a schema has no handler.
- **New read endpoints for the app**: `GET /api/venues/:idOrSlug`, `/api/users/:handle`, `/api/me/following`, `/api/owner/venues`, `/api/owner/venues/:id`, `/api/mod/queue`, `/api/mod/log`.
- **Responses trimmed while contracting them**:
  - The official-photo upload returned a raw storage key; it now returns a signed URL.
  - Promo responses (owner and admin) returned full rows including the creator's user id; they now return `PromoView`.
  - The admin claim response returned the full row; it now returns `{ id, status }`.
  - The photo upload returns a `url` for the app's optimistic tile.
- **Contract review fixes**:
  - Public profiles no longer expose the internal user id or staff roles. `isVenueAccount` replaces `role`, and account reports use the handle.
  - Suspended accounts are dropped from following lists and friends-going.
  - Presence responses carry the server-computed `distanceM`/`radiusM`, so the app dims the report bar without re-implementing the geofence.
  - `GET /api/mod/hidden` lists hidden content and suspended accounts for Restore / Unsuspend.
  - The contract's request schemas carry the same limits as the server's; `tests/unit/contract-requests.test.ts` asserts they accept and reject the same samples.
  - The drift test now covers accuracy `ok` with windows, consensus `ok`, earlier photos, deleted authors, friends going, hidden replies, owner claims, presence `here:false`, and real error responses. The registry scan also catches `export function`, `export { h as X }`, HEAD, and OPTIONS.
  - The contract pins **zod v3**.
  - Venue search is client-side filtering of `GET /api/venues`.

## Social layer (feature/social)

### Phase 1: schema, migrations, privacy module
- **Follow requests are their own table** (`follow_request`), not a status on `follow`. Every `follow` row is an
  approved follow, so everything that already reads follows (mutual-follow plans, friends going, following lists)
  keeps meaning "approved" with no extra filter to forget. Existing follows needed no migration to count as approved.
- **Every account is private**, existing ones included: `app_user.is_private` defaults to true and the migration
  applies the default to every row.
- **A post is a photo with a rating** (the merge option). `photo` gained `rating` (1-10, CHECK, nullable), `shared`,
  `night`, `edited_at` and `removed_at`. A photo without a rating is a live-only photo exactly as before (venue feed,
  never the profile, not likeable). One table means the venue feed, moderation, auto-hide, the geofence and the
  15-minute cooldown all apply to posts without a second code path. Posting is the existing upload with a rating.
- **`night` is set by a trigger** from `created_at` (America/New_York, 5am rollover), whatever the client sends, and
  is immutable with it. Featuring and Regular status group by it.
- **DB backstops on posts**: the immutability trigger now lets the author change caption, shared, edited_at and
  rating, and moderators hidden_at. A rating can't be cleared once set, and can't change after its night ends (the
  trigger checks the clock; the service returns a friendly 409 first). `removed_at` (the author's "delete") is final.
- **Author removal is `removed_at`, not `hidden_at`.** `hidden_at` is a moderator decision that a moderator can
  restore; an author's delete must not be undone by a RESTORE.
- **Likes are rows in `photo_like`** (one per user per post). They're reactions, not content, so unliking deletes the
  row. A trigger refuses likes on your own post and on anything but a shared post; a write-time `countable` snapshot
  keeps App Review likes out of every count, like reports.
- **Featuring** stores results in `featured_photo` (rank 1-20, at least 3 eligible likes, one feature per photo) and
  marks each processed night in `featured_run`, in the same transaction. Both are append-only (triggers), which is
  what makes a rerun or a late run safe.
- **Verification** is `app_user.verified_at` plus an append-only `verification_event` log with a required note
  (3-300 characters, CHECK).
- **Rate limits** for follows, likes and posts use a `rate_event` ledger counted under a per-user advisory lock,
  pruned by the cron after a day. Counting created rows wouldn't work: unfollow and unlike delete theirs.
- **Privacy rules live in one pure module**, `src/server/privacy.ts`: full vs limited profile access, per-viewer
  author resolution (handle, verified and Regular badges, or "Anonymous", or "Deleted user"), list entries (handle
  and badge always, name and photo only with full access), and photo visibility. Staff (moderators and admins)
  always see real people. A pending request grants nothing. `tests/unit/privacy.test.ts` covers every viewer kind
  against every account state.
- **Review fixes (Phase 1).** `photo.shared` defaults to **false** (fails closed); the service sets it explicitly.
  Featuring is guarded in the database too: a night can only be featured after it ends, and each featured row must
  be a shared, visible post of that venue and night (the tables are append-only, so a bad insert would be forever).
  Blocks are part of the privacy rules (a blocked pair gets limited/"Anonymous"/nothing), not only a caller check.
  Post detail is for rated posts only; a live-only photo is reachable only through the venue feed's time window.
  Staff can open hidden and removed posts, so a flagged post its author removes can still be moderated.
- **Removed posts don't count toward Regular**, same as hidden ones: the author took them back.
- **Rating lock clock:** the service decides with its `now`, the trigger with the database clock. They agree except
  within clock skew of 5:00am, where the worst case is a 409 from one and not the other.

### Phase 2: follows, requests, private/public, blocks
- **One service for people** (`src/server/services/people.ts`): follows and requests, profiles, followers and
  following lists, search, profile settings, profile photo. `social.ts` keeps presence and RSVPs only.
- **`PUT /follow` answers with a state**: `following` (public account, instant) or `requested` (private). `DELETE`
  unfollows or cancels a request. Both are idempotent; a repeat never counts against the rate limit (60/hour).
- **Switching to public leaves requests pending.** `PATCH /api/me/profile` returns `pendingRequests`, and the app asks
  "Approve N pending requests?" before calling `POST /api/me/follow-requests/approve-all`.
- **Deciding a request is keyed on "addressed to me"**: the lookup is `(requester, me)`, so there's nothing another
  user's id could reach (404). Approving re-checks blocks and suspension.
- **Limited profiles are a separate response shape** (`access: "limited"`: handle, badge, `isPrivate`), not the full
  shape with nulls, so a new field can't leak by being added to the full branch and forgotten here. Counts are hidden
  too ("only the handle and a generic avatar").
- **Followers/following lists need full access** (403 `private_account`). Entries show every person's handle and
  badge; display name and photo only where the viewer has full access to *that* person.
- **Search matches a private account's display name only for people who follow it**; otherwise matching would reveal
  the name. Handles are searchable for everyone (the handle is the one thing a private profile shows).
- **Profile counts are posts, followers and following**. The old "reports" and "photos" counts are gone.
- **Venue accounts are private by default too**, so their replies read "Anonymous" to non-followers. The app labels
  venue replies with the venue name anyway, so nothing is lost. Owners can switch to public.
- **Anonymous authors can be reported but not blocked** from the venue page: blocking needs the handle, which the
  viewer isn't allowed to have. Reporting goes by content id, and moderators see the real author.

### Phase 3: posts
- **Posting is the existing photo upload with a `rating`** (multipart `"1"`-`"10"`) and an optional `shared`. That
  gives posts the geofence check, the 15-minute per-venue photo cooldown, EXIF stripping, the content filter,
  moderation and auto-hide with no second path. A new 20-per-hour limit covers posts and photos across venues.
- **Camera-only is the app's job.** The server can't tell a camera shot from a library pick (uploads are re-encoded
  on the phone, which drops EXIF), so it enforces what it can: the upload's coordinates must be inside the geofence,
  checked at upload. The app sends the position taken together with the photo and offers no library for posts. Like
  reports, a spoofed GPS still passes (REVIEW.md, known limitations).
- **Live photos stay as they were** (the merge option in the spec): no rating = a live-only photo, 140-character
  caption, always on the venue page, never on the profile, not likeable. It can be rated the same night, which turns
  it into a post that stays shared (it was already on the venue page); the author can unshare it after.
- **Caption freeze** follows comments: 409 while a flag is open or when hidden. Sharing can still change while
  flagged (the flag is about the content, not where it's shown).
- **"Delete from profile" is `POST /api/posts/:id/remove`**, not DELETE: user content has no DELETE handler anywhere.
  The file is kept (the post is hidden, not deleted) so moderators can still act on a flagged post an author removes;
  account deletion still deletes files. Live-only photos can't be removed (they leave the feed after 24 hours).
- **Post detail is 404, never 403**, when the viewer may not see it, so a private post's existence isn't revealed.
  The posts grid and Places answer 403 `private_account`, since the profile already says it's private.
- **Places** lists each venue with the number of posts and the latest rating there (the spec's "their rating"),
  newest first. It's per person and needs full access; no venue average exists anywhere.
- **Review fixes (Phases 2-3).** Anyone can block an "Anonymous" author by content (`POST /api/blocks`): the server
  blocks whoever wrote it and never says who; the block list then shows "Someone you blocked from a photo" and
  unblocks by an opaque ref. Follows, requests and blocks for a pair are serialized by the same pair of advisory
  locks. Suspended accounts read "Anonymous" to non-staff (their profile 404s). A live photo's caption stays fixed,
  as before, unless the same edit rates it. Caption *and* sharing freeze while a flag is open, so a post can't be
  moved out of view mid-review. A database guard firing at a boundary answers 409 with its sentence, not 500.
- **Featuring must not trust the share toggle** (for Phase 5): likes survive un-share/re-share, and a featured
  photo can be un-shared later. So likes count only if made during the post's night or before the run, and every
  gallery read re-checks shared, hidden and removed.
- **Rating a live photo keeps it shared**, even for a private account: it was already on the venue page, so
  un-sharing it would be the surprise. The author can unshare it after.

### Phase 4: verified badge, Regulars
- **Verification is a column plus a log.** `setVerified` changes `verified_at` and appends a `verification_event`
  (GRANT/REVOKE, required 3-300 character note, the admin) in one locked transaction. A no-op grant or revoke is 409,
  so the log never records a change that didn't happen. Account deletion revokes with a system entry.
- **Badge only.** Nothing but display code reads `verified_at`; a test compares feed order, consensus and counts before
  and after verifying. It rides on `AuthorView`/`PersonView`/profiles, so it appears only next to a handle the viewer
  may see (never on "Anonymous"). Limited profiles and search do show it, since they show the handle.
- **Admin tools are web-only** (`/admin` → Verified badges): search by handle, name or email (staff see real accounts),
  then Verify/Revoke with a note, and the recent log.
- **Regulars are computed on read** (`src/lib/regulars.ts`, constants `REGULAR_MIN_NIGHTS = 3` and
  `REGULAR_WINDOW_DAYS = 60`), from posts: rated, not hidden, not removed, countable (no App Review). Unshared posts
  count: they're still proof of presence. The window is by night key, inclusive of the night 60 days ago. Two
  queries with `distinct` on (user, venue, night) keep it cheap without a cache; add one if profiles get slow.
- **The Regular badge rides on the resolved author** (`regular` on `AuthorView`), so it's attached only to a visible
  handle; "Anonymous" carries nothing. Full profiles list `regularAt`.

### Phase 5: likes, eligibility, nightly featuring, gallery, activity
- **One pure module for the rules** (`src/lib/likes.ts`): `isEligibleLike` (USER, 7+ days, reputation 0.5+, not the
  author, not an owner of the venue, not App Review, not deleted or suspended, made by the run), `rankNight`
  (3+ eligible likes; ties: earlier post, then id; top 20) and `visibleTop` (top 10 still visible). Constants are named.
- **Eligibility is judged at run time**, as the spec says ("at the time of the run"): account age, reputation and
  ownership are read when the job runs, not when the like was made. A like that exists at the run counts even if it
  was made after the night ended (until 5:05am); a later like never re-ranks a processed night.
- **The job catches up the last 7 completed nights** it hasn't processed, one transaction per night, with the night
  marked in `featured_run`; a try-lock makes a concurrent run report `skipped`. It never processes tonight (and the
  database refuses it). It runs from **cron-job.org at 5:05 America/New_York**, not Vercel Cron, whose schedules are
  UTC and can't follow daylight saving time (DEPLOY.md).
- **Suspended authors' posts aren't featured**, and a suspended or deleted author's featured photo drops out of the
  gallery, like a hidden one.
- **The gallery re-checks visibility on every read**: shared, not hidden, not removed, not App Review, author not
  deleted or suspended, and not blocked with the viewer. So a photo the author unshares or a moderator hides is
  replaced by the next rank, per viewer for blocks. Archive counts ignore the viewer's blocks (one query per venue).
- **The venue page carries a 30-photo preview** of this month and the list of archive months; each month (and the
  full current month) comes from `GET /api/venues/:id/featured?month=`. It keeps the venue payload bounded.
- **"Featured at ___, <month>"** on a profile counts only photos currently shown in a gallery (top 10 visible).
- **Activity is derived, not stored**: pending requests (any age), new followers, likes on your posts and your features
  from the last 30 days, newest first, 100 at most. People are shown per the privacy rules; blocked people and App
  Review likes never appear. No push notifications.
- **Likes are 200/hour**, counted like follows. Like counts exclude App Review likes. Unliking returns the count only
  for a post you can still see.
- **Review fixes (Phase 4).** Regular status counts *visits*: a post opens a new night only if it's on a different
  night and at least 12 hours after the last counted one, so one visit across 5am can't count twice. The window is
  exactly 60 nights by night key (tonight and the 59 before), so daylight saving time can't move it. The badge is tied
  to its log in the database: `verified_at` can only change in a transaction that wrote a matching `verification_event`
  first, and no account can be created verified. Verification and account deletion take the same lock and re-read
  under it, so a grant can't slip past a deletion unlogged.
- **Posts prove presence only as well as GPS does.** Regular status and featuring inherit the geofence's weakness
  (client-reported coordinates). Logged in OPEN-QUESTIONS.md.
- **Review fixes (Phase 5).** Featuring now uses a fixed per-night **cutoff** (5:05am, the scheduled time): only likes
  made by then count, and account age is measured then, so a late or catch-up run features exactly what an on-time
  run would have. (Reputation, ownership and suspension are still read at run time; there's no history of them.) An
  account flagged App Review after liking doesn't count. Nights are walked by calendar day, so spring-forward can't
  skip one. Each night is one transaction that takes its own advisory lock on the same connection (no idle lock
  connection, fine with a pool of one), and a failing night is logged and retried by the next run without blocking
  the others. The cron route is POST only. Likes take a per (user, post) lock (a double tap can't 500), and suspended
  accounts' likes don't show in counts. The venue page builds only the 30-photo preview (signed URLs, likes, Regular
  status) and resolves people once. Activity loads its features in two queries.
- **The last night of a month goes straight to the archive.** "This month's best" is the current New York calendar
  month by night date, so the night of the 30th, featured at 5:05am on the 1st, appears under that month in the
  archive. Between midnight and 5am on the 1st the new month's gallery is already showing (empty).
