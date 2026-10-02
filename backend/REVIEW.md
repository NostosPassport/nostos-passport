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

## Other things worth checking

- The contract test (`contracts.test.ts`) calls every route and fails if a route exists without a schema in
  `src/contracts/api.ts`, or a response drifts from it.
- `seed.test.ts` runs the real seed and checks it: deterministic, anchored to now, geofence-valid, privacy and block rules
  hold on the seeded data.
- Migrations in `prisma/migrations/2026100*`: read `strip_to_nostos` (drops), `stamps` (triggers, CHECKs), `flag_category`.
- Open questions that affect the backend: `../OPEN-QUESTIONS.md` (L1 songs terms, L2 age gate, L3 SAFE for Kids Act, L4
  geolocation disclosures).
