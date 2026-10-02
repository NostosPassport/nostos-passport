-- Neighborhoods and collections: NYC neighborhood boundaries, a place belongs to one, and a durable completion marker per person.

-- AlterTable
ALTER TABLE "venue" ADD COLUMN     "neighborhood_id" TEXT;

-- CreateTable
CREATE TABLE "neighborhood" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "borough" TEXT NOT NULL,
    "boundary" JSONB NOT NULL,
    "min_lat" DOUBLE PRECISION NOT NULL,
    "max_lat" DOUBLE PRECISION NOT NULL,
    "min_lng" DOUBLE PRECISION NOT NULL,
    "max_lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "neighborhood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "neighborhood_completion" (
    "user_id" TEXT NOT NULL,
    "neighborhood_id" TEXT NOT NULL,
    "completed_at" TIMESTAMPTZ(3) NOT NULL,
    "stamp_id" TEXT NOT NULL,

    CONSTRAINT "neighborhood_completion_pkey" PRIMARY KEY ("user_id","neighborhood_id")
);

-- AddForeignKey
ALTER TABLE "venue" ADD CONSTRAINT "venue_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "neighborhood_completion" ADD CONSTRAINT "neighborhood_completion_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "neighborhood_completion" ADD CONSTRAINT "neighborhood_completion_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

