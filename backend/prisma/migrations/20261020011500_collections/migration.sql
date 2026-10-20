CREATE TABLE "collection" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "collection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collection_stamp" (
  "collection_id" TEXT NOT NULL,
  "stamp_id" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collection_stamp_pkey" PRIMARY KEY ("collection_id", "stamp_id")
);

CREATE INDEX "collection_user_id_created_at_idx" ON "collection"("user_id", "created_at");
CREATE INDEX "collection_stamp_collection_id_position_idx" ON "collection_stamp"("collection_id", "position");
CREATE INDEX "collection_stamp_stamp_id_idx" ON "collection_stamp"("stamp_id");

ALTER TABLE "collection"
  ADD CONSTRAINT "collection_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collection_stamp"
  ADD CONSTRAINT "collection_stamp_collection_id_fkey"
  FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collection_stamp"
  ADD CONSTRAINT "collection_stamp_stamp_id_fkey"
  FOREIGN KEY ("stamp_id") REFERENCES "photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
