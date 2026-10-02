-- AlterTable
ALTER TABLE "venue" ADD COLUMN "osm_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "venue_osm_id_key" ON "venue"("osm_id");
