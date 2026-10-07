# Backend decisions

This file summarizes current backend decisions. Earlier build-session detail remains available in Git history and dated reviews/deliveries.

## Product and privacy

- Current product mode is personal and owner-only.
- Legacy social functionality may remain behind `SOCIAL_ENABLED`, but disabled personal mode must not expose another person's passport data.
- Geofence acceptance is enforced by the server, not trusted solely to client UI.
- A stamp can contain photos, caption, song metadata, or a combination, subject to existing live-content constraints.
- Up to six photos are accepted at stamp creation. Photo layout/removal behavior follows the current contract.
- Uploaded images are re-encoded so original EXIF/GPS does not survive storage.
- Normal viewer payloads must not expose raw storage keys, private coordinates, or internal user identifiers.
- Hidden/removed content follows the existing retention/moderation rules rather than being silently hard-deleted.

## Data model

- Historical table names such as `photo` and `venue` remain for migration stability; API/UI terminology is stamp and place.
- Schema changes use forward migrations.
- Destructive reset commands are only for disposable local development databases.
- Contract changes originate in `src/contracts/api.ts` and require the mobile copy to be synchronized.

## Photos and location

- The backend cannot determine whether an accepted upload originated from the native camera or Photo Library. Client-side source/metadata validation is a mobile concern.
- Regardless of source, server/upload processing continues to strip metadata and enforce photo/content limits.
- The backend currently retains submitted stamp coordinates as an audit record of the geofence check while excluding them from normal viewer payloads.
- Long-term coordinate retention/disclosure is still a product/legal question tracked in `../OPEN-QUESTIONS.md`.

## Local development

Current committed defaults are backend port 3001 and Docker Postgres host port 5438. Older 3000/5435 and `build-codex` notes are historical.

## Policy questions

Final decisions about song metadata licensing, age-policy requirements, geolocation disclosures, Photo Library metadata disclosures, optional diagnostics, and final legal-page wording remain in `../OPEN-QUESTIONS.md`.
