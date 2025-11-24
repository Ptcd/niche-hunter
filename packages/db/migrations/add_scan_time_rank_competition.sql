-- Migration: Add timeToRank and competitionStrength fields to Scan table
-- Date: 2024
-- Description: Adds fields for time-to-rank estimate and competition strength score

-- Add timeToRank column (nullable text, e.g., "4-8 months")
ALTER TABLE "Scan" 
ADD COLUMN IF NOT EXISTS "timeToRank" TEXT;

-- Add competitionStrength column (nullable float, 0-10 scale)
ALTER TABLE "Scan" 
ADD COLUMN IF NOT EXISTS "competitionStrength" DOUBLE PRECISION;

-- Add comment to columns for documentation
COMMENT ON COLUMN "Scan"."timeToRank" IS 'Estimated time to rank (e.g., "4-8 months")';
COMMENT ON COLUMN "Scan"."competitionStrength" IS 'Competition strength score (0-10 scale)';

