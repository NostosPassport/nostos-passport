# Deploying Nostos

**Status: not deployed.** There is no git remote, no Vercel project, no Neon database and no R2 bucket for Nostos, and
nothing here creates one for you. This is the plan, written so each step is a command or a value to paste. Legal and
policy questions are in `../OPEN-QUESTIONS.md`.

| Environment | App | Database | Photos | Data |
|---|---|---|---|---|
| development | `pnpm dev` | Docker Postgres :5435 | local disk (`uploads/`) | demo seed |
| preview | Vercel, `preview` branch | Neon branch `preview` | R2 `nostos-photos-preview` | demo seed + `@appreview` |
| production | Vercel, `main` branch | Neon branch `main` | R2 `nostos-photos-prod` | imported places, no fake data |

## 1. Accounts and resources

Vercel (the **Root Directory is `backend/`**), Neon (Postgres 16; a pooled URL for `DATABASE_URL` with
`&pgbouncer=true&connect_timeout=15`, a direct URL for `DIRECT_URL`), and Cloudflare R2 (two private buckets, one
read/write API token scoped to them).

## 2. Environment variables (Vercel)

| Variable | Value |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Neon pooled and direct URLs for that branch |
| `APP_ENV` | `production` or `preview` |
| `STORAGE_DRIVER` | `r2` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | from Cloudflare |
| `CRON_SECRET` | random, 32+ characters (`openssl rand -base64 32`) |
| `UPLOAD_URL_SECRET` | random, 32+ characters |

Turn off Vercel Authentication for the preview branch, or the app gets a login wall instead of the API.

## 3. Deploy

Every build runs `prisma migrate deploy` over `DIRECT_URL` before `next build` (`pnpm vercel-build`). The one cron
(`vercel.json`) runs `/api/cron/maintenance` daily at 09:00 UTC: it prunes day-old login attempts and rate-limit rows. It
needs only the Hobby plan. Smoke test: `curl -s https://<host>/api/health` returns `{"ok":true,"db":"up",...}`.

## 4. Production data

No fake data. Import real places from OpenStreetMap (idempotent; re-run any time):

```bash
DATABASE_URL='<pooled>' DIRECT_URL='<direct>' APP_ENV=production pnpm venues:import --dry-run
DATABASE_URL='<pooled>' DIRECT_URL='<direct>' APP_ENV=production pnpm venues:import
```

The demo seed refuses to run against production. The first admin signs up normally, then:
`DATABASE_URL='<pooled>' DIRECT_URL='<direct>' pnpm user:role you@example.com ADMIN`.

## 5. Preview data and the App Review account

```bash
DATABASE_URL='<preview pooled>' DIRECT_URL='<preview direct>' APP_ENV=preview STORAGE_DRIVER=r2 R2_ACCOUNT_ID='<id>' \
R2_ACCESS_KEY_ID='<key>' R2_SECRET_ACCESS_KEY='<secret>' R2_BUCKET=nostos-photos-preview \
DEV_SEED_PASSWORD='<16+ chars>' APP_REVIEW_PASSWORD='<12+ chars>' pnpm db:seed
```

This creates places, 17 demo accounts and the geofence-exempt `appreview@lastcall.dev`. The review account can stamp from
anywhere, and only it can see those stamps. Re-run before a review submission so the feed looks recent.

## 6. Point the app at it

`../mobile/eas.json` sets `EXPO_PUBLIC_API_URL` for the `preview` and `production` profiles (placeholders:
`https://preview.nostos.app` and `https://nostos.app`). App Store Connect needs `/privacy`, `/terms`, `/support` and
`/delete-account` on that host. The policy pages are drafts from Last Call and need a rewrite and a lawyer.

## 7. Ongoing

Commit migrations (forward only, never `migrate reset` outside development). Neon keeps point-in-time restore; raise the
retention before launch. Rotate `CRON_SECRET` or the R2 keys in Vercel and redeploy.
