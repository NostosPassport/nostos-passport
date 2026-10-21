# Approved square-photo stamp study — restaurant and bar

Source: user-uploaded, 1536 × 1024 PNG, 20 October 2026. The uploaded binary is in the design conversation, not yet included in this GitHub checkout. This is a measurement/implementation note, **not a substitute for the unmodified reference**.

The approved examples are the **top-left green Italian restaurant** and **bottom-right burgundy bar/club**. The top-right airport and bottom-left hotel examples remain out of scope.

## Geometry in shared SVG coordinates

- Restaurant: 260 × 154, white interior, double rounded-rectangle dark-green ink border. Square photo at (22,21) with side 110; venue title centered in the right text column at x=194. A small cuisine icon and label precede locality and date.
- Bar/club: 160 × 160, white interior, double circular burgundy ink border. Square photo at (41,43) with side 78; short title follows an upper arc, while long names use a bounded straight-line fallback. A simple glass or music icon appears to the right of the photo.
- Geometry, text, photos, and SVG definitions remain independent. Repeated instances use unique React IDs. The same shared coordinates drive Expo and shared-web renderers; raster visitor photos are clipped but never vectorized.
- Dates are rendered in New York local calendar order (day, abbreviated month, year).
- The reference depicts a price tier and a Michelin-like mark. The app does not possess an authoritative source of either, so neither is rendered. Do not fabricate them.
- The print texture and exact generated typeface remain approximate: the implementation retains smooth vector borders, Cormorant Garamond in native and Georgia in web. These are **not an exact font match**.

## Scope, stability and verification

This is an adjustment on the **unreleased** `codex/stamp-category-templates` feature branch. It preserves the current `category-ink/1` contract and does not rewrite the historical stamp renderer, visits, geofence verification, photo ordering, collections or map provider.

The category descriptor is still computed on demand from stored venue metadata rather than persisted on the stamp. Changes to that metadata can change the appearance of prior visits. Persisting immutable/versioned artwork requires additional work before production.

Local preview: run the backend in development and open `/dev/stamp-templates`. The reference photo is not used as production artwork, and the preview does not substitute stock photos. Full Expo/iOS parity and visual sign-off against the uploaded image remain to be verified.
