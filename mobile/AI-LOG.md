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
