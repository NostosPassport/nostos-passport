# Review: Codex combined Nostos continuation

Commit state: HEAD `42a6c0da577d0a95072ba00617208bfd0c1e338d` on `build-codex`; incoming merge `e639860138f2059ff26906145606074f02e14b3f` from Claude's `build` branch. **The merge, fixes and reports are uncommitted by explicit user request.** No new commit range exists for this session. Working directory: `/Users/charlesjinn/nostos-codex`.

## Gate output (last 15 lines)

```text
   Start at  14:56:56
   Duration  54.53s (transform 380ms, setup 302ms, collect 2.81s, tests 47.23s, environment 2ms, prepare 985ms)

== gate: mobile check
PASS iOS eslint-rules/__tests__/rules.test.js (6.6 s)

Test Suites: 51 passed, 51 total
Tests:       407 passed, 407 total
Snapshots:   0 total
Time:        6.98 s, estimated 7 s
== gate: contract sync
== gate: invariants suite
== gate: dependency ledger
dependency ledger ok (69 lines)
GATE OK: backend 292 tests, mobile 407 tests
```

## Done

- Imported Claude's completed F.8-F.13, G.1/G.2 and H.1 work rather than rebuilding it. Existing backend fixes remain in the combined tree. Both lanes' LEDGER entries and open questions were retained; the original untracked reviewer report matched the incoming committed bytes and was preserved before import. Code and tests were inspected before fixes.
- Passport opening helper: `mobile/src/features/book/book-state.ts:20`; test `mobile/src/features/book/__tests__/worklet-transform.test.js:8`, **"serializes stageTransform with the installed Worklets plugin and runs its UI-thread code"**. Before the fix the Babel output contained no worklet marker; the regression failed with `__workletHash` undefined. The function directive now produces serialized code that independently executes at closed, midpoint and open states. Targeted worklet/math tests: 10 passed.
- Development backend connection: `mobile/src/api/base-url.ts:7`; test `mobile/src/api/__tests__/base-url.test.ts:6`, **"connects to the backend dev server configured for this lane, including localhost fallback"**. The regression reproduced client port 3000 against the backend's configured 3001. Both LAN and localhost now use 3001; explicit API URL overrides and release requirements are retained. Targeted tests: 7 passed.
- New York age boundary: `mobile/src/lib/age.ts:40`; test `mobile/src/lib/__tests__/age-timezones.test.js:30`, **"%s agrees with the backend in summer and winter"**. Separate Node processes test UTC, New York, Tokyo and Honolulu across summer and winter midnight boundaries. Before the fix three device zones failed; all four now pass, and refused results contain no API birthdate. Existing age/signup-screen tests plus regression: 25 passed. Backend reference: `backend/src/lib/age.ts:28`, `todayInNewYork`.
- Song picker state coverage: `mobile/src/features/stamps/__tests__/screens.test.tsx:161`, **"starts with a typing prompt and can clear the selected song"**, **"debounces typing and shows a searching state without results or an empty message"**, **"shows search results and hands the selected metadata back to the composer"**, **"shows the searched text when there are no results"**, and **"shows upstream failure, retries the search and displays recovered results"**. The original multi-state title covered only idle; these now exercise the native search-bar callback, debounce, selected metadata, empty results, refetch and recovery. Loading accessibility is fixed at `mobile/src/components/ui/skeleton.tsx:25`, proven by the loading-role assertion. Targeted feed/detail/song suite: 12 passed.
- Final documentation/checklist: `HANDOFF.md:1`, `NOSTOS-BUILD-PROMPT-2.md` H.2, both REVIEW.md files, both AI-LOG.md files, mobile DECISIONS.md, DEVICE-CHECKLIST.md and README.md updated for the combined uncommitted checkout. Tests/check outputs below provide the implementation evidence; documentation is not native-device evidence.
- Review bundle coverage: `mobile/scripts/make-review-bundle.mjs:39` now includes `src/lib`, which was omitted despite the every-test requirement, plus Babel/Jest runtime context. Both generators label dirty snapshots as **UNCOMMITTED WORKING TREE**, so HEAD cannot be mistaken for the new implementation. Bundle regeneration and inclusion verification are recorded below.

## Claude work reused, with existing proof

| Feature | Existing implementation | Existing test |
|---|---|---|
| Visa spread and photo layout | `mobile/src/features/book/VisaSpread.tsx:28` | `visa.test.tsx`, "saves the layout when the owner drops a photo: the dragged one on top, where it was left" |
| Index jump | `mobile/src/features/book/IndexList.tsx:12` | `index.test.tsx`, "opens from the book, jumps to a neighborhood's first page, and the book is on that spread" |
| Camera-only six-photo flow | `mobile/src/app/(app)/stamp/camera.tsx:20` | `stamp-screens.test.tsx`, "takes a photo into the stamp, counts them, and stops at six" and "has no way to pick a photo from the library" |
| Map sheet and composer navigation | `mobile/src/features/map/MapScreen.tsx:21` | `map.test.tsx`, "opens the sheet for a pin, offers Stamp here when you are inside, and goes to the composer" |
| Settings/profile entry | `mobile/src/app/(app)/settings/index.tsx:21` | `settings-welcome.test.tsx`, "has Edit profile (the only way in now that the passport tab is the book) and says only you can see your passport" |
| Development-only gallery | `mobile/src/app/design/index.tsx:11` | `gallery.test.tsx`, "is development only: with __DEV__ off it shows nothing and sends you home" |

