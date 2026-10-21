ALTER TABLE "venue"
  ADD COLUMN "google_price_level" TEXT,
  ADD COLUMN "google_price_checked_at" TIMESTAMPTZ(3);

ALTER TABLE "venue"
  ADD CONSTRAINT "venue_google_price_level_check" CHECK (
    "google_price_level" IS NULL OR "google_price_level" IN (
      'PRICE_LEVEL_UNSPECIFIED',
      'PRICE_LEVEL_FREE',
      'PRICE_LEVEL_INEXPENSIVE',
      'PRICE_LEVEL_MODERATE',
      'PRICE_LEVEL_EXPENSIVE',
      'PRICE_LEVEL_VERY_EXPENSIVE'
    )
  );
