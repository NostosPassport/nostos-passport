-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'VENUE_OWNER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('VIBE', 'LINE', 'COVER');

-- CreateEnum
CREATE TYPE "Vibe" AS ENUM ('PACKED', 'BUSY', 'CHILL', 'DEAD');

-- CreateEnum
CREATE TYPE "LineWait" AS ENUM ('NONE', 'UNDER_10', 'TEN_TO_30', 'OVER_30');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('PHOTO', 'COMMENT', 'REPORT');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('FLAGGED', 'AUTO_HIDE', 'HIDE', 'DISMISS');

-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "reputation_updated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "hours" JSONB NOT NULL,
    "official_cover_cents" INTEGER,
    "dress_code" TEXT,
    "official_photo_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_cover_history" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "cover_cents" INTEGER,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "changed_by_id" TEXT,

    CONSTRAINT "venue_cover_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_claim" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "vibe" "Vibe",
    "line" "LineWait",
    "cover_cents" INTEGER,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hidden_at" TIMESTAMPTZ(3),

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hidden_at" TIMESTAMPTZ(3),

    CONSTRAINT "photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "is_venue_reply" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(3),
    "hidden_at" TIMESTAMPTZ(3),

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presence" (
    "user_id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "presence_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "rsvp" (
    "user_id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "night" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rsvp_pkey" PRIMARY KEY ("user_id","venue_id","night")
);

-- CreateTable
CREATE TABLE "follow" (
    "follower_id" TEXT NOT NULL,
    "followee_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_pkey" PRIMARY KEY ("follower_id","followee_id")
);

-- CreateTable
CREATE TABLE "flag" (
    "id" TEXT NOT NULL,
    "target_type" "ContentType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "flagger_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FlagStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_event" (
    "id" TEXT NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "target_type" "ContentType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_handle_key" ON "app_user"("handle");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "venue_slug_key" ON "venue"("slug");

-- CreateIndex
CREATE INDEX "venue_cover_history_venue_id_effective_from_idx" ON "venue_cover_history"("venue_id", "effective_from");

-- CreateIndex
CREATE INDEX "venue_claim_user_id_status_idx" ON "venue_claim"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "venue_claim_venue_id_user_id_key" ON "venue_claim"("venue_id", "user_id");

-- CreateIndex
CREATE INDEX "promo_venue_id_ends_at_idx" ON "promo"("venue_id", "ends_at");

-- CreateIndex
CREATE INDEX "report_venue_id_type_created_at_idx" ON "report"("venue_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "report_user_id_venue_id_type_created_at_idx" ON "report"("user_id", "venue_id", "type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "photo_storage_key_key" ON "photo"("storage_key");

-- CreateIndex
CREATE INDEX "photo_venue_id_created_at_idx" ON "photo"("venue_id", "created_at");

-- CreateIndex
CREATE INDEX "comment_venue_id_created_at_idx" ON "comment"("venue_id", "created_at");

-- CreateIndex
CREATE INDEX "presence_venue_id_last_seen_at_idx" ON "presence"("venue_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "rsvp_venue_id_night_idx" ON "rsvp"("venue_id", "night");

-- CreateIndex
CREATE INDEX "follow_followee_id_idx" ON "follow"("followee_id");

-- CreateIndex
CREATE INDEX "flag_status_created_at_idx" ON "flag"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "flag_target_type_target_id_flagger_id_key" ON "flag"("target_type", "target_id", "flagger_id");

-- CreateIndex
CREATE INDEX "moderation_event_target_type_target_id_idx" ON "moderation_event"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_cover_history" ADD CONSTRAINT "venue_cover_history_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_cover_history" ADD CONSTRAINT "venue_cover_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_claim" ADD CONSTRAINT "venue_claim_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_claim" ADD CONSTRAINT "venue_claim_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_claim" ADD CONSTRAINT "venue_claim_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo" ADD CONSTRAINT "promo_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo" ADD CONSTRAINT "promo_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence" ADD CONSTRAINT "presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence" ADD CONSTRAINT "presence_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp" ADD CONSTRAINT "rsvp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvp" ADD CONSTRAINT "rsvp_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow" ADD CONSTRAINT "follow_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow" ADD CONSTRAINT "follow_followee_id_fkey" FOREIGN KEY ("followee_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag" ADD CONSTRAINT "flag_flagger_id_fkey" FOREIGN KEY ("flagger_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_event" ADD CONSTRAINT "moderation_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written guarantees (invariant 5): moderation_event is append-only and
-- user content is hidden, never deleted. Row-level DELETE/UPDATE triggers do
-- not fire on TRUNCATE, so `prisma migrate reset` and the test harness still work.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lastcall_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'lastcall: % on % is not allowed (%)', TG_OP, TG_TABLE_NAME, TG_ARGV[0]
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER moderation_event_no_update BEFORE UPDATE ON "moderation_event"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('moderation log is append-only');
CREATE TRIGGER moderation_event_no_delete BEFORE DELETE ON "moderation_event"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('moderation log is append-only');
CREATE TRIGGER venue_cover_history_no_update BEFORE UPDATE ON "venue_cover_history"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('cover history is append-only');
CREATE TRIGGER venue_cover_history_no_delete BEFORE DELETE ON "venue_cover_history"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('cover history is append-only');
CREATE TRIGGER report_no_delete BEFORE DELETE ON "report"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('hide user content instead of deleting it');
CREATE TRIGGER photo_no_delete BEFORE DELETE ON "photo"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('hide user content instead of deleting it');
CREATE TRIGGER comment_no_delete BEFORE DELETE ON "comment"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('hide user content instead of deleting it');

-- Once hidden, content stays hidden (un-hiding would need its own audited action; not in scope).
CREATE OR REPLACE FUNCTION lastcall_hidden_is_sticky() RETURNS trigger AS $$
BEGIN
  IF OLD.hidden_at IS NOT NULL AND NEW.hidden_at IS DISTINCT FROM OLD.hidden_at THEN
    RAISE EXCEPTION 'lastcall: hidden_at on % cannot be cleared or changed', TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_hidden_sticky BEFORE UPDATE ON "report" FOR EACH ROW EXECUTE FUNCTION lastcall_hidden_is_sticky();
CREATE TRIGGER photo_hidden_sticky BEFORE UPDATE ON "photo" FOR EACH ROW EXECUTE FUNCTION lastcall_hidden_is_sticky();
CREATE TRIGGER comment_hidden_sticky BEFORE UPDATE ON "comment" FOR EACH ROW EXECUTE FUNCTION lastcall_hidden_is_sticky();

-- Sanity checks on values.
ALTER TABLE "app_user" ADD CONSTRAINT app_user_reputation_range CHECK (reputation >= 0.2 AND reputation <= 1.5);
ALTER TABLE "report" ADD CONSTRAINT report_value_matches_type CHECK (
  (type = 'VIBE'  AND vibe IS NOT NULL AND line IS NULL AND cover_cents IS NULL) OR
  (type = 'LINE'  AND line IS NOT NULL AND vibe IS NULL AND cover_cents IS NULL) OR
  (type = 'COVER' AND cover_cents IS NOT NULL AND cover_cents >= 0 AND vibe IS NULL AND line IS NULL)
);
ALTER TABLE "venue" ADD CONSTRAINT venue_official_cover_nonneg CHECK (official_cover_cents IS NULL OR official_cover_cents >= 0);
ALTER TABLE "promo" ADD CONSTRAINT promo_window CHECK (ends_at > starts_at);
