# Category ink stamps — feature branch

Design reference: **approved white mockup not present in GitHub** at implementation time. This is a working specified-geometry implementation awaiting visual sign-off. No hotel or airport designs.

- `shared/category-stamp-artwork.ts`: deterministic classification and SVG path primitives (version `category-ink/1`), original cuisine icons and bounded name layout. Stable venue ID plus stored metadata is the input. No user, timestamp, image or random input affects the frame.
- Backend resolves `artwork` from persisted `venue.category`, `venue.cuisines` and `venue.googlePrimaryType` into an optional, strict `StampView.artwork` field. Null means unsupported legacy places. The primary specific Google type beats generic tags, otherwise an explicit fixed cuisine priority resolves conflicts. Bar/club category beats food tags. Unknown restaurant cuisine is neutral.
- Expo `CategoryStampMark` uses `react-native-svg`; web `CategoryStampSvg` uses the same coordinates, frame paths, icon paths and name layout. Photos stay raster and use the first **live, ordered** stamp photo, with a lightly irregular square clipping path. React instance IDs isolate masks for repeats. No stock images.
- Price and Michelin marks are intentionally absent: no trusted data is available, and the client cannot assert an award.
- **Versioning limitation:** category rendering is derived from current trusted venue metadata in each response, so changing that metadata or deploying a new renderer can alter the frame for an existing visit. The descriptor has a version, but its value is not yet pinned durably per stamp; strict permanent historical immutability will require explicit storage/version persistence before rollout. Old null-category records continue using the existing renderer.
- `backend/src/app/dev/stamp-templates`: local-only preview using the production shared web component; production returns 404.
- Run: `cd backend && pnpm install && pnpm dev`, open `http://localhost:3001/dev/stamp-templates`; then `pnpm typecheck && pnpm lint && pnpm test:unit`.
- Expo: `cd mobile && npm install && npm run check && npx expo start --go`. Native iPhone rendering still requires a device pass, especially `SvgImage` cover crops.
- Only user-selected collections remain publicly shareable and use the pre-existing authorization gate. Shared rendering consumes already-authorized photo URLs; no storage keys or coordinates are exposed.
- The map retains its compact marker for legibility. Non-Latin fallback depends on OS font availability; at the lower readability bound extremely long names truncate visually but remain complete in accessible names and detail views.
