ALTER TABLE "venue"
  ADD COLUMN "michelin_stars" SMALLINT,
  ADD COLUMN "michelin_checked_at" TIMESTAMPTZ(3);

ALTER TABLE "venue"
  ADD CONSTRAINT "venue_michelin_stars_check" CHECK (
    "michelin_stars" IS NULL OR "michelin_stars" BETWEEN 1 AND 3
  );
