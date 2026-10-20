-- Keep live-stamp content checks aligned with JavaScript String.trim semantics and
-- make child-photo removals conflict with stale repeatable-read parent edits.

CREATE OR REPLACE FUNCTION nostos_stamp_has_content() RETURNS trigger AS $$
DECLARE sid text;
DECLARE ok boolean;
BEGIN
  IF TG_TABLE_NAME = 'stamp_photo' THEN
    sid := NEW.stamp_id;
  ELSE
    sid := NEW.id;
  END IF;

  PERFORM 1 FROM photo WHERE id = sid FOR UPDATE;

  SELECT
    btrim(
      p.caption,
      E' \t\n\r\f' || chr(11) || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
    ) <> ''
    OR p.song_title IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM stamp_photo sp
      WHERE sp.stamp_id = p.id
        AND sp.removed_at IS NULL
    )
  INTO ok
  FROM photo p
  WHERE p.id = sid
    AND p.removed_at IS NULL;

  IF ok IS FALSE THEN
    RAISE EXCEPTION 'lastcall: a stamp needs a photo, a caption or a song'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION nostos_touch_stamp_parent_on_photo_removal() RETURNS trigger AS $$
BEGIN
  UPDATE photo
  SET id = id
  WHERE id = NEW.stamp_id
    AND removed_at IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stamp_photo_touch_parent_on_removal ON stamp_photo;
CREATE TRIGGER stamp_photo_touch_parent_on_removal
BEFORE UPDATE OF removed_at ON stamp_photo
FOR EACH ROW
WHEN (OLD.removed_at IS DISTINCT FROM NEW.removed_at)
EXECUTE FUNCTION nostos_touch_stamp_parent_on_photo_removal();
