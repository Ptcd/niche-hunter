-- Migration: Add SiteLogo model for logo history
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS "SiteLogo" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "logoUrl" TEXT NOT NULL,
  "conceptName" TEXT,
  "prompt" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteLogo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteLogo_siteId_idx" ON "SiteLogo"("siteId");
CREATE INDEX IF NOT EXISTS "SiteLogo_siteId_isActive_idx" ON "SiteLogo"("siteId", "isActive");

ALTER TABLE "SiteLogo" ADD CONSTRAINT "SiteLogo_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

