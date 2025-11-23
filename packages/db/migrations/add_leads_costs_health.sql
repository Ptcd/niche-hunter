-- Migration: Add Lead, SiteCostLog models + cost/health fields to Site schema
-- Also updates SiteStatus enum and adds new fields

-- Step 1: Create LeadType enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeadType') THEN
    CREATE TYPE "LeadType" AS ENUM ('CALL', 'FORM');
  END IF;
END $$;

-- Step 2: Convert existing SiteStatus values to new enum
-- NOTE: Run add_sitestatus_enum_values.sql FIRST to add the new enum values
-- This conversion will only work after the enum values are committed

-- Convert SETUP_PENDING -> SETUP
UPDATE "Site" 
SET status = 'SETUP'::"SiteStatus" 
WHERE status::text = 'SETUP_PENDING';

-- Convert DRAFTING -> GENERATING
UPDATE "Site" 
SET status = 'GENERATING'::"SiteStatus" 
WHERE status::text = 'DRAFTING';

-- Convert REVIEW_NEEDED -> REVIEW
UPDATE "Site" 
SET status = 'REVIEW'::"SiteStatus" 
WHERE status::text = 'REVIEW_NEEDED';

-- LIVE, PAUSED, ERROR remain unchanged (no conversion needed)

-- Step 3: Add new columns to Site table
ALTER TABLE "Site" 
  ADD COLUMN IF NOT EXISTS "domainCostCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "phoneCostCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "hostingCostCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "aiCostCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "monthlyRevenueCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "voipmsAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "publicToken" TEXT,
  ADD COLUMN IF NOT EXISTS "lastHealthCheckAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "healthStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "sslExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "setupProgress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hasDomain" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hasPhone" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hasWordPress" BOOLEAN NOT NULL DEFAULT false;

-- Add unique constraint for publicToken
CREATE UNIQUE INDEX IF NOT EXISTS "Site_publicToken_key" ON "Site"("publicToken") WHERE "publicToken" IS NOT NULL;

-- Step 4: Add callMinutes to SiteMetrics
ALTER TABLE "SiteMetrics"
  ADD COLUMN IF NOT EXISTS "callMinutes" INTEGER NOT NULL DEFAULT 0;

-- Step 5: Update SiteCitation with NAP fields
ALTER TABLE "SiteCitation"
  ADD COLUMN IF NOT EXISTS "listedName" TEXT,
  ADD COLUMN IF NOT EXISTS "listedAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "listedPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);

-- Step 6: Create Lead table
CREATE TABLE IF NOT EXISTS "Lead" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "type" "LeadType" NOT NULL,
  "contactName" TEXT,
  "contactPhone" TEXT,
  "contactEmail" TEXT,
  "message" TEXT,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- Add foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Lead_siteId_fkey'
  ) THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_siteId_fkey" 
      FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS "Lead_siteId_idx" ON "Lead"("siteId");
CREATE INDEX IF NOT EXISTS "Lead_type_idx" ON "Lead"("type");
CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx" ON "Lead"("createdAt");

-- Step 7: Create SiteCostLog table
CREATE TABLE IF NOT EXISTS "SiteCostLog" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "type" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "provider" TEXT,
  "description" TEXT,
  
  CONSTRAINT "SiteCostLog_pkey" PRIMARY KEY ("id")
);

-- Add foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SiteCostLog_siteId_fkey'
  ) THEN
    ALTER TABLE "SiteCostLog" ADD CONSTRAINT "SiteCostLog_siteId_fkey" 
      FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS "SiteCostLog_siteId_idx" ON "SiteCostLog"("siteId");
CREATE INDEX IF NOT EXISTS "SiteCostLog_date_idx" ON "SiteCostLog"("date");

