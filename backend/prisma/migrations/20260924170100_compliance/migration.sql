-- AlterEnum
ALTER TYPE "ModerationAction" ADD VALUE 'ACCOUNT_DELETED';

-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "deleted_at" TIMESTAMPTZ(3),
ADD COLUMN     "geofence_exempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "terms_accepted_at" TIMESTAMPTZ(3),
ADD COLUMN     "terms_version" TEXT;

-- CreateTable
CREATE TABLE "block" (
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_pkey" PRIMARY KEY ("blocker_id","blocked_id")
);

-- CreateIndex
CREATE INDEX "block_blocked_id_idx" ON "block"("blocked_id");

-- AddForeignKey
ALTER TABLE "block" ADD CONSTRAINT "block_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block" ADD CONSTRAINT "block_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Can't block yourself.
ALTER TABLE "block" ADD CONSTRAINT block_not_self CHECK (blocker_id <> blocked_id);
