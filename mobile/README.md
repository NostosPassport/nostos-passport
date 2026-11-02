# Nostos iOS app

Nostos is an iPhone-only Expo SDK 58 app. The current product is a personal owner-only passport for the places a user goes. Signed-out users sign in or create an account; the old guest preview flow is no longer part of the root navigation.

## Current navigation

The production app centers on three tabs:

- Passport
- Stamp
- Map

The Passport also provides a stamp gallery for scanning all visits in a single newest-first list with category filters.

## Stamp photo flow

`src/app/(app)/stamp/camera.tsx` is a photo-management screen, not a custom live camera.

- **Take Photo** uses `expo-image-picker` to open the native iOS camera.
- **Choose from Photo Library** uses the native library picker.
- Photo Library images are memories attached to the visit. They are not rejected based on EXIF GPS, timestamp, source application, screenshot status, or editing software.
- Accepted photos are prepared before upload and EXIF/GPS is stripped from the uploaded image.
- Native camera captures receive the Nostos watermark and the app attempts to save a copy to Photos when permission allows.
- Up to six photos may be attached.

Do not restore the historical `CameraView`/custom-shutter implementation unless product direction changes.

## Design

Only Figma pages **9 and 10** are current. Earlier pages are historical.

The active native theme is the editorial cream/electric-blue system implemented in `src/theme/editorial.ts`. The default app background is `#F3EFE5`, raised paper is `#F7F4EE`, and the primary accent is `#123BFF`.

## Run

```bash
npm install
npx expo start --go
```

The app defaults to the current local backend configuration on port 3001 in development. Use `EXPO_PUBLIC_API_URL` when you intentionally target another backend.

## Maps and Places

The Map tab uses the default iOS map provider from `react-native-maps`, which is Apple Maps on iOS. It displays Nostos-owned visited venues and does not call Google Places while panning, zooming, filtering, or recentering.

Google Places is used by the backend for worldwide restaurant/bar discovery, text search, and resolving a selected Google place into a durable Nostos venue. Durable place locality may include area, city, region, country, and country code. NYC neighborhood data is optional legacy enrichment and does not gate whether a place may be stamped. Configure `GOOGLE_PLACES_API_KEY` on the backend only. The Places key must never be exposed as an `EXPO_PUBLIC_*` mobile variable.

No Google Maps SDK for iOS key is required.

## Checks

```bash
npm run check
```

This runs TypeScript, ESLint, and Jest.

After backend API contract changes:

```bash
npm run sync:contracts
```

## Important paths

| Path | Purpose |
|---|---|
| `src/app/` | Expo Router screens |
| `src/api/` | API client, contracts, and queries |
| `src/features/photos/` | camera/library picking, preparation, watermarking, Photos save |
| `src/features/stamps/` | composer, drafts, stamp flow |
| `src/features/book/` | passport/book runtime |
| `src/features/map/` | map UI/model |
| `src/theme/` | design tokens and typography |
| `src/components/ui/` | shared native UI |

For Expo APIs, use the SDK 58 documentation. See `AGENTS.md`, `DEVICE-CHECKLIST.md`, `REVIEW.md`, and `../DESIGN.md`.
