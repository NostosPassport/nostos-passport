# Review: FlipBook terminal faces

Commit state: uncommitted `build-codex` working tree in `/Users/charlesjinn/nostos-codex`. HEAD remains `42a6c0da577d0a95072ba00617208bfd0c1e338d`; pending incoming merge is `e639860138f2059ff26906145606074f02e14b3f`. No new commit was made.

## Gate output (last 15 lines)

```text
   Start at  15:11:59
   Duration  56.86s (transform 421ms, setup 307ms, collect 3.22s, tests 47.73s, environment 2ms, prepare 1.04s)

== gate: mobile check
PASS iOS eslint-rules/__tests__/rules.test.js (6.812 s)

Test Suites: 51 passed, 51 total
Tests:       413 passed, 413 total
Snapshots:   0 total
Time:        7.308 s, estimated 9 s
== gate: contract sync
== gate: invariants suite
== gate: dependency ledger
dependency ledger ok (69 lines)
GATE OK: backend 292 tests, mobile 413 tests
```

PASS: backend 292 tests (34 files), mobile 413 tests (51 suites), contract sync, required invariants and dependency ledger. Exactly one full gate was run for this fix.

## Done

- Final right face restored at `mobile/src/features/book/FlipBook.tsx:116`: on the last spread, the underlying right face now comes from the current spread rather than an out-of-range next spread. The final turning-page exclusion remains correct: there is no following spread to turn into.
- Initial inside-cover face restored at `mobile/src/features/book/FlipBook.tsx:115`: on spread zero, the underlying left face comes from the current spread rather than an out-of-range previous spread. Interior spreads retain their adjacent underlay faces and turning sheets.
- Boundary regression tests at `mobile/src/features/book/__tests__/flipbook.test.tsx:32` and `:40`: **"renders both first-spread faces with Reduce Motion=%s"** and **"renders both final-spread faces with Reduce Motion=%s"** each run with Reduce Motion false and true. Assertions check both visible faces and no faces beyond the final spread.
- The previous test that blessed the missing inside cover was corrected at `mobile/src/features/book/__tests__/flipbook.test.tsx:23`, **"draws the page it is on, the page under each turn, and nothing past either end of the book"**. It now requires the inside cover to be visible.
- Four-stamp screen regression at `mobile/src/features/book/__tests__/passport-book.test.tsx:66`: **"four stamps: page 2 appears on the final spread and opens its stamp with Reduce Motion=%s"**, run with Reduce Motion false and true. It opens the actual PassportBook, checks inside cover/bearer, advances to the final spread, requires visible pages 1 and 2 and the fourth stamp, taps that stamp, and asserts navigation to `/stamp/s4`. Next remains disabled at the last spread.

## Actual checks

- Red phase: focused FlipBook and PassportBook suites reproduced the defect, **7 failed / 13 passed** across two suites. The corrected old expectation plus the six new parameterized cases failed before the production fix.
- Green phase: `npm test -- --runInBand src/features/book/__tests__/flipbook.test.tsx src/features/book/__tests__/passport-book.test.tsx src/features/book/__tests__/flip-math.test.ts src/features/book/__tests__/pages.test.tsx`, **44 passed / 4 suites**.
- One full gate passed after the combined fix, with its actual output above. Bundle snapshots reuse that recorded check output rather than rerunning tests during packaging.
- Canonical code, tests and documentation remain uncommitted. The delivery folder contains the handoff, this report, both refreshed review bundles and a short real-phone checklist.

## Claims not proven

- No physical iPhone or Expo Go run. Component visibility, navigation and Reduce Motion branches are covered under the existing React Native/Reanimated test mocks; native hit testing, actual page motion and rendering still require the phone checklist.
- No new production build or iOS export was run for this fix. Earlier session packaging results are historical, not proof of this changed FlipBook on a device.

## Decisions

Keep the existing turn model. At the first/last book boundary, render the current outer face underneath because no turning sheet supplies it. Avoid adding a nonexistent terminal turn or duplicating interior faces.

No contract, dependency, database schema or migration change. Database test configuration remains compose nostos-codex, Postgres 5438, nostos_codex/nostos_codex_test. No other checkout/database, archive, push, commit or branch checkout was touched. Existing gate locks are allowed to clear naturally; none is removed or bypassed.

## Open questions / gaps

Physical phone results remain unverified. The short checklist is `mobile/BOOK-PAGES-PHONE-CHECKLIST.md`; broader native/visual gaps and existing legal questions remain unchanged. No unrelated audit or speculative investigation was started.

## Next task

Run the real-phone checklist and review this uncommitted snapshot. Commit only after explicit user authorization.

## Review bundle packaging

Both bundles were regenerated from the current working-tree files using their existing indexed file lists, with this latest report and the short phone checklist included. The recorded single-gate output supplies verification; packaging does not run the generators' embedded test commands again. Bundle headers identify the uncommitted snapshot.
