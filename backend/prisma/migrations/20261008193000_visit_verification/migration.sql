-- Visit dates and optional location verification.
-- A stamp may represent a visit from the last year. Only a "now" stamp can be verified,
-- and the raw coordinates used for the geofence check are not retained.

DROP TRIGGER IF EXISTS photo_immutable ON "photo";
DROP FUNCTION IF EXISTS lastcall_photo_immutable();

-- Photos are now editable after stamp creation.
DROP TRIGGER IF EXISTS stamp_photo_creation_only ON "stamp_photo";
DROP FUNCTION IF EXISTS nostos_stamp_photo_creation_only();

ALTER TABLE "photo"
  ADD COLUMN "visited_at" TIMESTAMPTZ(3),
  ADD COLUMN "verified_at" TIMESTAMPTZ(3),
  ALTER COLUMN "lat" DROP NOT NULL,
  ALTER COLUMN "lng" DROP NOT NULL;

-- Existing normal stamps were geofence checked under the previous product rules.
-- App Review/QA stamps were countable=false and remain unverified.
UPDATE "photo"
SET "visited_at" = "created_at",
    "verified_at" = CASE WHEN "countable" THEN "created_at" ELSE NULL END,
    "lat" = NULL,
    "lng" = NULL;

ALTER TABLE "photo"
  ALTER COLUMN "visited_at" SET NOT NULL,
  ALTER COLUMN "visited_at" SET DEFAULT CURRENT_TIMESTAMP;

-- Verification coordinates are deliberately ephemeral. Enforce that invariant below the service layer too.
ALTER TABLE "photo" ADD CONSTRAINT photo_no_raw_coordinates CHECK (lat IS NULL AND lng IS NULL);

CREATE INDEX "photo_user_id_visited_at_idx" ON "photo"("user_id", "visited_at");
CREATE INDEX "photo_venue_id_visited_at_idx" ON "photo"("venue_id", "visited_at");

-- The old parent-row CHECK could not see appended stamp_photo rows. Replace it with deferred
-- cross-table checks so a stamp can be photo-only even when photos are added after creation.
ALTER TABLE "photo" DROP CONSTRAINT IF EXISTS photo_has_content;

CREATE OR REPLACE FUNCTION nostos_stamp_has_content() RETURNS trigger AS $$
DECLARE sid text;
DECLARE ok boolean;
BEGIN
  IF TG_TABLE_NAME = 'stamp_photo' THEN
    sid := NEW.stamp_id;
  ELSE
    sid := NEW.id;
  END IF;

  SELECT btrim(p.caption) <> '' OR p.song_title IS NOT NULL OR EXISTS (
    SELECT 1 FROM stamp_photo sp WHERE sp.stamp_id = p.id AND sp.removed_at IS NULL
  )
  INTO ok
  FROM photo p
  WHERE p.id = sid AND p.removed_at IS NULL;

  IF ok IS FALSE THEN
    RAISE EXCEPTION 'lastcall: a stamp needs a photo, a caption or a song' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER photo_has_content_deferred
AFTER INSERT OR UPDATE ON "photo"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION nostos_stamp_has_content();

CREATE CONSTRAINT TRIGGER stamp_photo_has_content_deferred
AFTER INSERT OR UPDATE ON "stamp_photo"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION nostos_stamp_has_content();

-- Identity/place/creation metadata remain immutable. The visit date may move, but a verified
-- visit can only lose verification: verification cannot be manufactured later by an edit.
CREATE OR REPLACE FUNCTION lastcall_photo_immutable() RETURNS trigger AS $$
BEGIN
  IF (NEW.id, NEW.user_id, NEW.venue_id, NEW.storage_key, NEW.mime_type, NEW.created_at, NEW.rating, NEW.countable, NEW.creation_transaction)
     IS DISTINCT FROM (OLD.id, OLD.user_id, OLD.venue_id, OLD.storage_key, OLD.mime_type, OLD.created_at, OLD.rating, OLD.countable, OLD.creation_transaction) THEN
    RAISE EXCEPTION 'lastcall: stamp identity and creation metadata are immutable' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.lat IS NOT NULL OR NEW.lng IS NOT NULL THEN
    RAISE EXCEPTION 'lastcall: raw visit coordinates are not retained' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.verified_at IS NULL AND NEW.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'lastcall: verification can only be established when a stamp is created' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.verified_at IS NOT NULL AND NEW.verified_at IS DISTINCT FROM OLD.verified_at AND NEW.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'lastcall: verification can only be preserved or removed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.verified_at IS NOT NULL
     AND (NEW.visited_at AT TIME ZONE 'America/New_York')::date <> (OLD.visited_at AT TIME ZONE 'America/New_York')::date
     AND NEW.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'lastcall: changing a verified visit day removes verification' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.removed_at IS NOT NULL AND NEW.removed_at IS DISTINCT FROM OLD.removed_at THEN
    RAISE EXCEPTION 'lastcall: a removed stamp stays removed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER photo_immutable BEFORE UPDATE ON "photo"
  FOR EACH ROW EXECUTE FUNCTION lastcall_photo_immutable();
