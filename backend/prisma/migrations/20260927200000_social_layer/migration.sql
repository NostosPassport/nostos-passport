-- CreateEnum
CREATE TYPE "VerificationAction" AS ENUM ('GRANT', 'REVOKE');

-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "avatar_key" TEXT,
ADD COLUMN     "bio" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "is_private" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "verified_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "photo" ADD COLUMN     "edited_at" TIMESTAMPTZ(3),
ADD COLUMN     "night" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "rating" SMALLINT,
ADD COLUMN     "removed_at" TIMESTAMPTZ(3),
ADD COLUMN     "shared" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "follow_request" (
    "requester_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_request_pkey" PRIMARY KEY ("requester_id","target_id")
);

-- CreateTable
CREATE TABLE "photo_like" (
    "user_id" TEXT NOT NULL,
    "photo_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "photo_like_pkey" PRIMARY KEY ("user_id","photo_id")
);

-- CreateTable
CREATE TABLE "featured_photo" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "night" TEXT NOT NULL,
    "photo_id" TEXT NOT NULL,
    "rank" SMALLINT NOT NULL,
    "eligible_likes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "featured_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featured_run" (
    "night" TEXT NOT NULL,
    "ran_at" TIMESTAMPTZ(3) NOT NULL,
    "featured" INTEGER NOT NULL,

    CONSTRAINT "featured_run_pkey" PRIMARY KEY ("night")
);

-- CreateTable
CREATE TABLE "verification_event" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "VerificationAction" NOT NULL,
    "note" TEXT NOT NULL,
    "actor_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_event" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_request_target_id_created_at_idx" ON "follow_request"("target_id", "created_at");

-- CreateIndex
CREATE INDEX "photo_like_photo_id_idx" ON "photo_like"("photo_id");

-- CreateIndex
CREATE UNIQUE INDEX "featured_photo_photo_id_key" ON "featured_photo"("photo_id");

-- CreateIndex
CREATE INDEX "featured_photo_venue_id_night_idx" ON "featured_photo"("venue_id", "night");

-- CreateIndex
CREATE UNIQUE INDEX "featured_photo_venue_id_night_rank_key" ON "featured_photo"("venue_id", "night", "rank");

