-- AlterTable
ALTER TABLE "photo" ADD COLUMN     "creation_transaction" TEXT NOT NULL DEFAULT txid_current()::text;


-- Server time and xmin are insufficient: an update changes xmin, and a caller can supply created_at.
-- Capture the actual creation transaction in an immutable column, forced by the database.
CREATE FUNCTION nostos_stamp_creation_transaction() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.creation_transaction := txid_current()::text;
  ELSIF NEW.creation_transaction IS DISTINCT FROM OLD.creation_transaction THEN
    RAISE EXCEPTION 'lastcall: the stamp creation transaction is immutable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER photo_creation_transaction BEFORE INSERT OR UPDATE ON photo
  FOR EACH ROW EXECUTE FUNCTION nostos_stamp_creation_transaction();

CREATE FUNCTION nostos_stamp_photo_creation_only() RETURNS trigger AS $$
DECLARE creation_tx text;
BEGIN
  SELECT creation_transaction INTO creation_tx FROM photo WHERE id = NEW.stamp_id FOR UPDATE;
  IF creation_tx IS DISTINCT FROM txid_current()::text THEN
    RAISE EXCEPTION 'lastcall: photos can only be attached when creating a stamp' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER stamp_photo_creation_only BEFORE INSERT ON stamp_photo
  FOR EACH ROW EXECUTE FUNCTION nostos_stamp_photo_creation_only();
