# Stamp repair pass: reviewer notes

Scope: PR #13, branch `codex/stamp-category-templates`, continuing from `8754ba3`.

## How this pass was done

Everything was done through the GitHub API (`gh`): reading files, reading Actions logs, and committing to the branch. There was no local checkout, no build, no simulator, no browser. **No visual verification of any kind has been done in this pass.** Items 1 through 5 of the handoff's visual priorities (phone-size readability, circle composition, international name fitting, native/web parity, real-photo clipping) are not addressed here and still need someone with a device or simulator.

## Branch activity from others

After `8754ba3`, eight commits by another contributor landed (`de284fa` to `3dc2324`): a single-page passport flipper for phones (`SinglePageFlipBook.tsx`, `PassportBook.tsx`) and a CI split into separate mobile and backend jobs. These address the phone-size readability blocker structurally. They were not re-reviewed here and have not been judged visually.

## Backend test triage (CI run for `bda853a`: 19 failed of 212)

Method: failures from the Actions log, each checked against the current code and migrations. Nothing was loosened to turn CI green.

### Fixed in this pass

| Test | Cause | Evidence |
|---|---|---|
| `stamp-photos` "holds up to 6 photos..." | Test fixture inserted a raw `Photo` row with `lat`/`lng`. Migration `20261008193000_visit_verification` added `photo_no_raw_coordinates CHECK (lat IS NULL AND lng IS NULL)`. The constraint is correct (invariant 2). The fixture was stale. | Postgres error 23514 in log |
| `stamp-photos` "refuses later additions..." | Test assumed photos are creation-only. The same migration drops `stamp_photo_creation_only`, and `addStampPhotos` allows additions up to `MAX_STAMP_PHOTOS`. Test now asserts the cap (over-cap add refused, freed slot reused, survivors keep positions). The 6-photo DB trigger is unchanged. | migration lines 9-10; `stamps.ts` |

Commit `bfbc29d`. Not yet confirmed green; CI has to re-run.

### Diagnosed, not changed

| Tests | Finding |
|---|---|
| `age.test.ts` (3), `age-gate.test.ts`, `invariants` rule 6 | Code is a **13+** gate (`MIN_AGE = 13`, main commit `5e9f75a` "lower account eligibility to 13+"). Tests still assert 21+. `OPEN-QUESTIONS.md` still says 21+ under "Age gate". This is a policy and legal question, so I did not rewrite the tests. Needs an owner decision: confirm 13+ and update tests, or revert the code. |
| `invariants` rule 1, `compliance` (2) | Tests expect an out-of-geofence stamp to be **rejected**. Current product (CLAUDE.md invariant 1) creates a valid **unverified** stamp, and only exempt accounts differ in countability. Likely stale, but the right new assertions (verified flag, `countable`) need care. Not yet rewritten. |
| `stamps.test.ts` nearby places | `GOOGLE_PLACES_API_KEY` is unset in CI, so Places search throws 503. Needs the Google client stubbed in the test, not a real key. Not yet changed. |

### Not yet investigated

`stamp-content` (2: live-content / snapshot behaviour), `contracts.test.ts` (route registry), `invariants` rule 7 (backend/mobile contract byte-equality; failure shows differing file headers), `seed.test.ts`, `osm-import.test.ts` (fetched 6 vs expected 5). Treat each as possibly a real regression until shown otherwise.

## Still open from the handoff

- All visual verification, with no renders produced in this pass.
- Persisted per-stamp artwork versioning: still not implemented. `category-ink/1` is a label only, and stamps can change if venue metadata or the renderer changes.
- The approved reference PNG and phone defect screenshots are not in the repo.

*Commits in this pass carry no unrelated source changes; only tests and this note.*
