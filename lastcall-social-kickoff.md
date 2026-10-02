# Kickoff: take over the Last Call social layer build

You are taking over an in-progress build from another model. Everything you need is in the repo. Your job is to finish it to the same standard the previous builder set: test-first, reviewer after every phase, nothing leaking, nothing half-wired.

## 1. Orient (read before you touch anything)

The repo is `~/lastcall`: `backend/` (Next.js 15 + Prisma 6 + Postgres 16, pnpm) and `mobile/` (Expo, Expo Router, React Native, npm). Work only on the `feature/social` branch.

```
cd ~/lastcall
git fetch
git checkout feature/social
git pull
git log --oneline -10
```

Then read these, in this order:

1. `HANDOFF.md` (root): current status, what exists, the reviewer's Phase 1 findings, the decisions so far, the next 3 steps, and environment notes. **This is your map.**
2. `lastcall-social-features-prompt.md` (root): the full spec. Where the spec and `HANDOFF.md` differ, the handoff's recorded decisions win, because they were made deliberately. If you think one of them is wrong, don't silently change it: write it up in `OPEN-QUESTIONS.md` and keep going.
3. The "Social layer" section of `backend/DECISIONS.md`, and `OPEN-QUESTIONS.md`.
4. `backend/REVIEW.md` and `mobile/REVIEW.md`: the existing hard invariants and privacy rules you must not break.
5. `backend/API.md` and `backend/src/contracts/api.ts`: the contract the mobile app depends on.
6. The code the handoff names: `backend/src/server/privacy.ts`, `backend/src/server/rate-limit.ts`, `backend/src/server/services/people.ts`, `backend/src/server/services/social.ts`, `services/account.ts`, `services/blocks.ts`, `services/venues.ts`, and the Phase 1 migration `backend/prisma/migrations/20260927200000_social_layer/migration.sql`.

## 2. Verify the starting state

Before writing code, confirm the handoff is accurate:

```
df -h /
cd ~/lastcall/backend && docker compose up -d
pnpm install && pnpm exec prisma generate
pnpm typecheck && pnpm lint && pnpm test
cd ~/lastcall/mobile && npm install && npm run check
```

Expected: backend typecheck and lint clean with **321/321** tests, mobile **157/157**. If anything differs from `HANDOFF.md`, note it in the backend `AI-LOG.md` and fix it before starting new work. If free disk space is under 5 GB, clean caches before installing anything (`pnpm store prune`, `npm cache clean --force`), and never install Xcode or simulators.

## 3. Environment rules (from the previous builder, learned the hard way)

- Postgres runs in Docker on port 5434. Tests use the `lastcall_test` database, which migrates itself each run.
- **Prisma blocks AI agents from `migrate reset` and interactive `migrate dev`.** Don't try to bypass it. Write migrations with `prisma migrate diff` against the `lastcall_shadow` database (URL in `HANDOFF.md`), save them as new migration folders, and apply them with `prisma migrate deploy`.
- Never edit an existing migration. Every fix goes in a new one.
- Run `pnpm exec prisma generate` after every schema change.
- The mobile contract is a copy: after changing `backend/src/contracts/api.ts`, run `cd mobile && npm run sync:contracts`. The drift test must pass.

## 4. The work, in order

### Step A: fix the Phase 1 reviewer findings

Create one new migration named `..._social_fixes` and fix findings **1 through 10** from `HANDOFF.md`, plus nits **11, 13, 14, 16, 17, and 18**. For each: write a failing test first (in `tests/unit/privacy.test.ts` or `tests/integration/social-db-guards.test.ts`), then fix, then confirm it passes. In particular:

- `photo.shared` must default to **false**, with the service setting it explicitly.
- Blocks must live **inside** `privacy.ts` (`profileAccess`, `resolveAuthor`, `canSeePhoto`, `authorResolver`), so a caller that forgets a block check still can't leak anything.
- Account deletion and blocking must clean up every new table the handoff lists.
- `verification_event.actor_id` becomes `ON DELETE RESTRICT`.
- Featuring can never be written for a night that hasn't ended, and `featured_photo` rows are validated against their photo in a trigger.
- The like guard refuses hidden, removed, uncountable, and deleted-author posts.
- `canSeePhoto`: post detail is for rated photos only, and staff can open removed posts.
- Add `suspended` to the privacy `Subject`.

For nits **15, 19, and 20**: add the Sybil-risk entry to `OPEN-QUESTIONS.md`, document the Regular rule in `DECISIONS.md`, and fix the indentation. Nit **12** (DB clock skew) gets a note in `DECISIONS.md`.

