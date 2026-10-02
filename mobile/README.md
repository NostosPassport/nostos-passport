# Nostos (iOS)

The native iPhone app for Nostos: a live map of East Village and Lower East Side bars. Expo SDK 57, Expo Router,
TypeScript. The backend (Next.js + Postgres) is the sibling folder `../backend/`; see its `API.md` and `DEPLOY.md`.

Dark mode only, iPhone only. Runs in **Expo Go** for development (every native package is one Expo Go includes).

## Run it on your phone (Expo Go, local backend)

You need: the Expo Go app on your iPhone (App Store), and the phone and this Mac on the same Wi-Fi.

1. Start the backend (Postgres in Docker, then the Next.js dev server on port 3000):

   ```bash
   cd ~/nostos/backend && colima start && docker compose up -d && pnpm dev
   ```

2. In another terminal, start the app:

   ```bash
   cd ~/nostos/mobile && npx expo start
   ```

3. Scan the QR code with the iPhone Camera app. It opens in Expo Go.

No config needed: in development the app talks to the Mac that serves it (Metro's LAN address, port 3000). To point
at something else, set `EXPO_PUBLIC_API_URL`, for example `EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npx expo start`.
If the phone can't connect, try `npx expo start --tunnel` for the app, and make sure macOS's firewall allows
incoming connections to Node for port 3000.

**Demo accounts** (from the backend's dev seed, password `lastcall-dev`): `appreview@lastcall.dev` (can post from
anywhere), `owner_velvet@lastcall.dev` (owns Velvet: "Manage Velvet" on Profile), `mod_morgan@lastcall.dev`
(Moderation on Profile). Or tap **Look around first** to browse without an account.

**Posting away from the bars:** in development, long-press the map to set a simulated location (a "Simulated
location" chip clears it). This doesn't exist in release builds. The server still checks the 100 m geofence against
whatever location it receives.

## Run it against the preview backend

After the backend is deployed (see `../backend/DEPLOY.md`):

```bash
cd ~/nostos/mobile && EXPO_PUBLIC_API_URL=https://preview.nostos.app npx expo start
```

## Build with EAS

EAS isn't logged in on this Mac, so no build has been made yet. To build and install on your phone through TestFlight:

1. Log in (free Expo account) and link the project, once:

   ```bash
   cd ~/nostos/mobile && npx eas-cli@latest login
   ```

   ```bash
   npx eas-cli@latest init
   ```

2. Preview build (uses `https://preview.nostos.app`; needs an Apple Developer account; EAS creates the
   certificates and profiles for you):

   ```bash
   npx eas-cli@latest build --profile preview --platform ios
   ```

   Then send it to TestFlight (set `ascAppId` in `eas.json` first):

   ```bash
   npx eas-cli@latest submit --profile preview --platform ios
   ```

   Open TestFlight on your iPhone to install it. For the App Store release, build `production` and submit:

   ```bash
   npx eas-cli@latest build --profile production --platform ios
   ```

   ```bash
   npx eas-cli@latest submit --profile production --platform ios
   ```

3. Simulator build (runs in the iOS Simulator, no Apple account needed):

   ```bash
   npx eas-cli@latest build --profile development --platform ios
   ```

Profiles are in `eas.json`: `development` (a simulator build of the app, not a dev client; uses the preview API),
`preview` (App Store distribution for TestFlight, preview API),
`production` (App Store, `https://nostos.app`). Update the URLs there if your domains differ. App Store listing
text, privacy answers and review notes are in `STORE.md`.

## Checks

```bash
npm run check
```

That runs `tsc`, ESLint (including the design-system rules: no raw colors or sizes outside `src/theme`, no emoji),
and Jest. With the backend running locally:

```bash
npm run test:live
```

runs the app's API client against the real backend and parses every response with the app's contract.

After changing the backend contract, re-copy it (a test fails if the copy drifts):

```bash
npm run sync:contracts
```

## Layout

| Path | What |
|---|---|
| `src/app/` | Routes (Expo Router): welcome, sign in/up, map, venue sheet, report sheet, photo composer and viewer, profile, people, settings, owner, moderation |
| `src/api/` | `contracts.ts` (verbatim copy of the backend's zod contract), typed client, React Query hooks |
| `src/theme/` | Design tokens: colors, type, spacing, radius, sizes, motion. The only place raw values may appear |
| `src/components/ui/` | Native-feeling building blocks (text, buttons, grouped fields and lists, sheets, toasts, skeletons) |
| `src/features/` | Map, venue, photos, comments, moderation, people, owner, location |
| `eslint-rules/` | The design-token and no-emoji lint rules, with tests |

See `DECISIONS.md` for every judgment call, `AI-LOG.md` for the build log, and `REVIEW.md` for the review summary.
