# Handoff: social layer (`feature/social`)

**Spec:** `nostos-social-features-prompt.md` (repo root; `nostos-social-kickoff.md` is the kickoff note). It
defines 7 phases. After each phase:
1. Run typecheck, lint and all tests in both folders.
2. Run a reviewer subagent.
3. Fix its findings and commit.
4. Add an `AI-LOG.md` entry.

Judgment calls go in the relevant `DECISIONS.md`, product questions in `OPEN-QUESTIONS.md` (root; 6 so far).

## Status

| Phase | State |
|---|---|
| 1. Schema, migrations, privacy module | **Done**, reviewed, fixes committed |
| 2. Follows, requests, private/public, blocks | **Done**, reviewed, fixes committed |
| 3. Posts, ratings, camera-only rule, sharing | **Done**, reviewed, fixes committed |
| 4. Verified badge + admin tools, Regulars | **Done**, reviewed, fixes committed |
| 5. Likes, eligibility, nightly featuring, gallery/archive, activity | **Done**, reviewed, fixes committed (`79ddc8a`) |
| 6. Mobile screens | **Done**, reviewed, fixes committed (local git; see "Repo state" below) |
| 7. Seed update, polish, `DEVICE-CHECKLIST.md` | **Done**, reviewed, fixes committed (dev DB migrated and reseeded) |
| Final: REVIEW.md ×2, bundles `REVIEW-BUNDLE-backend.txt` / `REVIEW-BUNDLE-mobile.txt`, PR | REVIEW.md and bundles **done**; push/PR **not done** (no remote; user asked for no GitHub work) |

The **backend is feature-complete for the spec** (every endpoint the mobile screens need exists and is contracted).
The mobile app compiles against the new contract with minimal adaptations only (see below).

### Checks at `79ddc8a`
- Backend: `pnpm typecheck` and `pnpm lint` are clean. `pnpm test` passes **434/434** (35 files), three runs in a
  row.
- Mobile: `npm run check` (tsc, `expo lint --max-warnings 0`, Jest) passes **157/157**. The contract copy is in sync
  (`npm run sync:contracts`; a Jest test fails on drift).
- No failing tests.
- **Warning:** integration tests share one database (`nostos_test`). Never run two backend test processes at once
  (for example, a reviewer subagent running tests while you do). They truncate each other's tables, and you get
  confusing failures such as "Venue not found".

## Backend map (all in `backend/`)
- **Privacy rules:** `src/server/privacy.ts` (pure). Full vs limited profile access, `AuthorView`
  (user/anonymous/deleted, carrying `verified` and `regular`), `PersonView`, and photo visibility. Blocks and
  suspension are built into the rules. Staff always see real people.
- **Services:**
  - `people.ts`: follows, requests, profiles, lists, search, profile settings, avatar.
  - `posts.ts`: edit, remove, detail, grid, places.
  - `likes.ts`
  - `featuring.ts`: the nightly job.
  - `gallery.ts`: this month, archive, month pages, profile "Featured at".
  - `activity.ts`
  - `verification.ts`
  - `regulars.ts`
  - `blocks.ts`: including block-by-content and pair locks.
- **Pure rules:** `src/lib/likes.ts` (eligibility, ranking, top-10 visible) and `src/lib/regulars.ts` (3 visits in
  60 nights).
- **Rate limits:** `src/server/rate-limit.ts` (follow 60/h, like 200/h, post 20/h).
- **Migrations:** `20260927200000_social_layer`, `…210000_social_fixes`, `…220000_block_source`,
  `…230000_verified_logged`. They hold hand-written triggers: rating lock, removal is final, like guard, featuring
  guards, append-only logs, the badge only changes with a log entry.
- **Contract:** `src/contracts/api.ts`. The human reference is `API.md`, which has sections "Posts", "Likes and the
  featured gallery" and "People and privacy". The featuring cron (cron-job.org, 5:05 America/New_York) is set up in
  `DEPLOY.md` step 7.