-- CreateIndex
CREATE INDEX "verification_event_user_id_created_at_idx" ON "verification_event"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "rate_event_user_id_kind_created_at_idx" ON "rate_event"("user_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "rate_event_created_at_idx" ON "rate_event"("created_at");

-- CreateIndex
CREATE INDEX "photo_venue_id_night_idx" ON "photo"("venue_id", "night");

-- CreateIndex
CREATE INDEX "photo_user_id_created_at_idx" ON "photo"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "follow_request" ADD CONSTRAINT "follow_request_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_request" ADD CONSTRAINT "follow_request_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_like" ADD CONSTRAINT "photo_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_like" ADD CONSTRAINT "photo_like_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_photo" ADD CONSTRAINT "featured_photo_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_photo" ADD CONSTRAINT "featured_photo_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_event" ADD CONSTRAINT "verification_event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_event" ADD CONSTRAINT "verification_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_event" ADD CONSTRAINT "rate_event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written guarantees for the social layer.
-- ---------------------------------------------------------------------------

-- Every account starts private, including existing ones: the column default (true) applies to every existing row.
-- Every existing follow is an approved follow: requests live in follow_request, so no follow rows change.

-- A photo's night (America/New_York, 5am rollover) is derived from created_at on insert, so featuring and
-- Regular status can never disagree with the timestamp. created_at is immutable, so night is too.
CREATE OR REPLACE FUNCTION lastcall_night_of(ts timestamptz) RETURNS text AS $$
  SELECT to_char((ts AT TIME ZONE 'America/New_York') - interval '5 hours', 'YYYY-MM-DD');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION lastcall_photo_set_night() RETURNS trigger AS $$
BEGIN
  NEW.night := lastcall_night_of(NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER photo_set_night BEFORE INSERT ON "photo" FOR EACH ROW EXECUTE FUNCTION lastcall_photo_set_night();

-- Backfill existing photos. The immutability trigger below is replaced after this, and night isn't in the old one.
UPDATE "photo" SET night = lastcall_night_of(created_at);

ALTER TABLE "photo" ADD CONSTRAINT photo_rating_range CHECK (rating IS NULL OR (rating BETWEEN 1 AND 10));
ALTER TABLE "photo" ADD CONSTRAINT photo_night_set CHECK (night <> '');

-- Photos stay immutable except moderation state and the author's post fields:
--  - caption, shared, edited_at: the author's edits (the service freezes the caption while a flag is open);
--  - rating: may be added or changed only until the end of the photo's night, and never cleared once set;
--  - removed_at: the author removing it from their profile, final once set;
--  - hidden_at: moderation (logged in moderation_event by the service).
CREATE OR REPLACE FUNCTION lastcall_photo_immutable() RETURNS trigger AS $$
BEGIN
  IF (NEW.id, NEW.user_id, NEW.venue_id, NEW.storage_key, NEW.mime_type, NEW.lat, NEW.lng, NEW.created_at, NEW.night)
     IS DISTINCT FROM (OLD.id, OLD.user_id, OLD.venue_id, OLD.storage_key, OLD.mime_type, OLD.lat, OLD.lng, OLD.created_at, OLD.night) THEN
    RAISE EXCEPTION 'lastcall: photos are immutable except moderation state and the author''s post fields' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.rating IS NOT NULL AND NEW.rating IS NULL THEN
    RAISE EXCEPTION 'lastcall: a post''s rating can''t be cleared' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.rating IS DISTINCT FROM OLD.rating
     AND clock_timestamp() >= ((OLD.night::date + 1) + time '05:00') AT TIME ZONE 'America/New_York' THEN
    RAISE EXCEPTION 'lastcall: a post''s rating is locked after its night ends' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.removed_at IS NOT NULL AND NEW.removed_at IS DISTINCT FROM OLD.removed_at THEN
    RAISE EXCEPTION 'lastcall: a removed post stays removed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- A like is only for someone else's shared post.
CREATE OR REPLACE FUNCTION lastcall_like_guard() RETURNS trigger AS $$
DECLARE p record;
BEGIN
  SELECT user_id, rating, shared INTO p FROM "photo" WHERE id = NEW.photo_id;
  IF p.user_id = NEW.user_id THEN
    RAISE EXCEPTION 'lastcall: you can''t like your own post' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p.rating IS NULL OR NOT p.shared THEN
    RAISE EXCEPTION 'lastcall: only shared posts can be liked' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER photo_like_guard BEFORE INSERT ON "photo_like" FOR EACH ROW EXECUTE FUNCTION lastcall_like_guard();
CREATE TRIGGER photo_like_countable_immutable BEFORE UPDATE OF countable ON "photo_like" FOR EACH ROW EXECUTE FUNCTION lastcall_countable_immutable();

ALTER TABLE "follow_request" ADD CONSTRAINT follow_request_not_self CHECK (requester_id <> target_id);
ALTER TABLE "follow" ADD CONSTRAINT follow_not_self CHECK (follower_id <> followee_id);
ALTER TABLE "app_user" ADD CONSTRAINT app_user_bio_length CHECK (char_length(bio) <= 150);

-- Featuring results and runs, and the verification log, are append-only.
ALTER TABLE "featured_photo" ADD CONSTRAINT featured_photo_rank_range CHECK (rank BETWEEN 1 AND 20);
ALTER TABLE "featured_photo" ADD CONSTRAINT featured_photo_min_likes CHECK (eligible_likes >= 3);
CREATE TRIGGER featured_photo_no_update BEFORE UPDATE ON "featured_photo"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('featuring results are append-only');
CREATE TRIGGER featured_photo_no_delete BEFORE DELETE ON "featured_photo"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('featuring results are append-only');
CREATE TRIGGER featured_run_no_update BEFORE UPDATE ON "featured_run"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('featuring runs are append-only');
CREATE TRIGGER featured_run_no_delete BEFORE DELETE ON "featured_run"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('featuring runs are append-only');
CREATE TRIGGER verification_event_no_update BEFORE UPDATE ON "verification_event"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('verification log is append-only');
CREATE TRIGGER verification_event_no_delete BEFORE DELETE ON "verification_event"
  FOR EACH ROW EXECUTE FUNCTION lastcall_reject_mutation('verification log is append-only');
ALTER TABLE "verification_event" ADD CONSTRAINT verification_event_note CHECK (char_length(btrim(note)) BETWEEN 3 AND 300);
