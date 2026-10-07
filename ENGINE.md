# Engineering workflow

This file describes the current repository workflow. The old one-task-per-commit `build` and `build-codex` session machinery is historical.

## 1. Orient

1. Read `README.md`, `AGENTS.md`, `CLAUDE.md`, `DESIGN.md`, and `HANDOFF.md`.
2. Read the scoped README/AGENTS/DECISIONS files for the area being changed.
3. Inspect the actual current code, package manifests, migrations, and tests relevant to the task.
4. Treat `reviews/`, `deliveries/`, `LEDGER.md`, AI logs, and superseded build prompts as historical evidence rather than current instructions.

## 2. Build

- Make the smallest change that satisfies the current request.
- Reuse existing modules and contracts rather than recreating older implementations.
- Keep geofence and privacy decisions on the server where they already belong.
- For the mobile photo flow, use the native camera and validated library path that already exists. Do not restore the old custom camera UI from historical docs.
- Follow the current Figma pages 9 and 10 when implementing visual work. Earlier Figma pages are reference history only.

## 3. Verify

Use focused tests during implementation. Run the relevant lane's normal validation before declaring code complete.

Mobile:

```bash
cd mobile
npm run check
```

Backend:

```bash
cd backend
pnpm typecheck
pnpm lint
pnpm test
```

Run shared/contract checks when a change crosses backend/mobile boundaries. Documentation-only changes should be reviewed for internal consistency; do not claim runtime validation that was not run.

## 4. Safety

- Never commit `.env` or secrets.
- Never use `prisma migrate reset` or `pnpm db:reset` on shared, preview, or production data.
- Schema changes use forward migrations.
- Do not delete or weaken safety/invariant tests merely to make a change pass.
- Do not run competing integration-test processes against the same database.
- Do not edit generated native iOS/Android projects when Expo Continuous Native Generation is being used.

## 5. Handoff

A current handoff should state what changed, what was verified, and what remains unverified. Avoid stale local paths, LAN IP addresses, running-process claims, old branch names, and old test counts.
