# Nostos

A live nightlife map for bars and clubs in the East Village and Lower East Side, like Waze for going out.

The core rule is **checks and balances**:

- **Venues own the facts.** Hours, official cover, dress code, promos, and one official photo labelled "From the venue". Venues can reply to comments.
- **People own the reality.** Live photos, line/vibe/cover reports, comments, "going tonight", and "here now".
- **Neither side can overwrite the other.** When they disagree, both are shown side by side ("Venue says $10 · Users say $20 · 12 reports, 29 min ago").
- **Paying never buys control.** Paid promos are always labelled "Promoted" and never change how people's reports, photos, or comments are ranked or shown.

## Run it

Prerequisites: Node ≥ 20.11, pnpm ≥ 10, and Docker (Docker Desktop, or Colima: `colima start`).
Run everything from this folder (`backend/` in the repo; the iOS app is in `../mobile/`).

```bash
cd backend && pnpm install && docker compose up -d && pnpm db:reset && pnpm dev
```

Then open http://localhost:3000.

- `pnpm install` creates `.env` from `.env.example` if it's missing, and generates the Prisma client.
- `docker compose up -d` starts Postgres 16 on **localhost:5435**.
- `pnpm db:reset` applies migrations, including hand-written triggers, and runs the deterministic seed.
- The dev server also runs the reputation job every 10 minutes. Set `DISABLE_JOBS=1` to turn that off.

### Sign in

Go to **http://localhost:3000/dev/login** (development only). It lists every seeded account, and they all share the password `lastcall-dev`. Good ones to start with:

| Account | What to look at |
|---|---|
| `@avaa` | A regular user with a dozen mutual friends out tonight. Look for friend badges on the map. |
| `@owner_velvet` | Owner of The Velvet Anchor. Open **Venue → dashboard**: read-only live stats, the mismatch nudge, a 0% accuracy score, editing official info, promos, replying, flagging. |
| `@owner_neon` | Owner of Neon Oyster, which has a paid promo while live reports say dead. |
| `@mod_morgan` | Moderator. Open **Mod**: an auto-hidden photo, a 2-flag photo, and an owner-flagged comment. |
| `@admin` | Admin: a pending venue claim (`@moth_hopeful` → The Moth Room) and the promo "paid" toggle. |
| `@partyhard99` | The troll. Reputation ≈ 0.22, so its contrarian reports barely count. |

### Reporting on a laptop: the dev location simulator

Every report must come from within 100 m of the venue, and the server checks this from the submitted coordinates. In development only:

- On the map, tap **📍 Dev: set location**, then tap anywhere on the map. Your fake location shows as a yellow dot.
- On a venue page, tap **Dev: put my fake location at …**.

The fake location is stored in `localStorage` and cleared with **Clear fake location**. The simulator is stripped from production builds, and `/dev/*` returns 404 outside `NODE_ENV=development`.

### Seeded scenarios

- **The Velvet Anchor**: the official cover is $10 but people consistently pay $20. It shows a cover mismatch callout and a 0% accuracy score over 30+ qualifying hours.
- **Neon Oyster**: a paid "2-for-1 cocktails" promo (labelled Promoted) while live consensus says **Dead**, **Free**, no line.
- **@partyhard99**: a troll that contradicts the crowd. The reputation job has pushed it to about 0.22.
- **Moderation queue**: a photo auto-hidden by 3 user flags, a photo with 2 flags (still visible), a comment the venue owner flagged as "False" (still visible), and a troll comment.
- **No data vs dead**: Saint Marigold, Essex Ember, and Grand & Ghost have no reports (hollow "?" pins). Copper Fox is dead (solid slate pin). Parlor Nine has only 1 report, which is not enough data. Clinton Cellar shows "Not enough data yet" for accuracy.

The seed is deterministic (fixed-seed PRNG, explicit ids). Timestamps are relative to "now" so the data is live whenever you run it. Pin the clock with `SEED_NOW=2026-09-26T03:30:00Z pnpm db:seed`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js dev / production build / production server |
| `pnpm db:reset` | Drop, migrate, and seed the dev database |
| `pnpm db:seed` | Re-seed without migrating (truncates first) |
| `pnpm db:migrate` | Create/apply a new migration in development |
| `pnpm job:reputation` | Run the reputation job once |
| `pnpm typecheck` / `pnpm lint` | `tsc --noEmit` (strict) / ESLint (next/core-web-vitals + typescript) |
| `pnpm test` | All tests: unit + DB-backed integration |
| `pnpm test:unit` / `pnpm test:int` | Just one project |
| `pnpm bundle` | Regenerate `REVIEW-BUNDLE.txt` (runs the tests for the summary) |

Integration tests use a separate database, `nostos_test`, in the same container. The harness creates it on first run, applies migrations, and truncates tables before each test. It refuses to run against any database whose name doesn't contain `nostos_test`.

## Layout

```
prisma/                    schema, migrations (incl. hand-written triggers), deterministic seed
src/lib/consensus/         pure consensus engine (decay, reputation weights, weighted mode/median, verdicts)
src/lib/accuracy/          pure venue accuracy score
src/lib/time.ts            "tonight" in America/New_York (5:00am–4:59am), DST-safe
src/server/permissions.ts  every service-layer permission check
src/server/services/       business logic: reports, photos, comments, social, owner, admin, moderation, reputation
src/app/api/               thin route handlers (same-origin check → service → JSON)
src/app/                   pages: map, venue, profile, people, owner dashboard, mod, admin, dev login
tests/unit, tests/integration
```

Other docs: [DECISIONS.md](DECISIONS.md) (judgment calls), [AI-LOG.md](AI-LOG.md) (per-phase build log), [REVIEW.md](REVIEW.md) (how each invariant is enforced and tested).
