# AI log (backend)

One entry per build session. The reviewer should check claims against the commits, the gate output in `../LEDGER.md` and
the review files in `../reviews/`.

## Session 1: fork, strip, phases 1 to 6 (2026-10-02)

**Did:** forked the Last Call social layer; wrote the infrastructure (gate, ledgers, invariants suite, review bundles);
stripped live reports, consensus, accuracy, owners, claims, promos, comments, featuring, Regular badges, RSVP and presence,
the crowd map and block-by-content; added stamps, the chronological feed, nearby places, song search, the 21+ age gate,
report categories; rewrote the web legal pages; wrote the deterministic seed.

**Commits:** `baseline`, `infrastructure` (two), `strip + phases 1-3`, `phase 4`, then phase 6 (see `git log`).

**Gate:** green at every commit that touches code except the intermediate states folded into "strip + phases 1-3", which
was gated as a whole (backend 205, mobile 134 at that commit). See `../LEDGER.md`.

**Not done / skipped:** phase 5 (no "Chosen reference" in `../DESIGN.md`). Nothing has been run on a physical iPhone; the
device checklist is for that. No deployment was made.

**Surprises:** the build prompt referenced an "existing reportError hook" and a DESIGN.md "section 8"; neither existed.
The hook was created in the app (`mobile/src/lib/report-error.ts`) and DESIGN.md was written from the prompt's other
sections (logged in OPEN-QUESTIONS 4).

## Codex lane, phase 1
- Verified reviewer references moderation.ts:233,305 at current HEAD: personal-mode HTTP returned 200 in both staff regression cases before the fix.
- Social moderation services and web page now reject personal mode before reading legacy records; queue, hidden, log, decisions and direct flagging are covered. Records remain append-only.
- Baseline gate: backend 269, mobile 292. Postgres is isolated on 5438; test database allowlist accepts exact nostos_codex_test.

## Codex lane, phase 2
- Reproduced foreign edit returning 403 versus missing 404, in both personal and social modes.
- Shared ownership guard now returns the identical stamp-not-found response before hidden or content checks. HTTP regression exercises edit, remove, append, layout and photo removal for USER, MODERATOR and ADMIN. Existing unsafe 403 expectations now require 404.

## Codex lane, phase 3
- Three creation-only regression cases failed before implementation, including direct append after a parent update.
- Later append rejects before image processing/storage. Forward migration adds a database-forced immutable creation transaction and checks it on every photo insert. Six-photo limits, EXIF stripping, layout and final removal coverage remain. Demo seed now creates each photo set atomically with its parent.
- Contract comment changed; generated mobile contract is synchronized in this same commit. Merge should regenerate it with npm run sync:contracts.

## Codex lane, phase 4
- Regressions reproduce remove-all-photos then clear-caption/song, last-photo SQL removal and concurrent emptying.
- Editing and photo removal now lock the parent and check live stamp_photo rows inside one transaction. Deferred database constraint triggers check the final state at commit and serialize direct photo updates on the parent. Original storage_key never counts as live content. Caption whitespace matches JavaScript trim.
- Migration preserves records and refuses deployment if historical empty live stamps need explicit review. Test fixtures from red runs are finally removed before subsequent migrations.

## Codex lane, phase 5
- Expanded audit reproduced six failures: direct social services, admin endpoints/page, and removed-photo previews across place/activity/moderation. Pin replacement already returns identical 400 status/body/headers for inaccessible and missing stamp IDs.
- Guard all social/admin entry services and the admin web page. Foreign profile/passport services now 404 instead of returning a limited handle. Disabled-mode like summaries are zero. Strengthen invariant rule 11.
- Summary URLs now select live photographs in layout order. Codex dev script and example URLs use 3001/5438; optional pooler is 6439 and its script never targets the other lane. Pooled runtime remains untested.
- Repeatable-read probe reproduced an additional empty-stamp write skew: a caption transaction with an older snapshot committed after raw photo removal. A further forward migration advances the parent row version on photo updates; old snapshots now abort with Prisma P2034.

## Codex lane interim review
- Final implementation commit 4af3053; complete gate passed 291 backend / 292 mobile tests.
- Detailed report: ../reviews/2026-10-02T180902Z-codex-1.md. Contract-changing commit: 2723315 only; mobile must run npm run sync:contracts after merge.
- Gate locks were waited out naturally and never removed or bypassed. Database test processes were serialized. Only the generated mobile contract was changed.

## Codex lane, phase 6
- Final database audit reproduced a live stamp with a tab/newline-only song title through a direct write. Service song validation already trims and rejects empty text.
- A forward CHECK now requires actual text in both live song fields using the same whitespace set as JavaScript trim; already removed historical records are preserved. Regression: stamp-content.test.ts, "the database rejects whitespace-only song titles and artists on live stamps".

## Codex lane final review
- Implementation through 74ea16e; final complete gate passed 292 backend / 292 mobile tests.
- Report: ../reviews/2026-10-02T180902Z-codex-1.md. Only 2723315 changed the contract. Regenerate the generated mobile copy after merge; preserve both lane ledger append sets.
