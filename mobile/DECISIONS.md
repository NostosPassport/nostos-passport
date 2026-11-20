# Mobile decisions

This file contains the current mobile decisions. Older session-specific decisions are preserved in Git history and dated reviews/deliveries rather than repeated as current instructions.

## Product mode

- Nostos is currently a personal, owner-only product.
- Signed-out users sign in or create an account. The old `Look around first` guest preview is removed from scope.
- Production navigation is Passport, Stamp, and Map. The Passport also exposes the master stamp gallery.
- Pinned stamps are removed from the product and active architecture.

## Photo flow

- Stamp photos are not camera-only anymore.
- `stamp/camera.tsx` is a photo manager, not a live custom camera.
- Take Photo launches the native iOS camera through `expo-image-picker`.
- Choose from Photo Library is supported.
- Photo Library images are memories attached to the visit and are not rejected based on EXIF GPS, timestamp, source application, screenshot status, or editing software.
- Accepted images are prepared for upload and EXIF/GPS is stripped from the uploaded representation.
- Camera captures receive the Nostos watermark.
- The app attempts to save an accepted camera capture to Photos using add-only permission; failure to save the extra copy does not remove the draft photo.
- Six photos remains the maximum.
- `expo-camera` remains in the package manifest as a legacy dependency, but the current stamp flow does not use `CameraView`. Remove it only as a dedicated dependency/lockfile cleanup.

## Design

- Only Figma pages 9 and 10 are current design authority.
- Earlier black/silver and black/brass work is historical.
- The active design language is editorial cream paper, dark ink, and electric blue.
- `src/theme/editorial.ts` is the current theme module.
- The default app background is `#F3EFE5`; lighter raised paper is `#F7F4EE`; electric blue is `#123BFF`.

## Location and privacy

- The server remains authoritative for geofence acceptance.
- Prepared uploaded images do not keep their original EXIF/GPS metadata.
- Camera, Photo Library, Photos-add, and Location permissions must fail gracefully and remain recoverable.
- Coordinate retention and final privacy/legal wording remain open questions in `../OPEN-QUESTIONS.md`.

## Engineering

- Expo SDK 58 documentation is the API authority.
- Native behavior is configured through Expo config rather than hand-editing generated iOS/Android projects.
- `npm run check` is the standard mobile validation command for implementation changes.
- Dated reviews/test counts are historical evidence, not reusable proof for a new change.
