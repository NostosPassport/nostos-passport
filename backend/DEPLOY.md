# Deploying the Nostos backend

Nostos production is designed around:

- Vercel for the Next.js API and public legal/support site
- Neon Postgres for persistent relational data
- Cloudflare R2 for private photo storage
- Resend for passwordless authentication email
- Prisma forward-only migrations

The mobile app is configured to use:

- production API: `https://api.nostospassport.com`
- preview API: `https://preview-api.nostospassport.com`

The public production site uses `https://nostospassport.com` for privacy, terms, support, and account-deletion pages.

## Environment layout

Keep production and preview data completely separate.

| Resource | Production | Preview |
| --- | --- | --- |
| Public site | `nostospassport.com` | optional |
| API domain | `api.nostospassport.com` | `preview-api.nostospassport.com` |
| Vercel project | `nostos-backend` | `nostos-backend-preview` |
| Neon database/project | `nostos-production` | `nostos-preview` |
| R2 bucket | `nostos-production` | `nostos-preview` |
| `APP_ENV` | `production` | `preview` |

Never point a preview deployment at the production Postgres database or production R2 bucket.

## Vercel

Create the project from `NostosPassport/nostos-passport` with:

- Root Directory: `backend`
- Framework Preset: Next.js
- Build Command: `pnpm vercel-build`
- Node.js: 20 or newer
- Function region: `iad1` (Washington, D.C.)

`pnpm vercel-build` runs:

```bash
pnpm deploy:check
prisma generate
prisma migrate deploy
next build
```

`deploy:check` refuses a preview/production deployment when required secrets are missing, database URLs point to localhost, storage is not configured for R2, or auth/cron secrets are invalid.

The repository already defines the daily maintenance cron in `backend/vercel.json`.

Add `nostospassport.com` and `api.nostospassport.com` to the production Vercel project. Add `preview-api.nostospassport.com` to the preview project. Use the DNS values Vercel provides rather than hardcoding an A or CNAME target here.

## Neon Postgres

Create separate production and preview databases in AWS US East 1 (N. Virginia) so they are close to Vercel `iad1`.

For each environment obtain:

- a pooled connection string for application traffic
- a direct, non-pooled connection string for Prisma migrations

Set:

```text
DATABASE_URL=<pooled connection string>
DIRECT_URL=<direct connection string>
```

The Prisma schema is already configured to use `DATABASE_URL` for normal queries and `DIRECT_URL` for migrations.

Before any non-local migration:

1. inspect the pending migrations
2. confirm the database target
3. confirm the provider backup or restore strategy
4. use `prisma migrate deploy` only
5. never run `pnpm db:reset` or `prisma migrate reset` against preview or production

Do not seed development accounts into production.

## Cloudflare R2

Create two private buckets using the default jurisdiction so the standard R2 S3 endpoint used by the backend remains valid:

```text
nostos-production
nostos-preview
```

A location hint such as Eastern North America is fine. Do not make either bucket public.

Create separate R2 S3 API credentials for production and preview with Object Read & Write access scoped to the corresponding bucket.

Set:

```text
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=<Cloudflare account id>
R2_ACCESS_KEY_ID=<R2 S3 access key>
R2_SECRET_ACCESS_KEY=<R2 S3 secret>
R2_BUCKET=<environment bucket name>
```

Photos stay private. The backend generates short-lived S3-compatible presigned GET URLs for authorized viewers.

## Resend

Use the verified authentication sender:

```text
AUTH_EMAIL_FROM=Nostos <login@auth.nostospassport.com>
```

Create separate sending-only API keys for production and preview, restricted to the verified authentication domain when possible.

Set:

```text
RESEND_API_KEY=<environment Resend API key>
RESEND_VERIFY_EMAIL_TEMPLATE_ID=email-otp
AUTH_COMPANY_ADDRESS=<complete business mailing address>
AUTH_CODE_SECRET=<random secret>
```

The `email-otp` template must remain published and accept:

- `verification_code`
- `first_name`
- `expiry_minutes`
- `company_address`

Generate `AUTH_CODE_SECRET` with:

```bash
openssl rand -hex 32
```

## Operational secret

Generate a separate cron secret:

```bash
openssl rand -hex 32
```

Set it as:

```text
CRON_SECRET=<random secret>
```

Do not reuse `AUTH_CODE_SECRET` as `CRON_SECRET`.

## Required Vercel variables

Production should have at least:

```text
APP_ENV=production
DATABASE_URL=<production pooled Neon URL>
DIRECT_URL=<production direct Neon URL>
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=<production value>
R2_ACCESS_KEY_ID=<production value>
R2_SECRET_ACCESS_KEY=<production value>
R2_BUCKET=nostos-production
RESEND_API_KEY=<production Resend key>
AUTH_EMAIL_FROM=Nostos <login@auth.nostospassport.com>
AUTH_COMPANY_ADDRESS=<complete mailing address>
RESEND_VERIFY_EMAIL_TEMPLATE_ID=email-otp
AUTH_CODE_SECRET=<unique random secret>
CRON_SECRET=<unique random secret>
SOCIAL_ENABLED=0
```

Preview should use the same variable names with its own Neon database, R2 bucket, Resend key, and unique secrets, plus:

```text
APP_ENV=preview
R2_BUCKET=nostos-preview
```

Do not set `DEV_SEED_PASSWORD`, `TEST_DATABASE_URL`, or local upload paths in production unless an explicit operational task requires them.

## Production data

Do not seed fake or demo data into production. Import the approved real place and neighborhood catalog only after reviewing the intended coverage.

## Preview and App Review

The current mobile app requires sign-in. If preview is used for App Review, create the designated review account through the supported operational flow and verify that any geofence exemption is limited to that account.

## Verification after deployment

Verify, in order:

1. `GET /api/health` succeeds on the intended domain
2. Prisma migrations are present in the intended database
3. signup sends an OTP through Resend
4. sign-in works by both email and handle
5. a test photo can be uploaded to the correct R2 bucket
6. the returned photo URL is signed and expires
7. the maintenance cron authenticates successfully
8. the mobile preview build talks only to `preview-api.nostospassport.com`
9. the mobile production build talks only to `api.nostospassport.com`
10. `https://nostospassport.com/privacy`, `/terms`, and `/support` resolve before App Store submission

## Local development

Local defaults remain:

- Next.js port: 3001
- Docker Postgres port: 5438
- database: `nostos_codex`
- `STORAGE_DRIVER=local`

Local development may log OTP codes to the backend console when `RESEND_API_KEY` is blank.
