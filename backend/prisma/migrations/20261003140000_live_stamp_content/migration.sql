-- This is an empty migration.

-- Generated schema diff is empty: cross-table constraints require hand-written PostgreSQL triggers.
-- The historical storage_key is immutable audit data, not evidence of a live photograph.
ALTER TABLE photo DROP CONSTRAINT photo_has_content;

CREATE FUNCTION nostos_check_stamp_content() RETURNS trigger AS $$
DECLARE stamp_id_to_check text;
DECLARE p record;
BEGIN
  IF TG_TABLE_NAME = 'photo' THEN stamp_id_to_check := NEW.id;
  ELSE stamp_id_to_check := NEW.stamp_id;
  END IF;
  SELECT caption, song_title, removed_at INTO p FROM photo WHERE id = stamp_id_to_check FOR UPDATE;
  IF FOUND AND p.removed_at IS NULL
     AND btrim(p.caption, E' \t\n\r\f' || chr(11) || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') = '' AND p.song_title IS NULL
     AND NOT EXISTS (SELECT 1 FROM stamp_photo WHERE stamp_id = stamp_id_to_check AND removed_at IS NULL) THEN
    RAISE EXCEPTION 'lastcall: photo_has_content: a stamp needs a photo, a caption or a song'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'photo_has_content';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Parent before children is the lock order for every service and database content mutation.
CREATE FUNCTION nostos_lock_stamp_photo_parent() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM photo WHERE id = NEW.stamp_id FOR UPDATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER stamp_photo_lock_parent BEFORE UPDATE ON stamp_photo
  FOR EACH ROW EXECUTE FUNCTION nostos_lock_stamp_photo_parent();

-- Deferred so parent + initial photographs, or photo removal + replacement caption, commit atomically.
CREATE CONSTRAINT TRIGGER photo_has_content AFTER INSERT OR UPDATE ON photo
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION nostos_check_stamp_content();
CREATE CONSTRAINT TRIGGER stamp_photo_has_content AFTER INSERT OR UPDATE ON stamp_photo
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION nostos_check_stamp_content();

-- Do not silently approve historical empty stamps or invent their content. Preserve them for explicit review.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM photo p WHERE p.removed_at IS NULL
      AND btrim(p.caption, E' \t\n\r\f' || chr(11) || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') = '' AND p.song_title IS NULL
      AND NOT EXISTS (SELECT 1 FROM stamp_photo sp WHERE sp.stamp_id = p.id AND sp.removed_at IS NULL)) THEN
    RAISE EXCEPTION 'lastcall: existing empty live stamps require review before migration' USING ERRCODE = 'check_violation';
  END IF;
END;
$$;
