CREATE TYPE "EmailChallengePurpose" AS ENUM ('SIGN_UP', 'SIGN_IN', 'CHANGE_EMAIL', 'DELETE_ACCOUNT');

ALTER TABLE "app_user"
  ALTER COLUMN "password_hash" DROP NOT NULL,
  ADD COLUMN "email_verified_at" TIMESTAMPTZ(3),
  ADD COLUMN "age_verified_at" TIMESTAMPTZ(3);

CREATE TABLE "email_challenge" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "purpose" "EmailChallengePurpose" NOT NULL,
  "ip" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_challenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_challenge_email_purpose_created_at_idx" ON "email_challenge"("email", "purpose", "created_at");
CREATE INDEX "email_challenge_ip_created_at_idx" ON "email_challenge"("ip", "created_at");
CREATE INDEX "email_challenge_expires_at_idx" ON "email_challenge"("expires_at");
