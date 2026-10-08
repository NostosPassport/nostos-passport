-- Remove the dormant social/moderation schema. Nostos is owner-only.

DROP TRIGGER IF EXISTS app_user_no_verified_insert ON "app_user";
DROP TRIGGER IF EXISTS app_user_verified_logged ON "app_user";

DROP TABLE IF EXISTS "photo_like";
DROP TABLE IF EXISTS "follow_request";
DROP TABLE IF EXISTS "follow";
DROP TABLE IF EXISTS "block";
DROP TABLE IF EXISTS "flag";
DROP TABLE IF EXISTS "moderation_event";
DROP TABLE IF EXISTS "verification_event";

ALTER TABLE "app_user"
  DROP COLUMN IF EXISTS "role",
  DROP COLUMN IF EXISTS "reputation",
  DROP COLUMN IF EXISTS "suspended_at",
  DROP COLUMN IF EXISTS "is_private",
  DROP COLUMN IF EXISTS "verified_at";

ALTER TABLE "photo" DROP COLUMN IF EXISTS "hidden_at";

DELETE FROM "rate_event" WHERE kind NOT IN ('post', 'song_search');
ALTER TABLE "rate_event" DROP CONSTRAINT IF EXISTS rate_event_kind;
ALTER TABLE "rate_event" ADD CONSTRAINT rate_event_kind CHECK (kind IN ('post', 'song_search'));

DROP FUNCTION IF EXISTS lastcall_no_verified_insert();
DROP FUNCTION IF EXISTS lastcall_verified_needs_event();
DROP FUNCTION IF EXISTS lastcall_follow_clears_request();
DROP FUNCTION IF EXISTS lastcall_like_guard();

-- The existing lastcall_photo_immutable() trigger function remains valid after hidden_at is removed:
-- it already permits only caption/song/edit metadata and final removed_at changes while protecting
-- identity, place, coordinates, timestamp, rating, storage identity and countable.

DROP TYPE IF EXISTS "VerificationAction";
DROP TYPE IF EXISTS "ModerationAction";
DROP TYPE IF EXISTS "FlagStatus";
DROP TYPE IF EXISTS "FlagCategory";
DROP TYPE IF EXISTS "ContentType";
DROP TYPE IF EXISTS "Role";