- **Web:** `/admin` has a "Verified badges" section (`src/components/owner/VerificationTools.tsx`).

## Endpoints the mobile screens will use
- **Profile**
  - `GET /api/users/:handle`: `ProfileResponse`, a union on `access` ("full" or "limited"). Full includes `regularAt`
    and `featured`.
  - `GET /api/users/:handle/posts?before=`: paged grid; `nextBefore` is an opaque cursor.
  - `GET /api/users/:handle/places`
  - `GET /api/users/:handle/followers` and `/following`: `PersonRow[]`; 403 `private_account` for limited access.
- **Following**
  - `PUT/DELETE /api/users/:handle/follow` → `{state}` ("none" | "requested" | "following").
  - `GET /api/me/follow-requests`
  - `POST /api/me/follow-requests/:handle {approve}`
  - `POST /api/me/follow-requests/approve-all`
  - `DELETE /api/me/followers/:handle`
- **Own profile**
  - `GET/PATCH /api/me/profile` {displayName, bio, isPrivate}. The response's `pendingRequests` drives the prompt
    "Approve N pending requests?".
  - `POST/DELETE /api/me/avatar` (multipart `photo`)
  - `GET /api/me` now includes `user.isPrivate/bio/avatarUrl/verified` and `social.pendingFollowRequests` (the badge
    count).
- **Activity:** `GET /api/me/activity`: follow_request, new_follower, like, featured.
- **Posts**
  - Post = `POST /api/venues/:id/photos` multipart with `rating` ("1"-"10") and optional `shared` ("true"/"false";
    the server defaults it: public → on, private → off). No rating = a live-only photo, as before.
  - `GET/PATCH /api/posts/:id` (`ratingEditableUntil`, `likes`)
  - `POST /api/posts/:id/remove` (delete from profile = hide)
  - `PUT/DELETE /api/posts/:id/like`
- **Venue page:** `live.livePhotos/earlierPhotos[]` now carry `rating`, `likes` (null for live-only photos) and
  `author: AuthorView`. The page adds `featured: { thisMonth: {month, photos, total}, archive: [{month, count}] }`.
  `GET /api/venues/:id/featured?month=YYYY-MM` returns a month's gallery.
- **Blocks:** `POST /api/blocks {targetType, targetId}` blocks an **Anonymous** author by content.
  `GET /api/me/blocks` returns `{ref, source, handle|null}`. `DELETE /api/me/blocks/:ref` unblocks.

## Mobile: what exists vs what's left (Phase 6)
Already adapted, so the app compiles and behaves correctly on the new API:
- `src/features/people/author.ts`: `authorLabel` and `authorHandle` ("@handle" / "Anonymous" / "Deleted user").
- `src/features/people/use-follow.ts`: `followButton(state)` and `useFollow().toggle(handle, currentState)`. Unfollow
  and cancel are optimistic; a follow waits for the server.
- `src/features/moderation/content-actions.ts`:
  - `ContentMenuItem` takes `author: AuthorView`.
  - "Block this person" for Anonymous authors uses `api.blocks.authorOf`.
  - `useBlock` accepts `{handle, block} | {content} | {ref, label}`.
- `src/app/(app)/user/[handle].tsx`: limited (private) state, and Follow/Requested/Following.
- `src/app/(app)/people.tsx`: shows `PersonRow`.
- `src/app/(app)/settings/blocked.tsx`: the ref-based list.
- `src/api/client.ts` has `me.unblock` and `blocks.authorOf`. **Every other new endpoint still needs a client method
  and query hook** (`src/api/client.ts`, `src/api/queries.ts`, `src/api/keys.ts`).

