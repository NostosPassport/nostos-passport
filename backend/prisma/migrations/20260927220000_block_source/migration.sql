-- AlterTable
ALTER TABLE "block" ADD COLUMN     "ref" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'profile';

-- CreateIndex
CREATE UNIQUE INDEX "block_ref_key" ON "block"("ref");


ALTER TABLE "block" ADD CONSTRAINT block_source CHECK (source IN ('profile', 'photo', 'comment'));
