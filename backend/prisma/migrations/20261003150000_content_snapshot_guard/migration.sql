-- This is an empty migration.


-- Locking alone does not advance the parent version. A repeatable-read caption edit could otherwise
-- retain an old snapshot of the children after waiting for a photo removal to commit.
-- A no-op update serializes READ COMMITTED and causes older repeatable-read snapshots to abort.
CREATE OR REPLACE FUNCTION nostos_lock_stamp_photo_parent() RETURNS trigger AS $$
BEGIN
  UPDATE photo SET edited_at = edited_at WHERE id = NEW.stamp_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