Screens to build, per spec section "Mobile app". Follow the design system strictly: tokens in `src/theme/` only
(lint-enforced), SF Symbols via `components/ui/icon`, no emoji, copy tone and anti-patterns per
`mobile/REVIEW.md`, and `mobile/AGENTS.md`/`CLAUDE.md` (use `npx expo install`; check Expo SDK 57 docs).
1. **Profile (own and others'):** header with photo (the `Avatar` component currently shows initials only, so add
   image support), name, handle, verified badge, bio, counts, a Regular badges row, and "Featured at…". Tabs:
   - **Posts:** a 3-column grid with paging.
   - **Places:** a small dark map (`react-native-maps`, as in `features/map`) plus a list with ratings.

   Also: the private state, Follow/Requested/Following, and Edit profile and Settings on your own profile. The own
   profile is `src/app/(app)/profile.tsx`, which today is a settings-style screen; others' is `user/[handle].tsx`.
2. **Edit profile:** photo (library picker, via `features/photos/pick.ts` and `prepare.ts`), display name, bio (150),
   and a Private toggle with a one-line explanation. It should mention that going public shows your handle on your
   past venue photos. After switching to public with `pendingRequests > 0`, alert "Approve N pending requests?".
3. **Follow requests:** Approve and Decline, with a badge count on the profile entry
   (`me.social.pendingFollowRequests`).
4. **Activity:** the four item kinds.
5. **Post composer:**
   - The in-app camera only (no library for posts; today `venue/photo.tsx` offers Library, so a post must not).
   - Then a 1-10 rating picker: a horizontal row of tappable numbers, with haptics, readable and accessible.
   - Then caption (280) and the "Share to venue page" toggle, defaulting to on when public and off when private.
   - Then post.
   - Show a clear error when outside the venue: the server's 403 message.
   - Decision already made: a photo without a rating stays a live-only photo, so the composer can offer "post without
     rating (live only)", or simply require a rating. Log the choice in `mobile/DECISIONS.md`.
   - Reuse `features/photos/upload-store.ts`: it needs to pass `rating` and `shared` as form fields.
6. **Post detail:** photo, author (per privacy), venue, rating, caption, likes, and actions (Like, Report, Block
   author; Edit and "Delete from profile" for your own). Edit covers the rating until `ratingEditableUntil`, the
   caption, and shared.
7. **Venue page** (`features/venue/*`, `features/photos/photos-section.tsx`): a "This month's best" section and the
   archive ("September's best"), each opening a month gallery. Likes on shared photos: a heart button, plus
   double-tap on the photo in the viewer (`venue/photos.tsx`), with a haptic. Regular and verified badges next to
   handles.
