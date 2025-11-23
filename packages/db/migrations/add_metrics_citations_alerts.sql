-- Migration: Add SiteMetrics, SiteCitation, Alert tables and update Site/SitePage enums
-- Run this after updating Prisma schema

-- Step 1: Add new columns to Site table
ALTER TABLE "Site" 
  ADD COLUMN IF NOT EXISTS "wpUser" TEXT,
  ADD COLUMN IF NOT EXISTS "wpAppPassword" TEXT,
  ADD COLUMN IF NOT EXISTS "wpPluginVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "wpApiBase" TEXT,
  ADD COLUMN IF NOT EXISTS "searchConsolePropertyId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastRankingCheckAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "lastCallCountCheckAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "lastCitationCheckAt" TIMESTAMP;

-- Step 2: Add new columns to SitePage table
ALTER TABLE "SitePage"
  ADD COLUMN IF NOT EXISTS "humanNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "keywordId" TEXT,
  ADD COLUMN IF NOT EXISTS "skeletonId" TEXT,
  ADD COLUMN IF NOT EXISTS "wpEditUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "aiDraftJson" JSONB,
  ADD COLUMN IF NOT EXISTS "latestGenerationAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "latestPublishedAt" TIMESTAMP;

-- Change wpPageId from String to Int (if it exists as String, we'll need to handle this carefully)
-- Note: This assumes wpPageId might be empty/null. If you have existing data, handle conversion separately.
-- ALTER TABLE "SitePage" ALTER COLUMN "wpPageId" TYPE INTEGER USING NULLIF("wpPageId", '')::INTEGER;

-- Step 3: Create SiteMetrics table
CREATE TABLE IF NOT EXISTS "SiteMetrics" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "date" TIMESTAMP NOT NULL,
  "calls" INTEGER NOT NULL DEFAULT 0,
  "formLeads" INTEGER NOT NULL DEFAULT 0,
  "pageViews" INTEGER NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "avgPosition" DOUBLE PRECISION,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteMetrics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SiteMetrics_siteId_date_key" UNIQUE ("siteId", "date")
);

CREATE INDEX IF NOT EXISTS "SiteMetrics_siteId_idx" ON "SiteMetrics"("siteId");
CREATE INDEX IF NOT EXISTS "SiteMetrics_date_idx" ON "SiteMetrics"("date");

-- Step 4: Create SiteCitation table
CREATE TABLE IF NOT EXISTS "SiteCitation" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "nap" TEXT,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteCitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteCitation_siteId_idx" ON "SiteCitation"("siteId");

-- Step 5: Create Alert table
CREATE TABLE IF NOT EXISTS "Alert" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "dismissed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Alert_siteId_idx" ON "Alert"("siteId");
CREATE INDEX IF NOT EXISTS "Alert_dismissed_idx" ON "Alert"("dismissed");

-- Step 6: Add foreign key constraints
DO $$ 
BEGIN
  -- SiteMetrics foreign key
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SiteMetrics_siteId_fkey'
  ) THEN
    ALTER TABLE "SiteMetrics" 
      ADD CONSTRAINT "SiteMetrics_siteId_fkey" 
      FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE;
  END IF;

  -- SiteCitation foreign key
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SiteCitation_siteId_fkey'
  ) THEN
    ALTER TABLE "SiteCitation" 
      ADD CONSTRAINT "SiteCitation_siteId_fkey" 
      FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE;
  END IF;

  -- Alert foreign key
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Alert_siteId_fkey'
  ) THEN
    ALTER TABLE "Alert" 
      ADD CONSTRAINT "Alert_siteId_fkey" 
      FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE;
  END IF;

  -- SitePage keywordId foreign key (optional, nullable)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SitePage_keywordId_fkey'
  ) THEN
    ALTER TABLE "SitePage" 
      ADD CONSTRAINT "SitePage_keywordId_fkey" 
      FOREIGN KEY ("keywordId") REFERENCES "KeywordV5000"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- Step 7: Create enum types (PostgreSQL enums)
-- Create enum types first
DO $$ 
BEGIN
  -- SiteStatus enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SiteStatus') THEN
    CREATE TYPE "SiteStatus" AS ENUM ('SETUP_PENDING', 'DRAFTING', 'REVIEW_NEEDED', 'LIVE', 'PAUSED', 'ERROR');
  END IF;

  -- PageStatus enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PageStatus') THEN
    CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'NEEDS_REWRITE', 'ARCHIVED');
  END IF;

  -- PhoneSource enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PhoneSource') THEN
    CREATE TYPE "PhoneSource" AS ENUM ('MANUAL', 'TWILIO', 'RINGBA', 'VOIPMS');
  END IF;

  -- PageType enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PageType') THEN
    CREATE TYPE "PageType" AS ENUM ('HOME', 'CORE_SERVICE', 'SUPPORT', 'CITY', 'ABOUT', 'CONTACT', 'LEGAL');
  END IF;
