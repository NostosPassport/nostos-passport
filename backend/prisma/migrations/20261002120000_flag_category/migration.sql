-- Report categories: moderators read UNDERAGE and STALKING reports first, and "not at this place" is a first-class reason.
-- CreateEnum
CREATE TYPE "FlagCategory" AS ENUM ('SPAM', 'HARASSMENT', 'SEXUAL_OR_VIOLENT', 'NOT_AT_PLACE', 'STALKING', 'UNDERAGE', 'PRIVATE_INFO', 'OTHER');

-- AlterTable
ALTER TABLE "flag" ADD COLUMN     "category" "FlagCategory" NOT NULL DEFAULT 'OTHER';
