-- Create enum type for comment status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_comment_status') THEN
    CREATE TYPE "enum_comment_status" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED');
  END IF;
END$$;

-- Create comments table
CREATE TABLE IF NOT EXISTS "comments" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "user_type" VARCHAR(50),
    "user_name" VARCHAR(255),
    "user_email" VARCHAR(255),
    "subject" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "enum_comment_status" NOT NULL DEFAULT 'PENDING',
    "admin_response" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "comments_id_idx" ON "comments" ("id");
CREATE INDEX IF NOT EXISTS "comments_user_id_idx" ON "comments" ("user_id");
CREATE INDEX IF NOT EXISTS "comments_status_idx" ON "comments" ("status");
CREATE INDEX IF NOT EXISTS "comments_created_at_idx" ON "comments" ("created_at");
