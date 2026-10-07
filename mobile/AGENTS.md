# Mobile agent guidance

This is an Expo SDK 57, React Native, iOS-only application.

## Expo APIs

Do not rely on remembered Expo APIs. Before modifying Expo, EAS, or React Native integration:

1. Read the installed `expo` version in `package.json`.
2. Use the matching SDK 57 documentation at `https://docs.expo.dev/versions/v57.0.0/`.
3. Prefer Expo modules already in the app.
4. Use `npx expo install <package>` for native Expo dependencies.

If `ios/` or `android/` are generated rather than committed, do not hand-edit them. Use `app.json` and config plugins.

## Current photo implementation

The stamp photo flow uses `expo-image-picker` for both the native iOS camera and Photo Library. `stamp/camera.tsx` manages accepted photos. Do not infer current behavior from old docs that mention a `CameraView`, custom shutter, or camera-only stamps.

Library validation intentionally reads available metadata before preparation. Upload preparation strips EXIF/GPS. Camera captures are watermarked and may be saved through `expo-media-library`.

## Design

Only Figma pages 9 and 10 are current. Earlier Figma work is historical. The active theme is Editorial even though `src/theme/midnight.ts` keeps a legacy filename/token vocabulary.

## Commands

```bash
npx expo start
npx expo lint
npx tsc --noEmit
npx expo-doctor
npx expo install --fix
npm run check
```

Run `npm run check` before declaring a mobile implementation change complete. Documentation-only changes do not require a fabricated runtime-test claim.

## Routing

Use Expo Router. Routes live in `src/app/`; non-route code belongs outside `src/app/`.

## General rules

- Preserve iOS safe areas, Dynamic Type, VoiceOver labels, keyboard behavior, and Reduce Motion.
- Never commit secrets.
- Keep server-side geofence verification authoritative.
- Keep contract copies synchronized after backend contract changes.
