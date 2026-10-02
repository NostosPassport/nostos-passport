-- AlterEnum
ALTER TYPE "ContentType" ADD VALUE 'USER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModerationAction" ADD VALUE 'SUSPEND';
ALTER TYPE "ModerationAction" ADD VALUE 'UNSUSPEND';

-- DropForeignKey
ALTER TABLE "flag" DROP CONSTRAINT "flag_venue_id_fkey";

-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "suspended_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "comment" ADD COLUMN     "countable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "flag" ALTER COLUMN "venue_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "photo" ADD COLUMN     "countable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "presence" ADD COLUMN     "countable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "report" ADD COLUMN     "countable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "rsvp" ADD COLUMN     "countable" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "flag" ADD CONSTRAINT "flag_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill the write-time snapshot from each author's current exemption.
UPDATE "report" r SET countable = NOT u.geofence_exempt FROM "app_user" u WHERE u.id = r.user_id AND u.geofence_exempt;
UPDATE "photo" p SET countable = NOT u.geofence_exempt FROM "app_user" u WHERE u.id = p.user_id AND u.geofence_exempt;
UPDATE "comment" c SET countable = NOT u.geofence_exempt FROM "app_user" u WHERE u.id = c.user_id AND u.geofence_exempt;
UPDATE "presence" x SET countable = NOT u.geofence_exempt FROM "app_user" u WHERE u.id = x.user_id AND u.geofence_exempt;
UPDATE "rsvp" x SET countable = NOT u.geofence_exempt FROM "app_user" u WHERE u.id = x.user_id AND u.geofence_exempt;

-- The snapshot is part of the immutable record for reports and photos: once written it never changes.
CREATE OR REPLACE FUNCTION lastcall_countable_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.countable IS DISTINCT FROM OLD.countable THEN
    RAISE EXCEPTION 'lastcall: countable on % is a write-time snapshot and cannot change', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER report_countable_immutable BEFORE UPDATE OF countable ON "report" FOR EACH ROW EXECUTE FUNCTION lastcall_countable_immutable();
CREATE TRIGGER photo_countable_immutable BEFORE UPDATE OF countable ON "photo" FOR EACH ROW EXECUTE FUNCTION lastcall_countable_immutable();
CREATE TRIGGER comment_countable_immutable BEFORE UPDATE OF countable ON "comment" FOR EACH ROW EXECUTE FUNCTION lastcall_countable_immutable();
