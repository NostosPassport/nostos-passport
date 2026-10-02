-- AlterEnum
ALTER TYPE "ModerationAction" ADD VALUE 'RESTORE';

-- DropForeignKey
ALTER TABLE "moderation_event" DROP CONSTRAINT "moderation_event_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "venue_cover_history" DROP CONSTRAINT "venue_cover_history_changed_by_id_fkey";

-- AddForeignKey
ALTER TABLE "venue_cover_history" ADD CONSTRAINT "venue_cover_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag" ADD CONSTRAINT "flag_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_event" ADD CONSTRAINT "moderation_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Moderators must be able to restore auto-hidden content after review, so hidden_at is no
-- longer sticky at the DB level. Every hide/restore goes through the moderation service,
-- which writes an append-only moderation_event in the same transaction.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS report_hidden_sticky ON "report";
DROP TRIGGER IF EXISTS photo_hidden_sticky ON "photo";
DROP TRIGGER IF EXISTS comment_hidden_sticky ON "comment";
DROP FUNCTION IF EXISTS lastcall_hidden_is_sticky();

-- User content is immutable apart from moderation state (and a comment author's own edits).
-- Protects authorship, venue, timestamps and values: e.g. nobody can bump a photo's created_at
-- to put a stale photo back into the live feed (invariant 6) or rewrite a report's value.
CREATE OR REPLACE FUNCTION lastcall_report_immutable() RETURNS trigger AS $$
BEGIN
  IF (NEW.id, NEW.user_id, NEW.venue_id, NEW.type, NEW.vibe, NEW.line, NEW.cover_cents, NEW.lat, NEW.lng, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.user_id, OLD.venue_id, OLD.type, OLD.vibe, OLD.line, OLD.cover_cents, OLD.lat, OLD.lng, OLD.created_at) THEN
    RAISE EXCEPTION 'lastcall: reports are immutable except hidden_at' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION lastcall_photo_immutable() RETURNS trigger AS $$
BEGIN
  IF (NEW.id, NEW.user_id, NEW.venue_id, NEW.storage_key, NEW.mime_type, NEW.caption, NEW.lat, NEW.lng, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.user_id, OLD.venue_id, OLD.storage_key, OLD.mime_type, OLD.caption, OLD.lat, OLD.lng, OLD.created_at) THEN
    RAISE EXCEPTION 'lastcall: photos are immutable except hidden_at' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION lastcall_comment_immutable() RETURNS trigger AS $$
BEGIN
  IF (NEW.id, NEW.user_id, NEW.venue_id, NEW.parent_id, NEW.is_venue_reply, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.user_id, OLD.venue_id, OLD.parent_id, OLD.is_venue_reply, OLD.created_at) THEN
    RAISE EXCEPTION 'lastcall: only body/edited_at/hidden_at of a comment can change' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_immutable BEFORE UPDATE ON "report" FOR EACH ROW EXECUTE FUNCTION lastcall_report_immutable();
CREATE TRIGGER photo_immutable BEFORE UPDATE ON "photo" FOR EACH ROW EXECUTE FUNCTION lastcall_photo_immutable();
CREATE TRIGGER comment_immutable BEFORE UPDATE ON "comment" FOR EACH ROW EXECUTE FUNCTION lastcall_comment_immutable();

ALTER TABLE "comment" ADD CONSTRAINT comment_reply_shape CHECK (is_venue_reply = (parent_id IS NOT NULL));
