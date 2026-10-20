# Nostos

Nostos is a personal passport for New York. Go to a place, create a stamp, and keep the memory in your passport. The normal product experience requires an account and remains private by default. A user-created collection may be explicitly shared through a revocable, unlisted read-only web link; the master Passport cannot be shared.

A stamp can contain up to six photos, a caption, a song, or a combination. The server verifies the place geofence before creating a stamp. Photos can come from the native iOS camera or from the Photo Library when the selected photo passes the app's local validation rules.

## Repository

| Folder | Purpose | Tooling |
|---|---|---|
| `backend/` | Next.js API/web shell, Prisma, Postgres | pnpm |
| `mobile/` | Expo SDK 57 iPhone app with Expo Router | npm |
| `design/` | Design handoffs and source material | varies |
| `reviews/`, `deliveries/` | dated historical evidence and handoffs | read-only history |

The default branch is `main`. Do not treat old `build`, `build-codex`, local checkout paths, LAN addresses, or uncommitted-session instructions in dated documents as current repository instructions.

## Current product scope

- iPhone only.
- Account required for the product experience. The old `Look around first` guest/preview flow is no longer in scope.
- Main navigation is Passport, Stamp, and Map. Feed, follows, likes, Activity, public profiles, moderation, and other social architecture are not part of the current codebase.
- User-created collections can be explicitly shared through signed, revocable web links. Shared pages are read-only and noindex. The master Passport has no sharing primitive and must remain private.
- Stamp photos: up to six. Camera capture opens the native iOS camera through `expo-image-picker`. Photo Library selection is also supported and validated locally using available metadata before the prepared upload has EXIF/GPS stripped.
- Camera captures are watermarked and the app attempts to save an accepted copy to Photos when permission allows.
- The server owns geofence acceptance, ownership enforcement, public-share authorization, and content validation.

## Design authority

Only Figma pages **9 and 10** are current design references. Earlier Figma pages and the old black/silver and black/brass directions are historical. See `DESIGN.md` and `design/editorial/CURRENT-SCOPE.md`.

The current app theme is the ivory/electric-blue editorial system. The historical module name `mobile/src/theme/midnight.ts` is intentionally retained while screens migrate.

## Run locally

Backend:

```bash
cd backend
pnpm install
docker compose up -d db
pnpm dev
```

The committed backend currently uses port **3001** and the Docker database is exposed on **5438**. Use `pnpm db:seed` when you intentionally want the deterministic development seed. Use `pnpm db:reset` only on a disposable development database, never on shared or production data.

Mobile:

```bash
cd mobile
npm install
npx expo start --go
```

For mobile validation after code changes:

```bash
npm run check
```

## Read first

Current guidance: `AGENTS.md`, `CLAUDE.md`, `ENGINE.md`, `DESIGN.md`, `HANDOFF.md`, then the scoped README/AGENTS file for the folder you are changing.

Historical build prompts, reviews, deliveries, AI logs, and dated handoffs are evidence of earlier states. They do not supersede the current files above.
