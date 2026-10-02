# Review (mobile)

What a reviewer can verify without a device, and what needs one (`DEVICE-CHECKLIST.md`).

| Area | Where | Tests |
|---|---|---|
| Contract copy matches the backend | `src/api/contracts.ts` | `api/__tests__/contracts-sync.test.ts` (in the gate) |
| API client: auth, errors, forward compatibility, endpoints | `src/api/client.ts` | `api/__tests__/client.test.ts` |
| Feed, stamp detail, song picker never render blank | `app/(app)/(tabs)/index.tsx`, `stamp/*` | `features/stamps/__tests__/screens.test.tsx` |
| Composer rules (a photo, a caption or a song; fields sent; place choice; edits) | `features/stamps/composer.ts` | `features/stamps/__tests__/composer.test.ts` |
| "Checking account", never "Sign in" while loading | `auth/account-state.ts`, `features/account/account-gate.tsx` | `features/account/__tests__/account-gate.test.tsx` |
| 21+ gate (sign-up and guest), nothing stored or sent for under-21s | `lib/age.ts`, `app/age-gate.tsx`, `app/sign-up.tsx` | `lib/__tests__/age.test.ts`, `features/account/__tests__/age-gate-screens.test.tsx` |
| Going public confirm lists what changes | `features/people/edit-profile.ts` | `features/people/__tests__/edit-profile.test.ts` |
| Passport: limited view for private accounts, counts, tabs | `features/people/profile-screen.tsx` | `features/people/__tests__/profile.test.tsx` |
| Report and Block on every stamp; reasons incl. underage, stalking, not at this place | `features/moderation/content-actions.ts` | `features/moderation/__tests__/guideline-1-2.test.tsx`, `reasons.test.ts` |
| Account deletion | `app/(app)/settings/delete-account.tsx` | `features/people/__tests__/delete-account.test.tsx` |
| Km formatting ("1.8 km", never "1815 m") | `lib/format.ts` | `lib/__tests__/format.test.ts` |
| Error reporter off by default, no DSN committed, scrubbed | `lib/report-error.ts` | `lib/__tests__/report-error.test.ts` |
| Design tokens only, no emoji | `eslint-rules/` | `eslint-rules/__tests__/rules.test.js`, lint is part of the gate |

Needs a physical iPhone: camera and library, location permission and the geofence in the real world, the map view, the
native action sheets and alerts, keyboard behavior, and the flows in `DEVICE-CHECKLIST.md`.
