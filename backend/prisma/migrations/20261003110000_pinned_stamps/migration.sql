-- Pinned stamps: up to 4 per person, their own, owner only.

-- CreateTable
CREATE TABLE "pinned_stamp" (
    "user_id" TEXT NOT NULL,
    "stamp_id" TEXT NOT NULL,
    "position" SMALLINT NOT NULL,
    "pinned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pinned_stamp_pkey" PRIMARY KEY ("user_id","stamp_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pinned_stamp_user_id_position_key" ON "pinned_stamp"("user_id", "position");

-- AddForeignKey
ALTER TABLE "pinned_stamp" ADD CONSTRAINT "pinned_stamp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pinned_stamp" ADD CONSTRAINT "pinned_stamp_stamp_id_fkey" FOREIGN KEY ("stamp_id") REFERENCES "photo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "pinned_stamp" ADD CONSTRAINT pinned_stamp_position CHECK (position BETWEEN 0 AND 3);
-- You can only pin your own stamp.
CREATE OR REPLACE FUNCTION lastcall_pinned_own() RETURNS trigger AS $$
BEGIN
  IF (SELECT user_id FROM "photo" WHERE id = NEW.stamp_id) IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'lastcall: you can only pin your own stamps' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER pinned_stamp_own BEFORE INSERT OR UPDATE ON "pinned_stamp" FOR EACH ROW EXECUTE FUNCTION lastcall_pinned_own();
