-- Strip Last Call features that Nostos does not keep: live reports, comments, presence, RSVPs, promos, claims,
-- cover history, nightly featuring. Forward-only: the hand-written trigger history above stays valid.
-- ContentType keeps its COMMENT and REPORT values on purpose: the append-only moderation_event log may reference them.
UPDATE "app_user" SET "role" = 'USER' WHERE "role" = 'VENUE_OWNER';


-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('USER', 'MODERATOR', 'ADMIN');
ALTER TABLE "public"."app_user" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "app_user" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "app_user" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- DropForeignKey
ALTER TABLE "comment" DROP CONSTRAINT "comment_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "comment" DROP CONSTRAINT "comment_user_id_fkey";

-- DropForeignKey
ALTER TABLE "comment" DROP CONSTRAINT "comment_venue_id_fkey";

-- DropForeignKey
ALTER TABLE "featured_photo" DROP CONSTRAINT "featured_photo_night_fkey";

-- DropForeignKey
ALTER TABLE "featured_photo" DROP CONSTRAINT "featured_photo_photo_id_fkey";

-- DropForeignKey
ALTER TABLE "featured_photo" DROP CONSTRAINT "featured_photo_venue_id_fkey";

-- DropForeignKey
ALTER TABLE "presence" DROP CONSTRAINT "presence_user_id_fkey";

-- DropForeignKey
ALTER TABLE "presence" DROP CONSTRAINT "presence_venue_id_fkey";

-- DropForeignKey
ALTER TABLE "promo" DROP CONSTRAINT "promo_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "promo" DROP CONSTRAINT "promo_venue_id_fkey";

-- DropForeignKey
ALTER TABLE "report" DROP CONSTRAINT "report_user_id_fkey";

-- DropForeignKey
ALTER TABLE "report" DROP CONSTRAINT "report_venue_id_fkey";

-- DropForeignKey
ALTER TABLE "rsvp" DROP CONSTRAINT "rsvp_user_id_fkey";

-- DropForeignKey
ALTER TABLE "rsvp" DROP CONSTRAINT "rsvp_venue_id_fkey";

-- DropForeignKey
ALTER TABLE "venue_claim" DROP CONSTRAINT "venue_claim_reviewed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "venue_claim" DROP CONSTRAINT "venue_claim_user_id_fkey";

-- DropForeignKey
ALTER TABLE "venue_claim" DROP CONSTRAINT "venue_claim_venue_id_fkey";

-- DropForeignKey
ALTER TABLE "venue_cover_history" DROP CONSTRAINT "venue_cover_history_changed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "venue_cover_history" DROP CONSTRAINT "venue_cover_history_venue_id_fkey";

-- DropIndex
DROP INDEX "block_ref_key";

-- AlterTable
ALTER TABLE "app_user" DROP COLUMN "reputation_updated_at";

-- AlterTable
ALTER TABLE "block" DROP COLUMN "ref",
DROP COLUMN "source";

-- AlterTable
ALTER TABLE "venue" DROP COLUMN "dress_code",
DROP COLUMN "hours",
DROP COLUMN "official_cover_cents",
DROP COLUMN "official_photo_key",
ADD COLUMN     "geofence_meters" INTEGER NOT NULL DEFAULT 100;

-- DropTable
DROP TABLE "comment";

-- DropTable
DROP TABLE "featured_photo";

-- DropTable
DROP TABLE "featured_run";

-- DropTable
DROP TABLE "presence";

-- DropTable
DROP TABLE "promo";

-- DropTable
DROP TABLE "report";

-- DropTable
DROP TABLE "rsvp";

-- DropTable
DROP TABLE "venue_claim";

-- DropTable
DROP TABLE "venue_cover_history";

-- DropEnum
DROP TYPE "ClaimStatus";

-- DropEnum
DROP TYPE "LineWait";

-- DropEnum
DROP TYPE "ReportType";

-- DropEnum
DROP TYPE "Vibe";

-- Trigger functions that only served the dropped tables.
DROP FUNCTION IF EXISTS lastcall_report_immutable();
DROP FUNCTION IF EXISTS lastcall_comment_immutable();
DROP FUNCTION IF EXISTS lastcall_featured_run_guard();
DROP FUNCTION IF EXISTS lastcall_featured_photo_guard();
