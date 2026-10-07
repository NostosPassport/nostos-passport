# Backend review guide

This is the current review map. Dated review files contain historical test counts and session-specific evidence.

## Critical areas

| Area | Review target |
|---|---|
| Geofence | stamp creation is accepted/rejected server-side from the place radius and submitted coordinates |
| Personal visibility | with current personal mode, another user's passport/stamps/places are not exposed |
| Upload privacy | every uploaded image is re-encoded and EXIF/GPS does not survive |
| Payload privacy | normal viewer payloads do not leak raw storage keys, private coordinates, or internal identifiers |
| Stamp content | a live stamp retains at least one allowed content item |
| Photo limit/order | up to six photos, stable ordering/layout behavior |
| Removal | hidden/removed content follows retention rules rather than accidental hard deletion |
| Age gate | eligibility and no-underage-storage behavior remain consistent with current policy/tests |
| Contract | every mobile-used route matches `src/contracts/api.ts` and the mobile copy is synchronized |
| Social flag | legacy social/admin behavior does not bypass personal-mode privacy when disabled |

## Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Use focused tests while iterating. Do not reuse old pass counts as evidence for a new change.

## Current privacy questions

The backend currently retains submitted stamp coordinates as an audit record while excluding them from normal viewer payloads. Whether to retain those coordinates long-term is a product/legal decision tracked in `../OPEN-QUESTIONS.md`.

Photo Library validation happens in the mobile app before upload. Regardless of source, the backend/upload path must continue to strip metadata from the image it stores.
