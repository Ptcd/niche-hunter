-- Migration: Add Phone Source Fields to Site Model
-- Date: 2025-01-XX
-- Description: Adds phoneSource, trackingNumber, and ringbaNumberId fields to support multiple phone number sources
-- Run this SQL in Supabase SQL Editor

-- Note: Prisma typically creates lowercase table names. If "Site" doesn't work, try "site" (lowercase)

-- Add phoneSource column (nullable string, can be "manual", "twilio", "ringba", or null)
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "phoneSource" TEXT;

-- Add trackingNumber column (canonical phone number used across all systems)
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;

-- Add ringbaNumberId column (Ringba-specific number ID)
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "ringbaNumberId" TEXT;

-- Migrate existing twilioNumber data to trackingNumber for backward compatibility
UPDATE "Site" SET "trackingNumber" = "twilioNumber" WHERE "twilioNumber" IS NOT NULL AND "trackingNumber" IS NULL;

-- Set phoneSource for existing Twilio numbers
UPDATE "Site" SET "phoneSource" = 'twilio' WHERE "twilioNumber" IS NOT NULL AND "phoneSource" IS NULL;

-- Add index on phoneSource for faster queries
CREATE INDEX IF NOT EXISTS "Site_phoneSource_idx" ON "Site"("phoneSource");

-- Add index on trackingNumber for faster lookups
CREATE INDEX IF NOT EXISTS "Site_trackingNumber_idx" ON "Site"("trackingNumber");

-- If the above fails with "relation Site does not exist", try this version with lowercase:
-- ALTER TABLE site ADD COLUMN IF NOT EXISTS "phoneSource" TEXT;
-- ALTER TABLE site ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;
-- ALTER TABLE site ADD COLUMN IF NOT EXISTS "ringbaNumberId" TEXT;
-- UPDATE site SET "trackingNumber" = "twilioNumber" WHERE "twilioNumber" IS NOT NULL AND "trackingNumber" IS NULL;
-- UPDATE site SET "phoneSource" = 'twilio' WHERE "twilioNumber" IS NOT NULL AND "phoneSource" IS NULL;
-- CREATE INDEX IF NOT EXISTS "site_phoneSource_idx" ON site("phoneSource");
-- CREATE INDEX IF NOT EXISTS "site_trackingNumber_idx" ON site("trackingNumber");
