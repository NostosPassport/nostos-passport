# Dependencies

One line per dependency in backend/package.json and mobile/package.json: `- name@version: why`.
The gate (scripts/check-deps.mjs) fails if a package.json dependency has no matching line.

## backend

- @aws-sdk/client-s3@3.1139.0: R2/S3 photo storage
- @aws-sdk/s3-request-presigner@3.1139.0: signed photo URLs
- @prisma/client@6.19.3: database client
- leaflet@1.9.4: web map
- next@15.5.26: web app and API server
- react@19.3.0: UI runtime
- react-dom@19.3.0: UI runtime (web)
- server-only@0.0.1: guards server modules from client bundles
- sharp@0.35.4: image processing and EXIF stripping
- zod@3.25.76: request validation
- @eslint/eslintrc@3.3.7: dev tooling (build, test or lint)
- @tailwindcss/postcss@4.3.3: dev tooling (build, test or lint)
- @types/leaflet@1.9.22: dev tooling (build, test or lint)
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

- @expo/ui@~57.0.20: carried over from Last Call, used by the app
- @gorhom/bottom-sheet@^5.2.14: bottom sheets
- @react-native-community/datetimepicker@9.1.0: carried over from Last Call, used by the app
- @react-native-community/netinfo@12.0.1: carried over from Last Call, used by the app
- @shopify/flash-list@2.0.2: fast lists
- @tanstack/react-query@^5.103.2: mobile data fetching and cache
- expo@~57.0.25: mobile framework
- expo-blur@~57.0.3: carried over from Last Call, used by the app
- expo-constants@~57.0.19: carried over from Last Call, used by the app
- expo-device@~57.0.2: carried over from Last Call, used by the app
- expo-font@~57.0.4: carried over from Last Call, used by the app
- expo-glass-effect@~57.0.4: carried over from Last Call, used by the app
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
