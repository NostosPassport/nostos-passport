-- Nostos is worldwide now. Locality comes from durable venue fields instead of NYC polygon membership.

UPDATE "venue"
SET "time_zone" = 'UTC'
WHERE "time_zone" IS NULL OR BTRIM("time_zone") = '';

ALTER TABLE "venue"
  ALTER COLUMN "time_zone" SET DEFAULT 'UTC',
  ALTER COLUMN "time_zone" SET NOT NULL;

ALTER TABLE "venue" DROP CONSTRAINT IF EXISTS "venue_neighborhood_id_fkey";
ALTER TABLE "venue" DROP COLUMN IF EXISTS "neighborhood_id";
ALTER TABLE "venue" DROP COLUMN IF EXISTS "neighborhood";

DROP TABLE IF EXISTS "neighborhood_completion";
DROP TABLE IF EXISTS "neighborhood";
