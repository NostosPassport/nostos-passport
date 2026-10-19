# Nostos iOS app

Nostos is an iPhone-only Expo SDK 57 app. The current product is a personal owner-only passport for New York. Signed-out users sign in or create an account; the old guest preview flow is no longer part of the root navigation.

## Current navigation

The production app centers on three tabs:

- Passport
- Stamp
- Map

Feed and Activity routes may remain in the source behind the social feature flag, but they are not part of the current personal product.

## Stamp photo flow

`src/app/(app)/stamp/camera.tsx` is a photo-management screen, not a custom live camera.

- **Take Photo** uses `expo-image-picker` to open the native iOS camera.
- **Choose from Photo Library** uses the native library picker.
- Library selections are validated using available metadata and the current stamp/place context.
- Screenshots, photos too far from the place, photos outside the allowed time window, or sufficiently low-confidence selections can be rejected.
- Accepted photos are prepared before upload and EXIF/GPS is stripped from the uploaded image.
- Native camera captures receive the Nostos watermark and the app attempts to save a copy to Photos when permission allows.
- Up to six photos may be attached.

Do not restore the historical `CameraView`/custom-shutter implementation unless product direction changes.

## Design

Only Figma pages **9 and 10** are current. Earlier pages are historical.

The active native theme is the editorial ivory/electric-blue system. The file `src/theme/midnight.ts` retains an old filename and token names for compatibility, but its current values are editorial.

## Run

```bash
npm install
npx expo start --go
```

The app defaults to the current local backend configuration on port 3001 in development. Use `EXPO_PUBLIC_API_URL` when you intentionally target another backend.

## Maps and Places

The Map tab uses the default iOS map provider from `react-native-maps`, which is Apple Maps on iOS. It displays only Nostos-owned visited venues and does not call Google Places while panning, zooming, filtering, or recentering.

Google Places is used only by the backend for restaurant/bar discovery, text search, and resolving a selected Google place into a durable Nostos venue. Configure `GOOGLE_PLACES_API_KEY` on the backend only. The Places key must never be exposed as an `EXPO_PUBLIC_*` mobile variable.

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
| `src/features/photos/` | camera/library picking, validation, preparation, watermarking, Photos save |
| `src/features/stamps/` | composer, drafts, stamp flow |
| `src/features/book/` | passport/book runtime |
| `src/features/map/` | map UI/model |
| `src/theme/` | design tokens and typography |
| `src/components/ui/` | shared native UI |

For Expo APIs, use the SDK 57 documentation. See `AGENTS.md`, `DEVICE-CHECKLIST.md`, `REVIEW.md`, and `../DESIGN.md`.
