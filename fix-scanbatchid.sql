-- Direct SQL to fix scanBatchId -> batchId issue
-- Run this directly on the database if needed

-- Check what columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'KeywordV5000' 
AND column_name LIKE '%batch%';

-- Drop foreign key if it exists with wrong name
ALTER TABLE "KeywordV5000" DROP CONSTRAINT IF EXISTS "KeywordV5000_scanBatchId_fkey" CASCADE;

-- Rename column if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'KeywordV5000' 
    AND column_name = 'scanBatchId'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE "KeywordV5000" RENAME COLUMN "scanBatchId" TO "batchId";
  END IF;
END $$;

-- Recreate foreign key with correct name
ALTER TABLE "KeywordV5000" 
ADD CONSTRAINT IF NOT EXISTS "KeywordV5000_batchId_fkey" 
FOREIGN KEY ("batchId") REFERENCES "ScanBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;



