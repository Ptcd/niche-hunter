-- Migration: Add Multi-Tenant Auth System
-- Adds User, Account, Membership models and accountId to existing models

-- Create Role enum
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'VA', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create User table
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "sbUserId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Create Account table
CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- Create Membership table
CREATE TABLE IF NOT EXISTS "Membership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- Add unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "User_sbUserId_key" ON "User"("sbUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_accountId_key" ON "Membership"("userId", "accountId");

-- Add foreign keys
DO $$ BEGIN
  ALTER TABLE "Account" ADD CONSTRAINT "Account_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Membership" ADD CONSTRAINT "Membership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add accountId to existing tables (nullable for migration)
DO $$ BEGIN
  ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ScanBatch" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Niche" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Add foreign key constraints for accountId
DO $$ BEGIN
  ALTER TABLE "Site" ADD CONSTRAINT "Site_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ScanBatch" ADD CONSTRAINT "ScanBatch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Niche" ADD CONSTRAINT "Niche_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create indexes for accountId
CREATE INDEX IF NOT EXISTS "Site_accountId_idx" ON "Site"("accountId");
CREATE INDEX IF NOT EXISTS "ScanBatch_accountId_idx" ON "ScanBatch"("accountId");
CREATE INDEX IF NOT EXISTS "Niche_accountId_idx" ON "Niche"("accountId");

