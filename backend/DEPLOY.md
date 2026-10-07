# Deploying Nostos backend

This is the current deployment checklist. It is not evidence that any external environment is presently deployed. Verify actual Vercel/Neon/R2 state before making a deployment claim.

## Local configuration

Current committed development defaults are:

- Next.js dev port: 3001
- Docker Postgres host port: 5438
- compose database: `nostos_codex`

These replace old documentation that referenced ports 3000/5435.

## Production/preview shape

The backend is designed for:

- Vercel for the Next.js service
- Postgres such as Neon for persistent data
- private S3-compatible object storage such as Cloudflare R2 for photos
- forward-only Prisma migrations

Required environment variables depend on the deployed storage/database configuration and include database URLs, storage credentials, upload-signing secret, and operational secrets. Never commit them.

## Build

The package's Vercel build command is:

```bash
pnpm vercel-build
```

which generates Prisma, applies deployable migrations, and builds Next.js.

Before running migrations against any non-local database:

1. inspect pending migrations
2. verify backups/restore strategy
3. verify the target database URL
4. run forward migrations only
5. never use `pnpm db:reset` or `prisma migrate reset`

## Production data

Do not seed fake/demo data into production. Import the approved real place/neighborhood catalog using the repository scripts only after reviewing the intended coverage.

## Preview/App Review

If a preview environment is used for App Review, create the designated review account through the supported operational flow and verify any geofence exemption is limited to that account and behaves as documented.

The current mobile app requires sign-in. Do not prepare review instructions around the removed guest `Look around first` flow.

## Mobile URLs

After deployment, update/verify `mobile/eas.json` and any `EXPO_PUBLIC_API_URL` values for preview/production. Do not assume placeholder `nostos.app` hosts are live merely because they appear in documentation or config.

## Launch checklist

- backend health endpoint passes against the intended database
- migrations applied successfully
- object storage reads/writes work
- review account tested
- privacy/terms/support URLs resolve
- legal text matches current personal product and photo/location behavior
- mobile build points to the intended backend
- no development seed credentials or secrets are shipped
