CREATE TABLE "collection_share" (
  "id" TEXT NOT NULL,
  "collection_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collection_share_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collection_share_collection_id_key" ON "collection_share"("collection_id");

ALTER TABLE "collection_share"
  ADD CONSTRAINT "collection_share_collection_id_fkey"
  FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
