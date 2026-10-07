# Dependencies

This ledger mirrors dependencies and devDependencies in `backend/package.json` and `mobile/package.json`. Keep it synchronized when package manifests change.

## backend

- `@aws-sdk/client-s3@3.1139.0`: R2/S3 photo storage.
- `@aws-sdk/s3-request-presigner@3.1139.0`: signed photo URLs.
- `@prisma/client@6.19.3`: database client.
- `next@15.5.26`: web app and API server.
- `react@19.3.0`: React runtime.
- `react-dom@19.3.0`: React web runtime.
- `server-only@0.0.1`: server-module guard.
- `sharp@0.35.4`: image processing and server-side metadata stripping.
- `zod@3.25.76`: validation and API contracts.
- `@eslint/eslintrc@3.3.7`: lint tooling.
- `@tailwindcss/postcss@4.3.3`: CSS build tooling.
- `@types/node@22.20.4`: Node types.
- `@types/pngjs@6.0.5`: pngjs types.
- `@types/react@19.3.0`: React types.
- `@types/react-dom@19.3.0`: React DOM types.
- `eslint@9.39.5`: lint.
- `eslint-config-next@15.5.26`: Next.js lint configuration.
- `pngjs@7.0.0`: PNG test/tool processing.
- `prisma@6.19.3`: schema, migrations, and client generation.
- `tailwindcss@4.3.3`: CSS tooling.
- `tsx@4.23.15`: execute TypeScript scripts.
- `typescript@5.9.3`: typecheck.
- `vite-tsconfig-paths@5.1.4`: Vitest path resolution.
- `vitest@3.2.7`: backend test runner.

## mobile

- `@expo-google-fonts/cormorant-garamond@^0.4.1`: serif display font.
- `@expo-google-fonts/courier-prime@^0.4.1`: typewriter font.
- `@react-native-community/netinfo@12.0.1`: network state.
- `@sentry/react-native@~7.11.0`: optional error reporting, disabled unless configured.
- `@shopify/flash-list@2.0.2`: performant lists.
- `@shopify/react-native-skia@2.6.2`: graphics, passport effects, and watermark rendering.
- `@tanstack/react-query@^5.103.2`: API data fetching and cache.
- `expo@~57.0.25`: mobile framework.
- `expo-asset@~57.0.19`: bundled asset loading.
- `expo-camera@~57.0.6`: legacy dependency still present in the manifest; the current stamp flow does not use `CameraView` and launches the system camera through `expo-image-picker`.
- `expo-constants@~57.0.19`: Expo runtime constants.
- `expo-device@~57.0.2`: physical-device checks for camera behavior.
- `expo-file-system@~57.0.7`: local asset/file access used by the 3D runtime.
- `expo-font@~57.0.4`: font loading.
- `expo-gl@~57.0.2`: 3D passport GL runtime.
- `expo-haptics@~57.0.3`: tactile feedback.
- `expo-image@~57.0.5`: image rendering.
- `expo-image-manipulator@~57.0.20`: photo preparation/resizing.
- `expo-image-picker@~57.0.20`: native camera launch and Photo Library selection for stamp photos.
- `expo-linking@~57.0.11`: deep linking.
- `expo-location@~57.0.20`: device location for nearby places/geofence submission.
- `expo-media-library@~57.0.5`: save accepted camera captures to the user's Photos library.
- `expo-router@~57.0.23`: file-based navigation.
- `expo-secure-store@~57.0.4`: secure token and local state storage.
- `expo-sensors@~57.0.3`: device sensor support for passport effects.
- `expo-splash-screen@~57.0.9`: splash screen.
- `expo-status-bar@~57.0.1`: status bar control.
- `expo-symbols@~57.0.3`: SF Symbols.
- `expo-system-ui@~57.0.4`: system UI integration.
- `expo-web-browser@~57.0.3`: external web flows.
- `piexifjs@^1.0.6`: JPEG EXIF metadata handling used by the current photo workflow.
- `react@19.2.3`: React runtime.
- `react-native@0.86.3`: native runtime.
- `react-native-gesture-handler@~2.32.0`: gestures.
- `react-native-maps@1.27.2`: map UI.
- `react-native-reanimated@4.5.1`: animation.
- `react-native-safe-area-context@~5.7.0`: safe-area layout.
- `react-native-screens@~4.26.0`: native screen primitives.
- `react-native-svg@15.15.4`: vector drawing.
- `react-native-worklets@0.10.1`: UI-thread worklets.
- `three@0.186.1`: 3D passport renderer.
- `zod@^3.25.76`: validation/API contract parsing.
- `@testing-library/react-native@^14.0.1`: component tests.
- `@types/jest@29.5.14`: Jest types.
- `@types/react@~19.2.2`: React types.
- `@types/three@0.186.0`: Three.js types.
- `eslint@^9.39.5`: lint.
- `eslint-config-expo@~57.0.2`: Expo lint configuration.
- `globals@^16.5.0`: lint globals.
- `jest@~29.7.0`: mobile test runner.
- `jest-expo@~57.0.5`: Expo Jest preset/runtime.
- `typescript@~6.0.3`: typecheck.