The above are code/render/logic assertions; visual appearance and real native interactions remain unverified.

## Actual checks

| Check | Result |
|---|---|
| Required checkout/branch checks | `/Users/charlesjinn/nostos-codex`, `build-codex`; Claude source e639860 |
| Disk before work | /System/Volumes/Data: 132 GiB available; no install required |
| Original Codex baseline gate | PASS, backend 292 / mobile 292 |
| Combined baseline gate | PASS, backend 292 / mobile 397 |
| First worklet gate | FAIL mobile lint: new JavaScript test lacked Jest/global declarations; fixed declarations, no production lint rule changed |
| Corrected worklet gate | PASS, backend 292 / mobile 398 |
| API-port gate | PASS, backend 292 / mobile 399 |
| Age gate | PASS, backend 292 / mobile 403 |
| Song/loading gate | PASS, backend 292 / mobile 407 |
| Final H.2 gate after bundle-tool updates | PASS, backend 292 / mobile 407 |
| Backend review bundle | Generated successfully: 170 files, 731 KiB; fresh summary 292 passed |
| Mobile review bundle | Generated successfully: 222 files, 792019 characters before final report synchronization; fresh summary 407 passed |
| Bundle artifact verification | Both identify an uncommitted snapshot, contain this report and every backend/mobile test file; no failed command in the fresh summaries |
| Backend production build | `cd backend && pnpm build`: exit 0, Next.js 15.5.26 optimized build, routes generated |
| Final iOS export | `CI=1 EXPO_NO_TELEMETRY=1 npx expo export --platform ios --output-dir /tmp/nostos-codex-ios-export-final`: exit 0, Hermes entry-45e679de908c803b3696f368dc8c47cc.hbc, metadata.json |

The first song-coverage run had two failures: a genuinely inaccessible loading View and an incorrect fixture expecting raw 503 text. The View is now accessible; the error assertion follows `errorText`'s existing 5xx fallback and uses the actual song_search_unavailable code. The green run retains error, retry and recovered-result assertions.

All database test processes were serialized. Only Postgres 5438, databases nostos_codex/nostos_codex_test and compose project nostos-codex were used. No other lane database, reset, new migration, archive, push, branch checkout or native build/install was performed. Existing locks were allowed to clear naturally; none was deleted or bypassed.

## Contract merge instructions

No contract change in this continuation. Prior Codex commit **2723315** changed backend/src/contracts/api.ts and synchronized mobile/src/api/contracts.ts in the same commit. The combined contract-sync gate passes. Mobile must run `npm run sync:contracts` after future merges; regenerate the generated copy rather than resolving conflicts manually.

## Claims not proven / remaining gaps

- No physical iPhone/Expo Go run. Native UI-thread execution of the complete passport, rendering, camera, geolocation permissions, haptics, map gestures, VoiceOver, Reduce Motion and performance still need DEVICE-CHECKLIST verification. The independent serialization test and Hermes export do not prove those effects.
- No live mobile-client/backend HTTP suite, production deployment or EAS build/submission was run. Production builds and automated service/route tests passed; those are the limits of the evidence.
- Historical-invalid-data migration preflight and optional pooler remain unverified from the prior backend session. No new migration was attempted.
- Legal questions L1-L7 remain for the user/lawyer. No legal text or legal decision was made; L6/L7 from Claude were preserved under the legal table.

## found but not fixed

No additional confirmed blocking defect remains from the focused checks above. Previously issued signed-photo URL revocation remains an unverified concern from the earlier review; no speculative audit was started. Device/runtime and live-HTTP gaps above remain explicitly unverified.

## Decisions / open questions

Future workflow, per the final user instruction: use targeted tests while fixing individual issues, run the full gate once after combined changes, and repeat only for a failure or a later change that affects the result. No further audit or check rerun was started after that instruction.

The user lifted the mobile lane restriction, authorized importing Claude's committed work into build-codex and then explicitly requested no commits. AGENTS.md reflects this authorization. HANDOFF.md and README.md describe isolated port-3001 setup, with Metro on 8082. Open the Design gallery from Welcome or Settings in development, or `exp://<Mac address>:8082/--/design`. Existing legal/data-disposition questions remain in OPEN-QUESTIONS.md, with Codex-specific notes under "Codex lane".

## Next task

Physical iPhone verification using DEVICE-CHECKLIST.md and review of this uncommitted combined tree. Do not commit or push without further user authorization.
