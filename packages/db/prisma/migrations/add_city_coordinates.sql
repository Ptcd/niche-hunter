-- Add geographic coordinates to CityV5000 table
-- Run this directly in Supabase SQL Editor

-- Add latitude and longitude columns
ALTER TABLE "CityV5000" 
ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- Add index for proximity queries
CREATE INDEX IF NOT EXISTS "CityV5000_latitude_longitude_idx" 
ON "CityV5000" ("latitude", "longitude");

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'CityV5000' 
  AND column_name IN ('latitude', 'longitude');

