-- DropIndex
DROP INDEX "flag_target_type_target_id_flagger_id_key";

-- CreateIndex
CREATE INDEX "flag_target_type_target_id_flagger_id_idx" ON "flag"("target_type", "target_id", "flagger_id");

-- One OPEN flag per (item, flagger). Resolved flags don't block flagging again after a review.
CREATE UNIQUE INDEX "flag_open_unique" ON "flag" ("target_type", "target_id", "flagger_id") WHERE status = 'OPEN';
