# AI log (mobile)

## Session 1: strip and rebuild around stamps (2026-10-02)

**Did:** deleted the venue map, venue sheets, report bar, owner screens, comments, featured galleries and their hooks and
tests; rebuilt the app around stamps: tabs, Home feed, Passport (Stamps and Places views), the stamp composer with place
and song pickers, stamp detail and edit, the account gate, the age gate, report categories, the going-public confirm, the
error reporter flag. Kept and adapted: auth, people, follow requests, activity, blocked users, settings, delete account,
moderation.

**Checks:** `npm run check` is part of `../scripts/gate.sh` (typecheck, lint with the design rules, Jest). Nothing was run on
a device or in Expo Go: see `DEVICE-CHECKLIST.md`.

**Not done:** phase 5 design pass (DESIGN.md has no chosen reference). The native Sentry plugin and a development build.


## 2026-10-02 Codex continuation: authorized mobile completion

Imported Claude's F.8-F.13/G/H.1 implementation from build e639860 into the build-codex working tree. The user lifted mobile ownership restrictions and requested no new commits. Existing screens and tests are reused. The combined baseline gate passed 292 backend/397 mobile tests. A new Babel transformation regression failed because PassportBook's stageTransform helper had no worklet marker; a function-level directive makes the installed plugin serialize the helper, and the serialized code runs independently in the regression. Targeted tests passed 10/10. The first task gate caught missing Jest global declarations in the new JavaScript test; those declarations were corrected without changing production lint rules. No physical iPhone or Expo Go runtime has been verified.

Passport fix corrected gate: PASS 292 backend/398 mobile. The next regression reproduced a development API mismatch
(port 3000 versus backend script port 3001); the fallback and LAN expectations now match 3001, with targeted tests 7/7.

The age regression initially failed in UTC, Tokyo and Honolulu (New York passed); the implementation now uses explicit
New York calendar parts. Targeted age/signup tests passed 25/25 and the task gate passed 292 backend/403 mobile.
The expanded song-picker coverage first exposed an inaccessible loading View and a test fixture that incorrectly expected
5xx server text instead of the client's documented fallback. Loading is now explicitly accessible; the 503 fixture uses
song_search_unavailable and asserts the fallback, retry and recovered result. Song/feed/detail coverage passed 12/12.
The first production iOS/Hermes export succeeded. A final export follows the shared loading accessibility change.

Final combined implementation gate: PASS 292 backend tests (34 files), 407 mobile tests (51 suites);
contract sync, required invariants and dependency ledger passed. Final H.2 gate after bundle-tool changes also passed
292/407. Backend production build and final iOS/Hermes export exited 0. Documentation and review bundles reflect an
uncommitted snapshot (HEAD 42a6c0d, incoming e639860). No new implementation commits or migrations.


## FlipBook terminal-face review fix

Focused red tests reproduced first-cover/final-right omissions (7 failed, 13 passed). Boundary underlays now render the current outer face. Focused rendering/navigation/math/page tests passed 44/44. One full gate is running; results and remaining native gaps are recorded in `reviews/2026-10-02T191304Z-codex-3.md`. No unrelated change, contract or migration. Everything remains uncommitted.

Book-face fix full gate: PASS, backend 292 / mobile 413. One full gate only; bundle refresh reuses its saved output and does not rerun tests. Physical iPhone checklist remains unchecked; no native runtime claim.
