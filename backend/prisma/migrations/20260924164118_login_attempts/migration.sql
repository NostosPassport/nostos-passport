-- CreateTable
CREATE TABLE "login_attempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_attempt_email_ip_created_at_idx" ON "login_attempt"("email", "ip", "created_at");

-- CreateIndex
CREATE INDEX "login_attempt_created_at_idx" ON "login_attempt"("created_at");
