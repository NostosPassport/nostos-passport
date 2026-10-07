# Mobile review map

This is the current review guide. Historical test counts and the old custom-camera/social/guest flows are intentionally omitted.

| Area | Current implementation | Review focus |
|---|---|---|
| Root auth routing | `src/app/_layout.tsx` | signed-out users get sign-in/sign-up; no guest preview route |
| Main tabs | `src/app/(app)/(tabs)/_layout.tsx` | Passport, Stamp, Map in personal mode |
| Stamp composer | `src/app/(app)/stamp/new.tsx`, `src/features/stamps/*` | geofence state, draft content, submit/retry |
| Photo manager | `src/app/(app)/stamp/camera.tsx` | accepted list, viewer, remove, six-photo limit |
| Native camera/library | `src/features/photos/pick.ts` | system camera and system Photo Library |
| Library validation | `src/features/photos/validate-library.ts` | screenshot/source/location/time scoring and rejection |
| Photo preparation | `src/features/photos/prepare.ts` | prepared image, EXIF/GPS removal |
| Watermark | `src/features/photos/watermark.ts` | camera-only watermark placement/opacity |
| Save to Photos | `src/features/photos/save-camera-photo.ts` | add-only permission and failure handling |
| Passport/book | `src/features/book/*` | page state, navigation, 3D/2D handoff, accessibility |
| Map/place | `src/features/map/*`, `src/features/place/*` | runtime data, location, attribution, geofence UI |
| Theme | `src/theme/midnight.ts` | Editorial values despite legacy module/token names |
| API contract | `src/api/contracts.ts` | must stay synchronized with backend |

## Current design review

Only Figma pages 9 and 10 are current. Do not review implementation against earlier black/silver or black/brass screens unless the user explicitly asks for historical comparison.

## Automated validation

For implementation changes, run:

```bash
npm run check
```

Use focused tests while iterating. Contract-changing backend work also requires the contract sync workflow.

## Device-only evidence

Automated tests cannot prove native camera presentation, Photo Library metadata availability across real assets, Photos permission behavior, real-world geofence boundaries, 3D/animation performance, haptics, VoiceOver, keyboard avoidance, safe-area behavior, or visual fidelity to Figma. Use `DEVICE-CHECKLIST.md` for those claims.
