ALTER TABLE "venue"
  ADD COLUMN "area" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "country_code" TEXT,
  ADD COLUMN "time_zone" TEXT;

-- Existing durable places are NYC-only today. Preserve their current neighborhood
-- label as the initial area while future Google-backed writes use address components.
UPDATE "venue"
SET
  "area" = NULLIF("neighborhood", ''),
  "city" = 'New York',
  "region" = 'New York',
  "country" = 'United States',
  "country_code" = 'US',
  "time_zone" = 'America/New_York'
WHERE "country_code" IS NULL;

CREATE INDEX "venue_country_code_city_idx" ON "venue"("country_code", "city");