8. **Followers / Following lists**, with Remove follower on your own.
9. **Search results** with badges and privacy: already partly done; add the verified badge and avatars.
10. **Verified badge component:** one small custom badge in the theme (not the accent color, not blue, not
    Instagram's), with VoiceOver label "Verified". Add it to the design system (`src/components/ui/`) and use it
    everywhere a handle shows.

Tests to add (Jest, `mobile/src/**/__tests__`): rating picker, follow button states, the author label, the post
composer's share default and camera-only rule, and the profile's limited state.

## Phase 7 (after 6)
- **Seed** (`backend/prisma/seed.ts`, deterministic, anchored to "now"): a mix of public and private accounts, pending
  requests, posts with ratings at several venues, a few Regulars (3+ nights in 60), likes, **two past months of
  featured photos**, verified accounts (use the log: an event, then the badge, in one transaction; the DB refuses
  verified inserts), and at least one private user whose shared photo shows as Anonymous.
  - Insert `featured_run` before `featured_photo` (FK). Only past nights; the DB refuses a night that hasn't ended.
  - Keep the demo accounts: `avaa@lastcall.dev`, `owner_velvet`, `mod_morgan`, `admin`, `appreview`; password
    `DEV_SEED_PASSWORD` or `lastcall-dev`.
  - The seed currently makes photos live-only with `shared` default false. Set `shared: true` explicitly for live
    photos.
- **`DEVICE-CHECKLIST.md`** additions for these features (check whether the file exists in `mobile/`; create it if not).
- **Polish pass.**
- **Final:** update both `REVIEW.md` files; regenerate the bundles as `REVIEW-BUNDLE-backend.txt` and
  `REVIEW-BUNDLE-mobile.txt` (scripts: `backend/scripts/make-review-bundle.mjs` and
  `mobile/scripts/make-review-bundle.mjs`, which currently write `REVIEW-BUNDLE.txt`, so change the output names).
  Then push, open a PR with `gh pr create` summarizing the features, the privacy model and `OPEN-QUESTIONS.md`, and
  tell the user in plain language what was built, how to try each feature on the phone, and what needs a decision.

## Decisions so far
Full text is in `backend/DECISIONS.md` ("Social layer", Phases 1-5 with review fixes) and `mobile/DECISIONS.md`
("Social layer"). The key ones:
- Every account is private, existing ones included. Follow requests are their own table; every `follow` row is an
  approved follow.
- A post is a photo with a rating (the "merge" option); no rating = a live-only photo, unchanged. The rating locks at
  5am New York (service + DB trigger). The author's delete is `removed_at` (final); caption and sharing freeze while a
  flag is open.
- Authors are resolved per viewer on the server (`AuthorView`); a private author's handle never reaches a viewer who
  can't see it. Limited profiles are a separate response shape.
- Anonymous authors can be blocked by content without revealing who they are.
- Verification is admin-only, needs a note and is logged append-only; the DB ties the badge to the log. It's a badge
  only.
- Regular = 3 separate visits (different nights, 12+ hours apart) in the last 60 nights, computed from visible posts.
- Featuring: eligible likes are judged at a fixed 5:05am cutoff per night (deterministic even when the job runs late).
  Top 20 are stored, the top 10 visible are shown, and the job catches up 7 nights. It runs from cron-job.org, not
  Vercel Cron (DST).
- Activity is derived from data (no notifications table, no push).

## Repo state (since Phase 6)
The builder took over from a ZIP download of `feature/social` (no `.git`) at `~/Downloads/nostos-feature-social`, so
there is a **local git repo** there: a baseline commit of the handoff state, then the Phase 6 commits. Nothing has been
pushed and there is no remote; the user asked for no GitHub work for now. `79ddc8a` can't be verified from here.

## Phase 6: what was built (mobile)
See `mobile/AI-LOG.md` ("Social layer, Phase 6") and `mobile/DECISIONS.md` ("Phase 6"). Key files:
`features/people/profile-screen.tsx` (own and others'), `profile-tabs.tsx`, `person-row.tsx`, `use-requests.ts`,
`author-line.tsx`; `features/posts/` (composer rules, likes, post edit); `features/venue/featured-section.tsx`;
screens `edit-profile`, `follow-requests`, `activity`, `connections`, `post/[id]`, `post/edit`, `venue/featured`,
`settings/index` (the old profile content); `components/ui/verified-badge.tsx`, `rating-picker.tsx`.
Checks: `npm run check` 193/193. Not run on a device (no simulator on this Mac).

## Next 3 concrete steps
1. **Device run** of `mobile/DEVICE-CHECKLIST.md` by the user (no simulator on this Mac), and fixes from it.
2. **Decide the open questions** in `OPEN-QUESTIONS.md` (defaults are built).
3. **Push and PR** only when the user asks: this local repo has no remote, so the commits need to go onto the real
   `feature/social` (on top of `79ddc8a`) first.

## Environment notes
- **Postgres:** runs in Docker (`cd backend && docker compose up -d`, port 5434). Tests use `nostos_test`.
- **Migrations:** Prisma blocks AI agents from `migrate reset` and interactive `migrate dev`. Generate SQL with
  `pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma
  --shadow-database-url postgresql://nostos:nostos@localhost:5435/nostos_shadow --script` (the
  `nostos_shadow` DB exists). Create the migration directory **after** generating (an empty dir breaks the diff),
  then `prisma migrate deploy` and `prisma generate`.
- **Dev DB:** migrated to the latest. It was reseeded earlier today with the old seed, so it has no social data yet.
- **Disk:** space on this Mac has been tight (about 9 GB free).
