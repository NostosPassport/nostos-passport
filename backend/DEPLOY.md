# Deploying Nostos

**Status: not deployed.** No Vercel CLI or login, no Cloudflare/R2 credentials, and no git remote exist on this
machine. A Neon CLI credential file does exist, but creating cloud resources on your account needs your go-ahead.
All code work is done. Follow these steps in order. Each is a command to run or a value to paste.

There are three environments:

| Environment | App | Database | Photos | Data |
|---|---|---|---|---|
| development | `pnpm dev` on your Mac | Docker Postgres :5434 | local disk (`uploads/`) | demo seed |
| **preview** | Vercel, `preview` git branch | Neon branch `preview` | R2 bucket `nostos-photos-preview` | demo seed + `@appreview` (App Review, TestFlight) |
| **production** | Vercel, `main` branch | Neon branch `main` | R2 bucket `nostos-photos-prod` | real OSM venues, no fake data |

---

## 1. Accounts (once)

1. **GitHub**: the repo is `https://github.com/CharlesJ0906/nostos`. It holds two folders: this backend in
   `backend/` and the iOS app in `mobile/`.
2. **Vercel**: sign up and choose the **Pro** plan. Hobby only runs crons once a day, and the reputation job needs every 10 minutes.
3. **Neon**: sign up at neon.tech.
4. **Cloudflare**: sign up and enable **R2** (Dashboard → R2; needs a payment method on file; the free tier covers this app).

## 2. Push the code

`main` is already on GitHub. Create the `preview` branch (it deploys the preview environment):

```bash
cd ~/nostos && git branch preview main && git push -u origin preview
```

## 3. Neon (database)

