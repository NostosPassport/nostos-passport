# Backend decisions

This file summarizes current backend decisions. Earlier build-session detail remains available in Git history and dated reviews/deliveries.

## Product and privacy

- Current product mode is personal and private by default.
- User-created collections may be explicitly shared through signed, revocable, unlisted read-only web links. The master Passport cannot be shared and has no backend sharing primitive.
- A collection share is live rather than a snapshot: edits, reordering, additions, removals, and stamp deletion are reflected on the shared page.
- Disabling a link deletes its share record so the existing URL stops resolving immediately. Deleting a collection or account also disables access through relational cascade/account visibility rules.
- Shared collection pages are `noindex`/`nofollow` and require no Nostos account, but possession of the link is sufficient to view that collection until the owner disables it.
- A stamp is a visit memory. Users can create a `Now` stamp or a `Past` stamp.
- Visit verification is enforced by the server, not trusted solely to client UI.
- Location is optional. A Now stamp is verified only when submitted current coordinates are valid and inside the venue geofence; otherwise the stamp is still accepted as unverified.
- Past stamps are always unverified, can be dated up to one year back, and cannot use a future date.
- The backend does not retain the raw coordinates used to make a verification decision. It stores the visit date and optional verification timestamp instead.
- A stamp can contain photos, caption, song metadata, or a combination, subject to live-content constraints.
- Up to six live photos may be attached. Owners may append, remove, and rearrange photos after creation.
- Uploaded images are re-encoded so original EXIF/GPS does not survive storage.
- Normal and shared viewer payloads must not expose raw storage keys, precise verification coordinates, or internal user identifiers.
- Removed content follows the existing retention rules rather than being silently hard-deleted.

## Data model

- Historical table names such as `photo` and `venue` remain for migration stability; API/UI terminology is stamp and place.
- A `collection_share` row has a one-to-one relationship with a persisted `collection`. There is intentionally no nullable collection reference, generic passport share, or special master-Passport identifier.
- Public share URLs use a stable share-row ID plus an HMAC signature. The database does not store a reusable bearer URL/token in plaintext.
- `created_at` is the database creation time. `visited_at` is the user-facing visit chronology and controls Passport ordering/page placement.
- `verified_at` is non-null only when a Now visit was verified at creation. Editing the stamp to a different New York calendar day clears verification.
- Legacy `lat` and `lng` columns remain nullable for migration stability, but a database constraint requires them to be null.
- Schema changes use forward migrations.
- Destructive reset commands are only for disposable local development databases.
- Contract changes originate in backend contracts and matching mobile copies must be synchronized.

## Photos and location

- Nostos verifies visits, not individual photos.
- The backend does not need to know whether an accepted upload originated from the native camera or Photo Library.
- Photo Library images are not authenticity-gated by EXIF location, timestamp, source application, screenshot status, or editing software.
- Regardless of source, server/upload processing strips metadata and enforces image/content limits.
- Camera-capture watermarking is a client presentation feature and is distinct from visit verification.
- R2 stays private. Shared collection views authorize the requested collection first, then receive the same short-lived signed image URLs used elsewhere.

## Local development

Current committed defaults are backend port 3001 and Docker Postgres host port 5438. Older 3000/5435 and `build-codex` notes are historical.

## Policy questions

Final decisions about song metadata licensing, age-policy requirements, optional diagnostics, and any future social/discovery architecture remain in `../OPEN-QUESTIONS.md`. Collection link sharing itself is an approved product capability and is covered by the current privacy copy.
