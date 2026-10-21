# Category-ink stamp repair · transparent interior override

## Design authority

The user-provided *Square Photo Study* is the approved composition reference for restaurants (horizontal rounded rectangle) and bars/clubs (circle). The restaurant and bar examples only are in scope. **This repair expressly overrides its white interior**: frame and photo-window backing are transparent, exposing actual passport paper or any web background. Borders, labels, icons and visitor photograph are still opaque ink/photo layers.

No hotel or airport implementation is included. No generated photo, price tier or Michelin award is used.

The supplied phone problem screenshots were not attached in the current development message/tool context and therefore **are not committed here**. The earlier approved mockup PNG also has not been copied as a tracked binary; the composition measurements remain in `design/references/square-photo-study/README.md`. Upload the unmodified original and phone screenshots to this directory to preserve visual evidence. Do not label phone screenshots as design authority.

## Rendering and layout

- Restaurant: 260×154, two open SVG rounded-rectangle strokes. Slightly irregular square visitor-photo clip at x22–132; right-aligned region for measured-bounds venue title, single cuisine icon, cuisine label, locality, NY visit date.
- Bar/club: 160×160 circular double ink border. Photo x43–117, y40–114 (74-square rather than 68-square). Centered short title and deliberately bounded two-line names rather than an unreliable curved iPhone SVG textPath. Date baseline 124, category baseline 134, locality baseline 143. WEST VILLAGE now fits in full, while extremely long localities can still truncate with the ellipsis width reserved. Accessibility retains the full original.
- Name wrapping still uses conservative *glyph-dependent* advance estimates, not exact OpenType metrics. Both renderers now constrain the final SVG glyph advance with `textLength` and `lengthAdjust=spacingAndGlyphs`, with a narrower upper line in circular stamps. This bounds text even when the installed font's natural metrics differ, at the cost of occasional visible horizontal compression. Confirm the actual result on iOS before sign-off.
- Expo uses the already installed Cormorant Garamond Semibold via `@/theme`. The web root now uses Next.js `next/font/google` for Cormorant Garamond 600 (OFL) with Latin and Latin Extended subsets, built into the production output. Clean builds require Google Fonts access. The font setup is implemented but native/browser raster parity is **not verified** in this environment.
- Photo URLs remain signed/validated; user photos are raster images covered into SVG with `preserveAspectRatio="xMidYMid slice"`. Missing photos use a transparent dotted photo outline. Blob object URLs are accepted *only* through the separate development preview property and not through public signed-photo handling.
- Unique `useId()` IDs keep repeated photo clips independent, even for two visits to the same venue. Legacy neutral stamps, CompletionStamp, and authentication flows are unchanged.

## Cuisine and icons

Classification uses explicit stored category, primaryType and cuisine tags. No venue-name/geographic/photo inference. Specific supported primary types win; otherwise the fixed documented priority resolves supported tags; generic service labels do not become cuisines.

| Cuisine family | SVG symbol | Ink |
| --- | --- | --- |
| Italian | pasta bowl | #143B2B |
| French | croissant | #385478 |
| American | burger | #526472 |
| Spanish | tapas dish | #95523C |
| Lebanese, Turkish | mezze bowl | #53704E, #8B594D |
| Mexican | taco | #A75435 |
| Japanese | sushi | #396D78 |
| Korean | grill | #895060 |
| Chinese | noodles | #9B4642 |
| Indian | curry bowl | #79508A |
| Greek, Mediterranean, Thai, Vietnamese | bowl | cuisine-specific blues/greens |
| Seafood, Portuguese | fish | cuisine-specific blues |
| Pizza | pizza slice | #AF4B39 |
| Bakery | bread | #97754C |
| Vegetarian | leaf | #4B7458 |
| Unknown restaurant | neutral restaurant icon | #4A514F |
| Bar, club | glass, music | #7C1030 |

Additional supported families remain in `shared/category-stamp-artwork.ts`. Exact cuisine label is always displayed alongside the icon. Backend primary bar/club types and map filtering now include nightclub types.

## Privacy, photo order and claims

The backend's existing filtered ordered `photos` selection remains untouched (nonremoved, then position, then creation time). The public/native stamp uses its first current signed URL; reordering/removing photos changes the thumbnail. The photo viewer and original photos remain available.

No price or Michelin marker is drawn: neither has an authoritative backend source. Nothing about geofence verification, collection sharing authorization or storage permissions was changed. The small blue `N` verification visual was already absent in the feature branch's native PageView; the shared-web overlay was removed too. Verification remains in accessibility/detail surfaces.

**Assignment permanence:** `category-ink/1` is still computed from current venue metadata for each stamp, so metadata or renderer changes may alter a historical visit's appearance. Before production, persist a versioned *venue-level* design assignment (venue ID + rule version + chosen category/icon/color + renderer version) in a forward migration, snapshot it for already issued stamps where needed, and make renderers dispatch by version. Do not infer permanence from deterministic rendering alone.

## Preview / QA

From `backend/`, use `pnpm install && pnpm dev`; visit `http://localhost:3001/dev/stamp-templates`. That dev-only page uses the production web renderer and supports a local visitor photo and three page colors. Its literal **120px preview is not the actual phone spread size**. `slotPlacement` sizes stamps to 40% of each page width: on a roughly 180px page, stamps are around 72px wide, so important metadata is still very small. The current two-page phone layout cannot guarantee readable 8px metadata without a larger presentation or zoom. Do not cite a 120px isolated preview as proof of legibility.

From `mobile/`, use `npm ci && npm run check`, then `npx expo start --go` for device comparison. Backend checks: `pnpm typecheck && pnpm lint && pnpm test`. Check portrait, landscape, group, and no photo, repeated visits, long/accented/non-Latin names, and date/locality at passport size. The development environment used for this commit did not have an app/iOS runtime, and this document does **not** assert device verification or side-by-side phone screenshots.

## October 20 review constraints and verification gap

The worldwide-place merge is preserved. The shared collection page previously dropped `stamp.artwork` when mapping stamp DTOs, causing web readers to use the legacy renderer; the new mapping includes it. Category stamps remain computed from mutable venue metadata rather than persisted, versioned assignments. Map/provider, geofence, sharing authorization and photo storage logic remain unchanged.

**Reference assets absent:** the approved PNG and phone defect screenshots still have not been provided as tracked binary files; do not call these stamps an exact design match. **Runtime evidence absent:** no native iPhone or simulator screenshots, no verified browser-versus-native comparison, and no locally executed backend/mobile checks were available to this connector-only change. The next review must run `pnpm typecheck && pnpm lint && pnpm test` in `backend/` and `npm run check` in `mobile/`, then capture both actual passport spreads and production-web stamps with the user's authorized real photos. Do not substitute Google Place or stock photographs.
