-- Migration Part 1: Add new SiteStatus enum values
-- Run this FIRST, then run add_leads_costs_health.sql

-- Add SETUP enum value
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SETUP' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SiteStatus')) THEN
    ALTER TYPE "SiteStatus" ADD VALUE 'SETUP';
  END IF;
END $$;

-- Add GENERATING enum value
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'GENERATING' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SiteStatus')) THEN
    ALTER TYPE "SiteStatus" ADD VALUE 'GENERATING';
  END IF;
END $$;

-- Add REVIEW enum value
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'REVIEW' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SiteStatus')) THEN
    ALTER TYPE "SiteStatus" ADD VALUE 'REVIEW';
  END IF;
END $$;

