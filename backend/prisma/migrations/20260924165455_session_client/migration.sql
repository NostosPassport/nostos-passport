-- CreateEnum
CREATE TYPE "SessionClient" AS ENUM ('WEB', 'IOS');

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "client" "SessionClient" NOT NULL DEFAULT 'WEB';
