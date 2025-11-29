-- Migration: Add logo and image fields
-- Run this in Supabase SQL Editor

-- Add logoPromptHint to Site table
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "logoPromptHint" TEXT;

-- Add heroImageUrl and heroImageAlt to SitePage table
ALTER TABLE "SitePage" ADD COLUMN IF NOT EXISTS "heroImageUrl" TEXT;
ALTER TABLE "SitePage" ADD COLUMN IF NOT EXISTS "heroImageAlt" TEXT;

