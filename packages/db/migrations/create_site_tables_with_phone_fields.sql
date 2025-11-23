-- Migration: Create Site Factory Tables with Phone Source Fields
-- Run this SQL in Supabase SQL Editor
-- This creates the Site, SitePage, ContentSkeleton, and PromptProfile tables
-- with all the phone source fields included

-- Create PromptProfile table first (referenced by Site)
CREATE TABLE IF NOT EXISTS "PromptProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT,
    "styleGuidelines" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PromptProfile_name_idx" ON "PromptProfile"("name");

-- Create Site table with all fields including phone source fields
CREATE TABLE IF NOT EXISTS "Site" (
    "id" TEXT NOT NULL,
    "batchId" TEXT,
    "nicheId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "leadValue" DOUBLE PRECISION NOT NULL,
    "domain" TEXT,
    "phoneNumber" TEXT,
    "sheetId" TEXT,
    "wpBaseUrl" TEXT,
    "wpSiteId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'setup_pending',
    "errorMessage" TEXT,
    "siteName" TEXT,
    "email" TEXT,
    "twilioNumber" TEXT,
    "twilioNumberSid" TEXT,
    "forwardToNumber" TEXT,
    "registrar" TEXT,
    "logoUrl" TEXT,
    "promptProfileId" TEXT,
    "phoneSource" TEXT,
    "trackingNumber" TEXT,
    "ringbaNumberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- Create SitePage table
CREATE TABLE IF NOT EXISTS "SitePage" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "variantId" TEXT,
    "slug" TEXT NOT NULL,
    "titleTag" TEXT NOT NULL,
    "h1" TEXT NOT NULL,
    "focusKeyword" TEXT NOT NULL,
    "supportingKeywords" TEXT[],
    "searchIntent" TEXT,
    "internalLinks" TEXT[],
    "wpPageId" TEXT,
    "contentStatus" TEXT NOT NULL DEFAULT 'not_started',
    "generatedContent" TEXT,
    "targetWordCount" INTEGER,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "htmlDraft" TEXT,
    "htmlEdited" TEXT,
    "notesForGpt" TEXT,
    "keyword" TEXT,
    "status" TEXT,
    "wpPermalink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

-- Create ContentSkeleton table
CREATE TABLE IF NOT EXISTS "ContentSkeleton" (
    "id" TEXT NOT NULL,
    "sitePageId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "requiredKeywordRoles" TEXT[],
    "optionalKeywordRoles" TEXT[],
    "localHints" TEXT[],
    "styleVariant" TEXT,
    "targetWordCount" INTEGER NOT NULL,
    "minWords" INTEGER,
    "maxWords" INTEGER,
    "orderIndex" INTEGER NOT NULL,
    "generatedContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentSkeleton_pkey" PRIMARY KEY ("id")
);

-- Create indexes for Site table
CREATE INDEX IF NOT EXISTS "Site_nicheId_idx" ON "Site"("nicheId");
CREATE INDEX IF NOT EXISTS "Site_status_idx" ON "Site"("status");
CREATE INDEX IF NOT EXISTS "Site_batchId_idx" ON "Site"("batchId");
CREATE INDEX IF NOT EXISTS "Site_promptProfileId_idx" ON "Site"("promptProfileId");
CREATE INDEX IF NOT EXISTS "Site_phoneSource_idx" ON "Site"("phoneSource");
CREATE INDEX IF NOT EXISTS "Site_trackingNumber_idx" ON "Site"("trackingNumber");

-- Create indexes for SitePage table
CREATE INDEX IF NOT EXISTS "SitePage_siteId_idx" ON "SitePage"("siteId");
CREATE INDEX IF NOT EXISTS "SitePage_siteId_pageType_idx" ON "SitePage"("siteId", "pageType");
CREATE INDEX IF NOT EXISTS "SitePage_contentStatus_idx" ON "SitePage"("contentStatus");
CREATE INDEX IF NOT EXISTS "SitePage_status_idx" ON "SitePage"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "SitePage_siteId_slug_key" ON "SitePage"("siteId", "slug");

-- Create indexes for ContentSkeleton table
CREATE INDEX IF NOT EXISTS "ContentSkeleton_sitePageId_idx" ON "ContentSkeleton"("sitePageId");
CREATE INDEX IF NOT EXISTS "ContentSkeleton_sitePageId_orderIndex_idx" ON "ContentSkeleton"("sitePageId", "orderIndex");

-- Add foreign key constraints (using DO block to check if they exist first)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Site_batchId_fkey'
    ) THEN
        ALTER TABLE "Site" ADD CONSTRAINT "Site_batchId_fkey" 
        FOREIGN KEY ("batchId") REFERENCES "ScanBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Site_nicheId_fkey'
    ) THEN
        ALTER TABLE "Site" ADD CONSTRAINT "Site_nicheId_fkey" 
        FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Site_promptProfileId_fkey'
    ) THEN
        ALTER TABLE "Site" ADD CONSTRAINT "Site_promptProfileId_fkey" 
        FOREIGN KEY ("promptProfileId") REFERENCES "PromptProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SitePage_siteId_fkey'
    ) THEN
        ALTER TABLE "SitePage" ADD CONSTRAINT "SitePage_siteId_fkey" 
        FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ContentSkeleton_sitePageId_fkey'
    ) THEN
        ALTER TABLE "ContentSkeleton" ADD CONSTRAINT "ContentSkeleton_sitePageId_fkey" 
        FOREIGN KEY ("sitePageId") REFERENCES "SitePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
