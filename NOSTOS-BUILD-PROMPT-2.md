# Nostos build prompt 2 (session 2)

Supersedes the "Review of session 1" fix list and the instruction not to do the visual design pass. Checkboxes are hints; git and tests are the truth. One task, one commit, message "phase N: <what>". Never push. Stop only if truly blocked (then OPEN-QUESTIONS.md).

## A. What changed
Nostos is STRICTLY PERSONAL for this version. No feed, no likes, no follows, no sharing. Your passport is visible only to you. The look is BLACK and BRASS GOLD only. The product is a LITERAL PASSPORT BOOK you open and flip through, with stamps appearing on the pages. Every visual decision stays behind the theme and component layer so screens can be swapped for imported ones.

## B. Verify first
- [x] B.1 Show `git -C ~/lastcall log --oneline | head -5` and whether b67381c is in it (answer in the review file: it is NOT; the object does not exist in the archive).
- [x] B.2 gate.sh and ENGINE.md check free disk on /System/Volumes/Data, 5 GB minimum.

## C. Rescope
- [x] C.1 SOCIAL_ENABLED flag (backend env, mobile config), default false. Off: every social route (feed, follows, follow requests, likes, activity, blocks, people search, other users' profiles and stamps) 404s; mobile hides those tabs and screens; every passport visible only to its owner. Keep code and tests; run the social tests with the flag on, add tests with it off.
- [x] C.2 Invariants tests: flag off, no endpoint returns another user's stamps, places, handle or counts to anyone but the owner.
- [ ] C.3 Mobile tabs: exactly Passport (home), Stamp (large center button), Map. Settings gear on Passport. No feed, no bell.

## D. Data features
- [ ] D.1 Multi-photo stamps: up to 6 photos, in-app camera only. stamp_photo table (stamp id, storage key, position, optional x, y, rotation). EXIF/GPS stripped. Same immutability and hidden-never-deleted. Contract, API.md, tests (limit, ordering, strip, layout persistence, visibility).
- [ ] D.2 Place pages (backend): your own stamps at a place (stack across nights) plus a flag for being inside the geofence now.
- [ ] D.3 Collections: neighborhoods table with boundaries (public NYC data or OSM, log choice in DECISIONS.md), progress per neighborhood, index endpoint, completion marker. Broaden the importer beyond bars and log it.
- [ ] D.4 Pinned stamps: up to 4, owner only.
- [ ] D.5 Oldest first ordering; stamp response includes page and slot from one shared layout function.

## E. Theme system
- [ ] E.1 One theme "Midnight" in mobile/src/theme: black #000000, surfaces #0B0B0D #141418, brass #C9A24B, dim brass #8F7434, brass glow, bone #E8E4DC #A09C94 #6B6862, type scale, radii, spacing, shadows, motion durations and springs, stamp styles. No other hues, not even errors. Nothing white in chrome.
- [ ] E.2 Lint rule or test failing on color literals outside the theme file and on white; wired into the gate.
- [ ] E.3 Settings: quiet "Customize, coming soon" row with a lock, opening a teaser sheet.

## F. The passport book UI (Expo Go compatible only; DEPENDENCIES.md line each; log anything that cannot run in DECISIONS.md)
- [ ] F.1 Cover (Skia leather grain, brass foil wordmark and original emblem, drag/tilt highlight, border, vignette, shadow, three numbers, gear)
- [ ] F.2 Open animation (3D swing, hinge left, inner-edge shading)
- [ ] F.3 Bearer page
- [ ] F.4 Pages (two-page spreads, gutter, page edges, numbers, ribbon, guilloche, 3 slots per page, seeded jitter, pinned ribbons)
- [ ] F.5 Page flip (drag from edge, tap edges, rotateY hinge with live shading, springs, hold halfway, reduced motion crossfade)
- [ ] F.6 Stamps (Skia/SVG brass ink, deterministic design from place id, border from neighborhood, pure function with tests, completed-neighborhood foil stamp)
- [ ] F.7 Stamp landing (slam, ink spread, glow, shake, haptic, photos pin, "Added to page N", progress)
- [ ] F.8 Visa spread (stamp left, scrapbook right up to 6 photos, drag rearrange persisted, full screen pinch zoom, caption typewriter, date, place, song ticket stub, menu)
- [ ] F.9 Index (neighborhood progress rings, jump to pages)
- [ ] F.10 Stamp flow (where are you list, km at 1000 m+, honesty banner, calm disabled state, compose, landing)
- [ ] F.11 Map (dark, glowing brass pins, dim pins, bottom sheet, custom markers)
- [ ] F.12 Place page, settings, welcome, sign up (age gate), under-21 screen, first run, delete-account and legal restyled
- [ ] F.13 Dev-only Design gallery

## G. Tests and honesty
- [ ] G.1 Unit-test logic: layout, deterministic stamp design, ordering and page numbers, photo slots, theme lint, geofence states, distance formatting, multi-photo rules.
- [ ] G.2 Say visuals are untested in the review; list every effect; add each to DEVICE-CHECKLIST.md.

## H. Docs and handoff
- [ ] H.1 DESIGN.md fully written incl. "Swappable screens".
- [ ] H.2 HANDOFF.md, both REVIEW.md, DECISIONS.md, OPEN-QUESTIONS.md, gate, bundles, session review with file:line and test names; tell the user how to open the Design gallery.