Then write the missing **Phase 1 entry in `backend/AI-LOG.md`**: what was built, what the reviewer found, what you fixed. Commit.

### Step B: finish and wire in Phase 2

Follow the handoff's "Next 3 concrete steps", items 2 and 3, exactly:

- Add every route it lists and point the follow routes at `people.ts`.
- Delete the old follow, profile, and search functions from `social.ts` and update every import. No two code paths for the same job may remain.
- Extend `/api/me` with the listed fields.
- Apply `authorResolver` to photos, comments, and replies in `venues.ts#getVenuePage`. **The server must never send a private author's handle to a viewer who can't see it.**
- Call `pruneRateEvents` from the reputation cron.
- Update the contract (`api.ts`, `API.md`, the contract test `REGISTRY`), then sync it to mobile and fix every mobile compile error from the `authorHandle` to `author` change.
- Update the web pages and existing tests the handoff lists.
- **Privacy tests for every payload that includes an author,** for each viewer type: signed out, stranger, pending requester, approved follower, self, moderator, owner of that venue, and blocked user. Plus IDOR tests for every new route (user A can't approve B's requests, read B's private lists, remove B's followers, or change B's profile).

Run both folders' full checks, run the reviewer, fix, commit, and write the `AI-LOG.md` entry.

### Step C: Phases 3 through 7

Build the rest exactly as the spec describes, using the planned designs already recorded in `HANDOFF.md` ("Planned, not yet built"): the `author: AuthorView` shape, the separate featured gallery endpoint, the post endpoints (`POST /api/posts/:id/remove`, never DELETE), activity derived from data with no notifications table, and a featuring cron that processes every completed, unprocessed night in the last 7 days.

- **Phase 3:** posts, the 1 to 10 rating, the in-app camera and geofence proof rule, the rating lock at the end of the night, the share toggle defaults.
- **Phase 4:** the verified badge with the admin web tools and append-only log; Regular status (3 nights in 60 days, computed, never stored as editable).
- **Phase 5:** likes, the eligibility module, the nightly featuring job (top 20 stored, top 10 visible shown, 3 eligible likes minimum, backfill when one is hidden), the monthly gallery and archive.
- **Phase 6:** every mobile screen in the spec, following the design system strictly.
- **Phase 7:** the deterministic demo seed with the full mix the spec lists, a polish pass, and `DEVICE-CHECKLIST.md` additions.

## 5. How to work

- **Autonomous.** Don't stop between steps or phases for approval. Stop only for credentials, and only after everything else is done. If you're blocked on one thing, work around it, note it, and keep going.
- **Test-first** for every bug and every rule. No privacy rule exists without a test that would catch it being broken.
- **After every phase:** typecheck, lint, and all tests in both folders; then spawn a reviewer subagent with this instruction: "Review this phase's diff against the spec, HANDOFF.md's decisions, the existing hard invariants, and the privacy rules. Look specifically for private-account data leaking to viewers who shouldn't see it, block bypasses, IDOR, ways to game likes or featuring, and anything a venue could use to control user content. List concrete bugs with file and line." Fix every real finding, commit, and write the `AI-LOG.md` entry.
- **Keep `HANDOFF.md` current.** Update its status table and "Next 3 concrete steps" at the end of every phase, so this build can be handed off again at any point without losing anything.
- Log judgment calls in the relevant `DECISIONS.md`, and product questions in `OPEN-QUESTIONS.md` (with the default you chose).
- Commit often with clear messages. Push the branch after every phase. Never commit to `main`, never force-push, never commit `.env`.
- If your context gets long, re-read `HANDOFF.md` and the latest `AI-LOG.md` entries to reorient instead of stopping.

## 6. Rules that must never break

- The six hard invariants and every existing privacy decision still hold.
- Posts, ratings, likes, featuring, verification, and Regular status **never** affect live consensus, counts, accuracy, or reputation.
- Venues can't pick, hide, remove, reorder, or rank posts, likes, or featured photos. They can only report.
- No user coordinates, raw storage keys, or private handles in any payload a viewer shouldn't get.
- App Review (`countable = false`) data never counts toward anything.
- No hard deletes of user content rows.

## 7. When you're done

1. Everything green in both folders, and CI if it exists.
2. `HANDOFF.md` updated to show all phases done.
3. Update both `REVIEW.md` files and regenerate the bundles as `REVIEW-BUNDLE-backend.txt` and `REVIEW-BUNDLE-mobile.txt`.
4. Push `feature/social` and open a pull request with `gh pr create` summarizing the features, the privacy model, the reviewer findings you fixed, and the open questions.
5. Tell me in plain language: what was built, how to try each feature on my phone, and what needs my decision.