1. Create a project named **nostos** (Postgres 16, region `us-east-1`/`aws-us-east-2`, close to Vercel's `iad1`).
   Its default branch is **`main`** (production).
2. Create a branch named **`preview`** from `main` right away, while `main` is still empty.
3. For **each** branch, open **Connect**, then copy two connection strings:
   - **Pooled** (host contains `-pooler`): becomes `DATABASE_URL`. Append `&pgbouncer=true&connect_timeout=15`
     (keep Neon's `?sslmode=require`).
     Example: `postgresql://USER:PASS@ep-xyz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15`
   - **Direct** (no `-pooler`): becomes `DIRECT_URL`. Example: `postgresql://USER:PASS@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require`

The app's locks are transaction-scoped and were verified through PgBouncer in transaction mode (`pnpm test:pooled`), which is Neon's pooler mode.

## 4. Cloudflare R2 (photos)

1. R2 → **Create bucket** `nostos-photos-prod`, then `nostos-photos-preview`. Leave **public access off**. The API hands out signed URLs.
2. R2 → **Manage R2 API Tokens** → **Create API token**: permission **Object Read & Write**, applied to those two buckets only.
   Copy the **Access Key ID** and **Secret Access Key** (shown once).
3. Copy your **Account ID** from the R2 overview page (right sidebar).

## 5. Vercel project

1. Vercel → **Add New… → Project** → import the GitHub repo. **Set Root Directory to `backend/`** (the repo also
   holds the iOS app in `mobile/`). Framework: **Next.js**. Build settings come from `backend/vercel.json`
   (`pnpm vercel-build`, which runs `prisma migrate deploy` before building). Node.js **22.x**.
   Optional: Settings → Git → Ignored Build Step `git diff HEAD^ HEAD --quiet -- .` so mobile-only commits don't redeploy.
2. **Settings → Environment Variables**. Add these. "Preview" means the **Preview** environment scoped to git branch `preview`.

| Variable | Production | Preview (branch `preview`) | Where it comes from |
|---|---|---|---|
| `DATABASE_URL` | Neon `main` pooled URL | Neon `preview` pooled URL | Step 3 |
| `DIRECT_URL` | Neon `main` direct URL | Neon `preview` direct URL | Step 3 |
| `APP_ENV` | `production` | `preview` | literal |
| `STORAGE_DRIVER` | `r2` | `r2` | literal |
| `R2_ACCOUNT_ID` | account id | same | Step 4.3 |
| `R2_ACCESS_KEY_ID` | key id | same | Step 4.2 |
| `R2_SECRET_ACCESS_KEY` | secret | same | Step 4.2 |
| `R2_BUCKET` | `nostos-photos-prod` | `nostos-photos-preview` | Step 4.1 |
| `CRON_SECRET` | random, 32+ chars | a different random value | `openssl rand -base64 32` |
| `UPLOAD_URL_SECRET` | random, 32+ chars | random, 32+ chars | `openssl rand -base64 32` (only used by the local driver, but required when `NODE_ENV=production`) |

3. **Settings → Deployment Protection**: Vercel protects Preview deployments with Vercel Authentication by default.
   **Turn it off for the `preview` branch** (or set Protection to "Only Production Deployments… none"). Otherwise the iOS app
   and App Review get a login wall instead of the API.
4. **Settings → Domains**: add your production domain (e.g. `nostos.app`), and a stable domain for the preview branch
   (e.g. `preview.nostos.app`, assigned to git branch `preview`). The iOS preview build points at this.
5. Deploy: push to `main` and to `preview` (or use **Redeploy** for each). The first build runs every migration on each branch's database.

Smoke test both:

```bash
curl -s https://nostos.app/api/health
```

```bash
curl -s https://preview.nostos.app/api/health
```

Each should return `{"ok":true,"db":"up",...}`.

## 6. Production data: real venues (no fake data)

Run from `backend/` on your Mac (`cd ~/nostos/backend`) with the **production** connection strings. Preview first, then import:

```bash
DATABASE_URL='<main pooled URL>' DIRECT_URL='<main direct URL>' APP_ENV=production pnpm venues:import --dry-run
```

```bash
DATABASE_URL='<main pooled URL>' DIRECT_URL='<main direct URL>' APP_ENV=production pnpm venues:import
```

This imports about 235 East Village and Lower East Side bars, pubs, and nightclubs from OpenStreetMap. It's idempotent, so re-run it any time to pick up OSM
changes. If Overpass is busy it fails cleanly: wait a minute and retry, or set `OVERPASS_URL=https://overpass.kumi.systems/api/interpreter`.
The demo seed **refuses** to run against production (`APP_ENV=production`, `VERCEL_ENV=production`, or any remote DB without an explicit `APP_ENV`).

**First admin.** Sign up on the production site (or in the app) with your own email, then:

```bash
DATABASE_URL='<main pooled URL>' DIRECT_URL='<main direct URL>' pnpm user:role you@example.com ADMIN
```

Use the same command with `MODERATOR` for moderators. Venue owners are approved through claims at `/admin`.

## 7. Preview data: demo seed + App Review account

Pick two passwords: one shared by all demo accounts, and one for App Review. The seed refuses weak or default ones on preview.

```bash
DATABASE_URL='<preview pooled URL>' DIRECT_URL='<preview direct URL>' APP_ENV=preview STORAGE_DRIVER=r2 R2_ACCOUNT_ID='<id>' R2_ACCESS_KEY_ID='<key>' R2_SECRET_ACCESS_KEY='<secret>' R2_BUCKET=nostos-photos-preview DEV_SEED_PASSWORD='<16+ char demo password>' APP_REVIEW_PASSWORD='<12+ char review password>' pnpm db:seed
```

This creates the demo venues, 61 accounts (including `admin@lastcall.dev`, `mod_morgan@lastcall.dev`, and `owner_velvet@lastcall.dev`), and the
**geofence-exempt App Review account `appreview@lastcall.dev`** with `APP_REVIEW_PASSWORD`. Put those credentials in App Store
Connect → App Review Information. The review account can post from anywhere, and nothing it posts is counted.

The demo data is anchored to the time you run the seed ("tonight" = the 3 hours before). Re-run it before a review
submission so the map looks live.

**Reputation on preview.** Vercel runs crons only on production deployments. The seed computes reputation itself. To recompute later:

```bash
curl -s -X POST -H "Authorization: Bearer <preview CRON_SECRET>" https://preview.nostos.app/api/cron/reputation
```

**Nightly featuring (cron-job.org).** Vercel Cron runs on UTC and can't follow New York's daylight saving time, so the
featuring job runs from [cron-job.org](https://cron-job.org) instead (free):

1. Create a job: URL `https://nostos.app/api/cron/featured`, method **POST**.
2. Schedule: every day at **05:05**, time zone **America/New_York**.
3. Advanced → Headers: `Authorization: Bearer <production CRON_SECRET>`.
4. Save, then **Test run**: the response is `{"ok":true,"nights":[...],"featured":N,"skipped":false,...}`.

Add a second job for preview (`https://preview.nostos.app/api/cron/featured` with the preview secret) if you want
galleries there. The job processes every completed night of the last 7 that it hasn't processed yet, so a late run,
a missed day or a double run is safe. To run it by hand:

```bash
curl -s -X POST -H "Authorization: Bearer <CRON_SECRET>" https://nostos.app/api/cron/featured
```

## 8. Point the iOS app at it

In `mobile/`, `eas.json` sets `EXPO_PUBLIC_API_URL`: `https://preview.nostos.app` for the `preview`
profile (TestFlight) and `https://nostos.app` for `production`. Update them if your domains differ.

App Store Connect URLs:
- Privacy Policy: `https://nostos.app/privacy`
- Terms (EULA): `https://nostos.app/terms`
- Support: `https://nostos.app/support`
- Account deletion (web): `https://nostos.app/delete-account`

Before launch, replace `support@REPLACE-ME` in `src/components/legal/LegalPage.tsx` with a real inbox and have a lawyer
review the four policy pages (each is marked DRAFT at the top of its source file).

## 9. Ongoing

- **Migrations**: commit them. Every deploy runs `prisma migrate deploy` over `DIRECT_URL` before building.
- **Cron**: `vercel.json` runs `/api/cron/reputation` every 10 minutes on production. It also prunes stale login attempts, expired check-ins and day-old rate-limit rows. cron-job.org runs `/api/cron/featured` at 5:05am New York (see step 7).
- **Backups**: Neon keeps point-in-time restore (7 days on the free tier). Upgrade the retention before real launch.
- **Rotating secrets**: change `CRON_SECRET` or the R2 keys in Vercel and redeploy. Rotating `UPLOAD_URL_SECRET` only invalidates already-issued local URLs.
- **Verify sharp on Linux** at any time: `./scripts/verify-linux-build.sh`.
