-- Add missing columns to KeywordV5000 table
-- These columns are defined in the Prisma schema but missing from the database

ALTER TABLE "KeywordV5000" 
  ADD COLUMN IF NOT EXISTS "keywordType" TEXT,
  ADD COLUMN IF NOT EXISTS "keywordRole" TEXT;

-- Add index for keywordRole (defined in schema line 168)
CREATE INDEX IF NOT EXISTS "KeywordV5000_keywordRole_idx" ON "KeywordV5000"("keywordRole");

