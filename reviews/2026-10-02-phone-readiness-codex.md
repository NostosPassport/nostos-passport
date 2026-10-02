# Codex phone readiness session — 2026-10-02

- Worktree `/Users/charlesjinn/nostos-codex`, branch `build-codex`, HEAD `42a6c0da577d0a95072ba00617208bfd0c1e338d`. Pending combined work remains uncommitted; no push.
- Read-only counts on isolated `nostos_codex` returned zero app_user, pinned_stamp and venue rows before seeding. Ran `backend` `pnpm db:seed` once: 31 places, 17 people, 87 stamps, 243 likes, 22 follows, 6 pending requests. No populated database was reset; only Postgres 5438 was used.
- Started `pnpm dev` on 3001 and Expo Go LAN Metro on 8082 with `EXPO_PUBLIC_API_URL=http://10.19.108.26:3001`.
- Actual HTTP smoke results: LAN `/api/health` 200, `ok:true`, `db:up`; iOS demo login 200, handle maya_r; Expo iOS manifest 200, SDK 57.0.0; iOS Hermes development bundle 200, 14,976,193 bytes.
- Runtime references: `backend/src/app/api/health/route.ts`, `backend/src/app/api/auth/login/route.ts:8`, `backend/src/app/api/auth/client.ts:4`, `backend/prisma/seed.ts:39` (destructive seed behavior), `mobile/src/api/index.ts` (API URL override).
- No source/contract changes for runtime setup. Prior focused book tests 44 passed and full combined gate backend 292/mobile 413 passed; not repeated because this request changed runtime setup/documentation only. Copied bundles retain that recorded gate evidence.
- Remaining gap: no physical iPhone camera, location, Skia/animation, book interaction or end-to-end device result yet. Follow HOW-TO-OPEN.md and REAL-PHONE-CHECKLIST.md. SDK compatibility and LAN reachability must be confirmed on the user's iPhone.
- Found but not fixed: none newly investigated. Prior report remains authoritative for earlier gaps. No audits, migrations, dependency upgrades or lock bypasses performed.
