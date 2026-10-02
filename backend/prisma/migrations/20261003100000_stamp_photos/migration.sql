-- Multi-photo stamps: up to 6 photos per stamp, each with an optional scrapbook layout. Existing stamp photos are backfilled.

-- CreateTable
CREATE TABLE "stamp_photo" (
    "id" TEXT NOT NULL,
    "stamp_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "position" SMALLINT NOT NULL,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "rotation" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMPTZ(3),

    CONSTRAINT "stamp_photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stamp_photo_storage_key_key" ON "stamp_photo"("storage_key");

-- CreateIndex
CREATE INDEX "stamp_photo_stamp_id_position_idx" ON "stamp_photo"("stamp_id", "position");

-- AddForeignKey
ALTER TABLE "stamp_photo" ADD CONSTRAINT "stamp_photo_stamp_id_fkey" FOREIGN KEY ("stamp_id") REFERENCES "photo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Shape of a photo row.
ALTER TABLE "stamp_photo" ADD CONSTRAINT stamp_photo_position CHECK (position BETWEEN 0 AND 5);
ALTER TABLE "stamp_photo" ADD CONSTRAINT stamp_photo_layout CHECK (
  (x IS NULL OR x BETWEEN 0 AND 1) AND (y IS NULL OR y BETWEEN 0 AND 1) AND (rotation IS NULL OR rotation BETWEEN -45 AND 45)
);

-- At most 6 live photos per stamp. The parent row is locked so two inserts can't both pass the count.
CREATE OR REPLACE FUNCTION lastcall_stamp_photo_limit() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "photo" WHERE id = NEW.stamp_id FOR UPDATE;
  IF (SELECT count(*) FROM "stamp_photo" WHERE stamp_id = NEW.stamp_id AND removed_at IS NULL) >= 6 AND NEW.removed_at IS NULL THEN
    RAISE EXCEPTION 'lastcall: a stamp holds at most 6 photos' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER stamp_photo_limit BEFORE INSERT ON "stamp_photo" FOR EACH ROW EXECUTE FUNCTION lastcall_stamp_photo_limit();

-- Hidden, never deleted. The file, the stamp and the time are fixed; only the layout and removed_at (final) change.
CREATE TRIGGER stamp_photo_no_delete BEFORE DELETE ON "stamp_photo"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('hide user content instead of deleting it');
CREATE OR REPLACE FUNCTION lastcall_stamp_photo_immutable() RETURNS trigger AS $$
BEGIN
  IF (NEW.id, NEW.stamp_id, NEW.storage_key, NEW.mime_type, NEW.created_at) IS DISTINCT FROM (OLD.id, OLD.stamp_id, OLD.storage_key, OLD.mime_type, OLD.created_at) THEN
    RAISE EXCEPTION 'lastcall: stamp photos are immutable except their layout and removal' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.removed_at IS NOT NULL AND NEW.removed_at IS DISTINCT FROM OLD.removed_at THEN
    RAISE EXCEPTION 'lastcall: a removed photo stays removed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER stamp_photo_immutable BEFORE UPDATE ON "stamp_photo" FOR EACH ROW EXECUTE FUNCTION lastcall_stamp_photo_immutable();

-- Backfill: every existing stamp photo becomes position 0 of its stamp.
INSERT INTO "stamp_photo" (id, stamp_id, storage_key, mime_type, position, created_at)
SELECT 'bf_' || id, id, storage_key, mime_type, 0, created_at FROM "photo" WHERE storage_key IS NOT NULL;
