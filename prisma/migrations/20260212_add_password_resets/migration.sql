-- CreateTable
CREATE TABLE IF NOT EXISTS "password_resets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "password_resets_token_key" ON "password_resets"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "password_resets_token_idx" ON "password_resets"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "password_resets_email_idx" ON "password_resets"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "password_resets_expires_at_idx" ON "password_resets"("expires_at");

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
