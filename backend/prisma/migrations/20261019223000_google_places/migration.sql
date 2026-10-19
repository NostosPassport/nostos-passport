ALTER TABLE "venue"
  ADD COLUMN "google_place_id" TEXT,
  ADD COLUMN "google_primary_type" TEXT,
  ADD COLUMN "google_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "cuisines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "category" TEXT,
  ADD COLUMN "google_business_status" TEXT,
  ADD COLUMN "google_synced_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "venue_google_place_id_key" ON "venue"("google_place_id");
