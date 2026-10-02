# Review (backend)

How each rule from `../CLAUDE.md` is enforced, and the test that proves it. Verify with `pnpm test`; the invariants live in
`tests/integration/invariants.test.ts`, one test per rule, and `scripts/gate.sh` fails if any is missing or skipped.

| # | Rule | Enforced in | Proven by |
|---|---|---|---|
| 1 | Stamp only inside the geofence; exempt accounts are visible only to themselves | `services/geofence.ts`, `stamps.ts#createStamp`, `canSeeStamp` (countable) | invariants "rule 1"; `stamps.test.ts` per-place radius; `compliance.test.ts` exempt accounts |
| 2 | Private account's stamps and places reach only full access, in every payload | `privacy.ts` (`profileAccess`, `canSeeStamp`), `stamps.ts#assertVisible`, feed query | invariants "rule 2"; `privacy.test.ts` (8 viewers x 6 payloads, private and public); `tests/unit/privacy.test.ts` |
| 3 | Blocks override everything except staff | `blocks.ts`, `privacy.ts`, feed `blocking` / `blockedBy` filters | invariants "rule 3"; `privacy.test.ts` "blocking by handle" |
| 4 | Hidden, never deleted; the moderation log is append-only | DB triggers (`photo_no_delete`, `moderation_event_*`, `photo_immutable`), `removeStamp` | invariants "rule 4"; `db-guards.test.ts`; `moderation.test.ts` |
| 5 | EXIF and GPS stripped from every upload | `services/image.ts#processImage` (full re-encode) | invariants "rule 5" (direct and through the stamp path) |
| 6 | No user coordinates, storage keys or user ids in payloads | explicit selects in `stamps.ts`, signed URLs only | invariants "rule 6" (every payload scanned); contract test (`.strict()` schemas) |
| 7 | Reputation visible only to the user and moderators | `people.ts#getProfile`, `me.ts` | invariants "rule 7" |
| 8 | Under-21s blocked at signup, nothing stored | `auth.ts#signup` (first statement), `lib/age.ts`, no birthdate column | invariants "rule 8"; `age-gate.test.ts` (row counts before and after); `tests/unit/age.test.ts` |
| 9 | Feed is chronological from people you follow | `stamps.ts#listFeed` (order by `created_at desc, id desc`, no other input) | invariants "rule 9"; `stamps.test.ts` paging |
| 10 | Likes and badges never affect anything else | no code reads likes or `verified_at` outside their own payloads | invariants "rule 10" |

| 11 | With `SOCIAL_ENABLED` off, nothing of another person's passport reaches anyone but its owner | `privacy.ts` (`profileAccess`, `canSeeStamp`), `http.ts` (social routes 404) | invariants "rule 11"; `personal-mode.test.ts` |

## Other things worth checking

- The contract test (`contracts.test.ts`) calls every route and fails if a route exists without a schema in
  `src/contracts/api.ts`, or a response drifts from it.
- `seed.test.ts` runs the real seed and checks it: deterministic, anchored to now, geofence-valid, privacy and block rules
  hold on the seeded data.
- Migrations in `prisma/migrations/2026100*`: read `strip_to_nostos` (drops), `stamps` (triggers, CHECKs), `flag_category`,
  `stamp_photos`, `pinned_stamps`, `neighborhoods`.
- Session 2 data features: up to six photos per stamp (`stamp-photos.test.ts`), pinned stamps (`pins.test.ts`), neighborhoods and
  collections (`neighborhoods.test.ts`), the place page (`stamps.test.ts` "my place page"), oldest-first page and slot
  (`tests/unit/layout.test.ts`, `stamps.test.ts`).
- The server saves the phone's coordinates with each stamp (`photo.lat`, `photo.lng`) as the record of the geofence check. They are in
  no payload (invariant 6). Whether that is acceptable is OPEN-QUESTIONS L4 and L6.
- Open questions that affect the backend: `../OPEN-QUESTIONS.md` (L1 songs terms, L2 age gate, L3 SAFE for Kids Act, L4
  geolocation disclosures).

## Codex lane review, 2026-10-02

The default is personal mode. Social-mode rules in the table above apply only with SOCIAL_ENABLED enabled.
Personal moderation/admin callers are 404s, foreign mutations have identical status/body/headers, photos are creation-only,
and deferred live-content constraints protect edit/removal races, including repeatable-read snapshots.
Live songs must have non-whitespace titles and artists at the database boundary.

Regression coverage: personal-moderation.test.ts, stamp-mutation-visibility.test.ts, stamp-photo-creation.test.ts,
stamp-content.test.ts, backend-audit.test.ts and personal-staff-pages.test.ts. Invariant rule 11 is stronger.
Prior backend-lane gate: backend 292 tests (34 files), mobile 292 tests (39 suites), contract sync and required invariants passed.

Current detailed report: ../reviews/2026-10-02T180902Z-codex-1.md
Contract-changing commit: 2723315. Regenerate mobile/src/api/contracts.ts with npm run sync:contracts after merge;
do not resolve generated-copy conflicts manually. No other mobile source was edited in that prior backend-only session. The user subsequently authorized full mobile completion in this checkout.


## Combined working-tree continuation

HEAD remains 42a6c0d; Claude's incoming merge commit is e639860. The merge and new fixes are uncommitted by user request.
Combined checks passed 292 backend tests and 407 mobile tests; backend production build and iOS/Hermes export passed.
The final session report and regenerated bundles describe this working-tree snapshot, not a new commit.
The prior backend guards and four forward migrations are reused; no new migration or database reset was performed.

Current continuation report: ../reviews/2026-10-02T185815Z-codex-2.md

Latest focused fix report: ../reviews/2026-10-02T191304Z-codex-3.md. Single full gate: backend 292 / mobile 413. First inside-cover and final right-page regressions pass with Reduce Motion on/off; four-stamp page-2 navigation is covered. Native results remain unverified.
