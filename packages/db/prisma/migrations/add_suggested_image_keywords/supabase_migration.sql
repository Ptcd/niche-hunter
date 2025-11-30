-- Migration: Add suggestedImageKeywords to SitePage
-- Run this in Supabase SQL Editor

-- Add suggestedImageKeywords column (array of text)
ALTER TABLE "SitePage" ADD COLUMN IF NOT EXISTS "suggestedImageKeywords" TEXT[] DEFAULT '{}';

