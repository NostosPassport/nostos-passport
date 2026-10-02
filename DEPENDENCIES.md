# Dependencies

One line per dependency in backend/package.json and mobile/package.json: `- name@version: why`.
The gate (scripts/check-deps.mjs) fails if a package.json dependency has no matching line.

## backend

- @aws-sdk/client-s3@3.1139.0: R2/S3 photo storage
- @aws-sdk/s3-request-presigner@3.1139.0: signed photo URLs
- @prisma/client@6.19.3: database client
- next@15.5.26: web app and API server
- react@19.3.0: UI runtime
- react-dom@19.3.0: UI runtime (web)
- server-only@0.0.1: guards server modules from client bundles
- sharp@0.35.4: image processing and EXIF stripping
- zod@3.25.76: request validation
- @eslint/eslintrc@3.3.7: dev tooling (build, test or lint)
- @tailwindcss/postcss@4.3.3: dev tooling (build, test or lint)
- @types/node@22.20.4: dev tooling (build, test or lint)
- @types/pngjs@6.0.5: dev tooling (build, test or lint)
- @types/react@19.3.0: dev tooling (build, test or lint)
- @types/react-dom@19.3.0: dev tooling (build, test or lint)
- eslint@9.39.5: lint
- eslint-config-next@15.5.26: dev tooling (build, test or lint)
- pngjs@7.0.0: dev tooling (build, test or lint)
- prisma@6.19.3: schema, migrations, client generation
- tailwindcss@4.3.3: dev tooling (build, test or lint)
- tsx@4.23.15: run TypeScript scripts (seed, jobs)
- typescript@5.9.3: typecheck
- vite-tsconfig-paths@5.1.4: dev tooling (build, test or lint)
- vitest@3.2.7: backend test runner

## mobile

- @react-native-community/netinfo@12.0.1: carried over from Last Call, used by the app
- @shopify/flash-list@2.0.2: fast lists
- @tanstack/react-query@^5.103.2: mobile data fetching and cache
- expo@~57.0.25: mobile framework
- expo-constants@~57.0.19: carried over from Last Call, used by the app
- expo-device@~57.0.2: carried over from Last Call, used by the app
- expo-font@~57.0.4: carried over from Last Call, used by the app
- expo-haptics@~57.0.3: carried over from Last Call, used by the app
- expo-image@~57.0.5: fast image rendering
- expo-image-manipulator@~57.0.20: resize photos before upload
- expo-image-picker@~57.0.20: camera and photo library
- expo-linking@~57.0.11: carried over from Last Call, used by the app
- expo-location@~57.0.20: device location for geofence
- expo-router@~57.0.23: mobile navigation
- expo-secure-store@~57.0.4: token storage on device
- expo-splash-screen@~57.0.9: carried over from Last Call, used by the app
- expo-status-bar@~57.0.1: carried over from Last Call, used by the app
- expo-symbols@~57.0.3: SF Symbols icons
- expo-system-ui@~57.0.4: carried over from Last Call, used by the app
- expo-web-browser@~57.0.3: carried over from Last Call, used by the app
- react@19.2.3: UI runtime
- react-native@0.86.3: mobile runtime
- react-native-gesture-handler@~2.32.0: gestures
- react-native-maps@1.27.2: Places map
- react-native-reanimated@4.5.1: animation
- react-native-safe-area-context@~5.7.0: carried over from Last Call, used by the app
- react-native-screens@~4.26.0: carried over from Last Call, used by the app
- react-native-worklets@0.10.1: carried over from Last Call, used by the app
- zod@^3.25.76: request validation
- @testing-library/react-native@^14.0.1: mobile component tests
- @types/jest@29.5.14: dev tooling (build, test or lint)
- @types/react@~19.2.2: dev tooling (build, test or lint)
- eslint@^9.39.5: lint
- eslint-config-expo@~57.0.2: dev tooling (build, test or lint)
- globals@^16.5.0: dev tooling (build, test or lint)
- jest@~29.7.0: mobile test runner
- jest-expo@~57.0.5: dev tooling (build, test or lint)
- typescript@~6.0.3: typecheck
- @expo-google-fonts/cormorant-garamond@^0.4.1: the serif for titles and stamp text (bundled font files, works in Expo Go)
- @expo-google-fonts/courier-prime@^0.4.1: the typewriter face for dates and captions (bundled font files)
- @shopify/react-native-skia@2.6.2: the passport book: leather grain and foil shaders, stamps, page shading (included in Expo Go, checked in the Expo SDK 57 docs)
- react-native-svg@15.15.4: guilloche page patterns, the ribbon and thin line drawings (included in Expo Go)
- expo-camera@~57.0.6: the in-app camera for stamp photos, up to 6 per stamp (included in Expo Go)
- expo-sensors@~57.0.3: device tilt for the cover foil highlight; optional, a drag fallback exists (included in Expo Go)
- @sentry/react-native@~7.11.0: error reporting, off unless the build sets EXPO_PUBLIC_SENTRY_ENABLED=1 and a DSN (no DSN is committed); loaded lazily, scrubbed of user data


## Removed

- @gorhom/bottom-sheet, @react-native-community/datetimepicker, expo-blur, expo-glass-effect, @expo/ui: nothing in Nostos uses them (the venue sheets and promo pickers are gone).
- leaflet, @types/leaflet: the web map is gone (Nostos is an iPhone app; the web holds legal pages and moderation tools).
