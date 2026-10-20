CREATE TABLE "google_place_price_cache" (
  "venue_id" TEXT NOT NULL,
  "price_level" TEXT NOT NULL,
  "checked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "google_place_price_cache_pkey" PRIMARY KEY ("venue_id"),
  CONSTRAINT "google_place_price_cache_price_level_check" CHECK ("price_level" IN (
    'PRICE_LEVEL_UNSPECIFIED',
    'PRICE_LEVEL_FREE',
    'PRICE_LEVEL_INEXPENSIVE',
    'PRICE_LEVEL_MODERATE',
    'PRICE_LEVEL_EXPENSIVE',
    'PRICE_LEVEL_VERY_EXPENSIVE'
  )),
  CONSTRAINT "google_place_price_cache_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
