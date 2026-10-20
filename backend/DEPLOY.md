# Deploying the Nostos backend

Nostos production is designed around:

- Vercel for the Next.js API and public web site
- Neon Postgres for persistent relational data
- Cloudflare R2 for private photo storage
- Resend for passwordless authentication email
- Prisma forward-only migrations

The mobile app is configured to use:

- production API: `https://api.nostospassport.com`
- preview API: `https://preview-api.nostospassport.com`

The public production site uses `https://nostospassport.com` for privacy, terms, support, account deletion, and shared collection pages.

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
- Node.js: 22.x, matching `backend/package.json`
- Function region: `iad1` (Washington, D.C.)

`pnpm vercel-build` runs:

```bash
pnpm deploy:check
prisma generate
prisma migrate deploy
next build
```

`deploy:check` refuses a preview/production deployment when required secrets are missing, database URLs point to localhost, storage is not configured for R2, or authentication, cron, or collection-share secrets are invalid.

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
4. rehearse schema changes on an isolated Neon branch when possible
5. use `prisma migrate deploy` only for the intended environment
6. never run `pnpm db:reset` or `prisma migrate reset` against preview or production

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

Photos stay private. The backend generates short-lived S3-compatible presigned GET URLs after the viewer has been authorized, including when a valid shared collection link authorizes a read-only web view.

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

## Operational and share-link secrets

Generate separate random secrets for the maintenance cron and signed collection-share links:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Set them as:

```text
CRON_SECRET=<random secret>
SHARE_TOKEN_SECRET=<different random secret>
```

`AUTH_CODE_SECRET`, `CRON_SECRET`, and `SHARE_TOKEN_SECRET` must all be distinct and at least 32 characters. Rotating `SHARE_TOKEN_SECRET` intentionally invalidates every currently enabled collection URL, so do not rotate it casually.

`PUBLIC_WEB_URL` is optional. Production defaults shared collection URLs to `https://nostospassport.com`; set the variable only when an environment intentionally needs a different public origin. Preview currently defaults to `https://preview-api.nostospassport.com` unless overridden.

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
SHARE_TOKEN_SECRET=<unique random secret>
```

Preview should use the same variable names with its own Neon database, R2 bucket, Resend key, and unique secrets, plus:

```text
APP_ENV=preview
R2_BUCKET=nostos-preview
```

If preview shared links should use a dedicated public web domain instead of the preview API origin, also set:

```text
PUBLIC_WEB_URL=<preview public origin>
```

Do not set `DEV_SEED_PASSWORD`, `TEST_DATABASE_URL`, or local upload paths in production unless an explicit operational task requires them.

## Production data

Do not seed fake or demo data into production. Import the approved real place and neighborhood catalog only after reviewing the intended coverage.

## Preview and App Review

The current mobile app requires sign-in. If preview is used for App Review, create the designated review account through the supported operational flow and set the exemption explicitly:

```bash
pnpm user:geofence-exempt <email> true
```

Use `false` to clear it. `geofenceExempt` is not a staff role and grants no access to another account's data. It only bypasses stamp geofence acceptance for that account, and those stamps are written `countable=false`.

## Verification after deployment

Verify, in order:

1. `GET /api/health` succeeds on the intended domain
2. Prisma migrations are present in the intended database, including `collection_share`
3. signup sends an OTP through Resend
4. sign-in works by both email and handle
5. a test photo can be uploaded to the correct R2 bucket
6. the returned photo URL is signed and expires
7. the maintenance cron authenticates successfully
8. an account cannot read another account's master Passport, private collection, stamp, or place-history data
9. enabling a user-created collection share produces a working `/c/...` link without requiring sign-in
10. the shared page contains only the stamps currently in that collection and does not expose the user's master Passport
11. disabling the shared link makes the old URL return not found immediately
12. deleting the collection or owner account makes the shared URL unavailable
13. the mobile preview build talks only to `preview-api.nostospassport.com`
14. the mobile production build talks only to `api.nostospassport.com`
15. `https://nostospassport.com/privacy`, `/terms`, `/support`, and a valid `/c/...` page resolve before App Store submission

## Local development

Local defaults remain:

- Next.js port: 3001
- Docker Postgres port: 5438
- database: `nostos_codex`
- `STORAGE_DRIVER=local`
- shared collection links use `http://localhost:3001` unless `PUBLIC_WEB_URL` is set

Local development may log OTP codes to the backend console when `RESEND_API_KEY` is blank. The committed `.env.example` includes a development-only collection-share secret; preview and production must use unique real secrets.
