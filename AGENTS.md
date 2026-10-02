Read CLAUDE.md, ENGINE.md, NOSTOS-BUILD-PROMPT.md, NOSTOS-BUILD-PROMPT-2.md and reviews/2026-10-02-reviewer-1.md first, and follow the lane split.

Codex lane: work on build-codex in /Users/charlesjinn/nostos-codex. On 2026-10-02 the user authorized importing Claude's committed build branch and finishing both backend and mobile here. Never check out build, edit the other checkout, touch the archive, or push. The user requested leaving the combined merge and all new work uncommitted until further authorization. Use compose project nostos-codex, Postgres 5438, nostos_codex and nostos_codex_test, and backend port 3001.

Future verification workflow: targeted tests during individual fixes, then one full gate after combined changes. Repeat the gate only after a failure or a later change that affects its result. This explicit user instruction supersedes the per-task gate cadence in ENGINE.md. Leave the merge and changes uncommitted until the user authorizes committing.

Delivery preference: every handoff should include one clearly linked folder under deliveries/<session-name>/ containing copies of HANDOFF.md, the session report as SESSION-REPORT.md, and both review bundles, plus a short README.md. Keep canonical files in their usual locations as well.