END $$;

-- Step 8: Convert existing string columns to enums (if they exist)
-- Note: This assumes the columns exist. If not, Prisma will create them as enums.

-- Convert Site.status from string to SiteStatus enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Site' AND column_name = 'status' AND data_type = 'text') THEN
    -- Drop the default first
    ALTER TABLE "Site" ALTER COLUMN "status" DROP DEFAULT;
    
    -- Map existing string values to enum values
    ALTER TABLE "Site" ALTER COLUMN "status" TYPE "SiteStatus" 
      USING CASE 
        WHEN "status" = 'setup_pending' THEN 'SETUP_PENDING'::"SiteStatus"
        WHEN "status" = 'planning_ready' THEN 'DRAFTING'::"SiteStatus"
        WHEN "status" = 'content_in_progress' THEN 'DRAFTING'::"SiteStatus"
        WHEN "status" = 'draft' THEN 'DRAFTING'::"SiteStatus"
        WHEN "status" = 'ready_to_publish' THEN 'REVIEW_NEEDED'::"SiteStatus"
        WHEN "status" = 'published' THEN 'LIVE'::"SiteStatus"
        WHEN "status" = 'live' THEN 'LIVE'::"SiteStatus"
        WHEN "status" = 'error' THEN 'ERROR'::"SiteStatus"
        ELSE 'SETUP_PENDING'::"SiteStatus"
      END;
    
    -- Set the new default
    ALTER TABLE "Site" ALTER COLUMN "status" SET DEFAULT 'SETUP_PENDING'::"SiteStatus";
  END IF;
END $$;

-- Convert SitePage.status from string to PageStatus enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'SitePage' AND column_name = 'status' AND data_type = 'text') THEN
    -- Drop the default if it exists
    ALTER TABLE "SitePage" ALTER COLUMN "status" DROP DEFAULT;
    
    ALTER TABLE "SitePage" ALTER COLUMN "status" TYPE "PageStatus" 
      USING CASE 
        WHEN "status" = 'draft' THEN 'DRAFT'::"PageStatus"
        WHEN "status" = 'approved' THEN 'APPROVED'::"PageStatus"
        WHEN "status" = 'published' THEN 'PUBLISHED'::"PageStatus"
        ELSE 'DRAFT'::"PageStatus"
      END;
    
    -- Set the new default
    ALTER TABLE "SitePage" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"PageStatus";
  END IF;
END $$;

-- Convert Site.phoneSource from string to PhoneSource enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Site' AND column_name = 'phoneSource' AND data_type = 'text') THEN
    ALTER TABLE "Site" ALTER COLUMN "phoneSource" TYPE "PhoneSource" 
      USING CASE 
        WHEN "phoneSource" = 'manual' THEN 'MANUAL'::"PhoneSource"
        WHEN "phoneSource" = 'twilio' THEN 'TWILIO'::"PhoneSource"
        WHEN "phoneSource" = 'ringba' THEN 'RINGBA'::"PhoneSource"
        WHEN "phoneSource" = 'voipms' THEN 'VOIPMS'::"PhoneSource"
        ELSE NULL
      END;
  END IF;
END $$;

-- Convert SitePage.pageType from string to PageType enum
-- Note: This is more complex as pageType has many values. Map common ones.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'SitePage' AND column_name = 'pageType' AND data_type = 'text') THEN
    ALTER TABLE "SitePage" ALTER COLUMN "pageType" TYPE "PageType" 
      USING CASE 
        WHEN "pageType" = 'home' THEN 'HOME'::"PageType"
        WHEN "pageType" IN ('primary_service', 'core_service', 'service') THEN 'CORE_SERVICE'::"PageType"
        WHEN "pageType" IN ('faq_page', 'blog_support', 'support') THEN 'SUPPORT'::"PageType"
        WHEN "pageType" IN ('city_page', 'city') THEN 'CITY'::"PageType"
        WHEN "pageType" = 'about' THEN 'ABOUT'::"PageType"
        WHEN "pageType" = 'contact' THEN 'CONTACT'::"PageType"
        WHEN "pageType" IN ('legal', 'privacy', 'terms') THEN 'LEGAL'::"PageType"
        ELSE 'HOME'::"PageType"
      END;
  END IF;
END $$;

