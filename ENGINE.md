# Engine: how a builder session works

A session is disposable and stateless. Anything not committed is expendable. Durable knowledge lives only in the repo.
Limits are enforced by gates and ledgers, never by the builder's word. The reviewer verifies claims.

## The loop
1. Orient: `git log --oneline | head -30`, `tail -20 LEDGER.md`, the newest file in `reviews/`, `OPEN-QUESTIONS.md`.
2. Read CLAUDE.md, ENGINE.md, NOSTOS-BUILD-PROMPT.md and DESIGN.md.
3. Run `scripts/gate.sh` for a baseline. If it is red, fixing it is the first task.
4. Take the first unfinished task in NOSTOS-BUILD-PROMPT.md. Checkboxes are hints: prove the task is not already done
   by finding its code and its test before building anything.
5. Build test-first. Run the gate.
6. Commit one task at a time as `phase N: <what>` (strip batches as `strip: <what>`). Tick the checkbox in the same commit.
7. Write a review file `reviews/<UTC date>-<slug>.md` using the template below. Commit it.
8. Continue to the next task. Phases are commit points, not stopping points. Stop only if truly blocked, and then write
   exactly what is needed to OPEN-QUESTIONS.md.

## Hard stops
- No push, no remote, no PR. Branch `build` only.
- Never edit the archive (/Users/charlesjinn/lastcall).
- Never loosen, skip or delete a test or a gate check. Never `.skip`, `.only` or `xit`.
- No dependency without a line in DEPENDENCIES.md (name, version, why). The gate checks this.
- No legal decisions. Legal questions go to OPEN-QUESTIONS.md.
- No copying a real app's logo, icons, exact palette, name or proprietary assets.
- Never `prisma migrate reset`. Forward migrations only.
- Never run two backend test processes at once.

## Review template
```
# Review: <slug>
Commit range: <first>..<last>

## Gate output (last 15 lines)
<paste>

## Done
- <task>: <file:line>, test "<test name>"

## Claims not proven
- <anything asserted but not backed by a test or a command output>

## Decisions
## Open questions
## Gaps
## Next task
```
