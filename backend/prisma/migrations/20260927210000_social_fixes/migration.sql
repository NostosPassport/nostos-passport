-- DropForeignKey
ALTER TABLE "verification_event" DROP CONSTRAINT "verification_event_actor_id_fkey";

-- DropIndex
DROP INDEX "featured_photo_venue_id_night_idx";

-- DropIndex
DROP INDEX "photo_like_photo_id_idx";

-- AlterTable
ALTER TABLE "photo" ALTER COLUMN "shared" SET DEFAULT false;

-- CreateIndex
CREATE INDEX "photo_user_id_venue_id_night_idx" ON "photo"("user_id", "venue_id", "night");

-- CreateIndex
CREATE INDEX "photo_like_photo_id_created_at_idx" ON "photo_like"("photo_id", "created_at");

-- AddForeignKey
ALTER TABLE "featured_photo" ADD CONSTRAINT "featured_photo_night_fkey" FOREIGN KEY ("night") REFERENCES "featured_run"("night") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_event" ADD CONSTRAINT "verification_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Review fixes for the social layer (hand-written).
-- ---------------------------------------------------------------------------

-- The end of a night (5am America/New_York the next morning) as an instant.
CREATE OR REPLACE FUNCTION lastcall_night_end(night text) RETURNS timestamptz AS $$
  SELECT ((night::date + 1) + time '05:00') AT TIME ZONE 'America/New_York';
$$ LANGUAGE sql STABLE;

-- Captions: 280 characters for posts (live-only photos are limited to 140 by the service).
ALTER TABLE "photo" ADD CONSTRAINT photo_caption_length CHECK (char_length(caption) <= 280);

-- Likes: only on someone else's visible, shared post by a live account, and never on App Review posts.
-- FOR SHARE so a concurrent un-share, removal or hide can't interleave with the insert.
CREATE OR REPLACE FUNCTION lastcall_like_guard() RETURNS trigger AS $$
DECLARE p record;
BEGIN
  SELECT ph.user_id, ph.rating, ph.shared, ph.hidden_at, ph.removed_at, ph.countable, u.deleted_at
    INTO p
    FROM "photo" ph JOIN "app_user" u ON u.id = ph.user_id
    WHERE ph.id = NEW.photo_id
    FOR SHARE OF ph;
  IF p.user_id = NEW.user_id THEN
    RAISE EXCEPTION 'lastcall: you can''t like your own post' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p.rating IS NULL OR NOT p.shared THEN
    RAISE EXCEPTION 'lastcall: only shared posts can be liked' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p.hidden_at IS NOT NULL OR p.removed_at IS NOT NULL OR NOT p.countable OR p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'lastcall: this post can''t be liked' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- A night can only be featured once it has ended, and a featured row must match its photo: same venue and night,
-- a shared, visible post. Both tables are append-only, so a bad insert would otherwise be permanent.
CREATE OR REPLACE FUNCTION lastcall_featured_run_guard() RETURNS trigger AS $$
BEGIN
  IF clock_timestamp() < lastcall_night_end(NEW.night) THEN
    RAISE EXCEPTION 'lastcall: night % hasn''t ended yet', NEW.night USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER featured_run_guard BEFORE INSERT ON "featured_run" FOR EACH ROW EXECUTE FUNCTION lastcall_featured_run_guard();

CREATE OR REPLACE FUNCTION lastcall_featured_photo_guard() RETURNS trigger AS $$
DECLARE p record;
BEGIN
  SELECT venue_id, night, rating, shared, hidden_at, removed_at, countable INTO p FROM "photo" WHERE id = NEW.photo_id;
  IF p.venue_id IS DISTINCT FROM NEW.venue_id OR p.night IS DISTINCT FROM NEW.night THEN
    RAISE EXCEPTION 'lastcall: a featured photo must match its venue and night' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p.rating IS NULL OR NOT p.shared OR p.hidden_at IS NOT NULL OR p.removed_at IS NOT NULL OR NOT p.countable THEN
    RAISE EXCEPTION 'lastcall: only shared, visible posts can be featured' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER featured_photo_guard BEFORE INSERT ON "featured_photo" FOR EACH ROW EXECUTE FUNCTION lastcall_featured_photo_guard();

-- A follow and a pending request for the same pair never coexist: creating the follow clears the request.
CREATE OR REPLACE FUNCTION lastcall_follow_clears_request() RETURNS trigger AS $$
BEGIN
  DELETE FROM "follow_request" WHERE requester_id = NEW.follower_id AND target_id = NEW.followee_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER follow_clears_request AFTER INSERT ON "follow" FOR EACH ROW EXECUTE FUNCTION lastcall_follow_clears_request();

ALTER TABLE "rate_event" ADD CONSTRAINT rate_event_kind CHECK (kind IN ('follow', 'like', 'post'));
