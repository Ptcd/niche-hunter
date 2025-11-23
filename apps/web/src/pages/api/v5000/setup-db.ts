import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

// Allow both GET and POST for convenience
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Test database connection first
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (connError: any) {
      console.error('Database connection test failed:', connError);
      return res.status(500).json({
        error: 'Database connection failed',
        message: connError.message,
        hint: 'Please verify your DATABASE_URL in .env.local is correct and the database is accessible',
      });
    }

    // Create all V5000 tables
    const tables = [
      // Niche table
      `CREATE TABLE IF NOT EXISTS "Niche" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "description" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Niche_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "Niche_slug_key" ON "Niche"("slug")`,
      `CREATE INDEX IF NOT EXISTS "Niche_slug_idx" ON "Niche"("slug")`,

      // NicheKeyword table
      `CREATE TABLE IF NOT EXISTS "NicheKeyword" (
        "id" TEXT NOT NULL,
        "nicheId" TEXT NOT NULL,
        "keyword" TEXT NOT NULL,
        "nationalVolume" INTEGER,
        "nationalKd" INTEGER,
        "intent" TEXT NOT NULL DEFAULT 'transactional',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "notes" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "NicheKeyword_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "NicheKeyword_nicheId_keyword_key" ON "NicheKeyword"("nicheId", "keyword")`,
      `CREATE INDEX IF NOT EXISTS "NicheKeyword_nicheId_idx" ON "NicheKeyword"("nicheId")`,

      // CityV5000 table
      `CREATE TABLE IF NOT EXISTS "CityV5000" (
        "id" TEXT NOT NULL,
        "city" TEXT NOT NULL,
        "state" TEXT NOT NULL,
        "countryCode" TEXT NOT NULL DEFAULT 'US',
        "dataforseoLocationCode" INTEGER,
        "population" INTEGER,
        "payout" DOUBLE PRECISION,
        "isSkipped" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CityV5000_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "CityV5000_city_state_countryCode_key" ON "CityV5000"("city", "state", "countryCode")`,
      `CREATE INDEX IF NOT EXISTS "CityV5000_city_state_idx" ON "CityV5000"("city", "state")`,

      // ScanBatch table
      `CREATE TABLE IF NOT EXISTS "ScanBatch" (
        "id" TEXT NOT NULL,
        "nicheId" TEXT NOT NULL,
        "name" TEXT,
        "status" TEXT NOT NULL DEFAULT 'queued',
        "totalKeywords" INTEGER,
        "skippedCities" INTEGER NOT NULL DEFAULT 0,
        "processedKeywords" INTEGER NOT NULL DEFAULT 0,
        "processingLog" JSONB,
        "cancelledAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMP(3),
        CONSTRAINT "ScanBatch_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE INDEX IF NOT EXISTS "ScanBatch_nicheId_status_idx" ON "ScanBatch"("nicheId", "status")`,
      `CREATE INDEX IF NOT EXISTS "ScanBatch_status_idx" ON "ScanBatch"("status")`,

      // KeywordV5000 table
      `CREATE TABLE IF NOT EXISTS "KeywordV5000" (
        "id" TEXT NOT NULL,
        "batchId" TEXT NOT NULL,
        "nicheKeywordId" TEXT NOT NULL,
        "cityId" TEXT NOT NULL,
        "localizedQuery" TEXT NOT NULL,
        "isSkipped" BOOLEAN NOT NULL DEFAULT false,
        "skipReason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "KeywordV5000_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "KeywordV5000_batchId_nicheKeywordId_cityId_key" ON "KeywordV5000"("batchId", "nicheKeywordId", "cityId")`,
      `CREATE INDEX IF NOT EXISTS "KeywordV5000_batchId_idx" ON "KeywordV5000"("batchId")`,
      `CREATE INDEX IF NOT EXISTS "KeywordV5000_cityId_idx" ON "KeywordV5000"("cityId")`,

      // KeywordMetricsV5000 table
      `CREATE TABLE IF NOT EXISTS "KeywordMetricsV5000" (
        "id" TEXT NOT NULL,
        "keywordId" TEXT NOT NULL,
        "searchVolume" INTEGER,
        "cpc" DOUBLE PRECISION,
        "kd" INTEGER,
        "source" TEXT NOT NULL DEFAULT 'keywords_everywhere',
        "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "KeywordMetricsV5000_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "KeywordMetricsV5000_keywordId_key" ON "KeywordMetricsV5000"("keywordId")`,
      `CREATE INDEX IF NOT EXISTS "KeywordMetricsV5000_keywordId_idx" ON "KeywordMetricsV5000"("keywordId")`,

      // SerpSnapshotV5000 table
      `CREATE TABLE IF NOT EXISTS "SerpSnapshotV5000" (
        "id" TEXT NOT NULL,
        "keywordId" TEXT NOT NULL,
        "organicResults" JSONB,
        "localPackResults" JSONB,
        "rawOrganicJson" JSONB,
        "rawMapsJson" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SerpSnapshotV5000_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "SerpSnapshotV5000_keywordId_key" ON "SerpSnapshotV5000"("keywordId")`,
      `CREATE INDEX IF NOT EXISTS "SerpSnapshotV5000_keywordId_idx" ON "SerpSnapshotV5000"("keywordId")`,

      // DifficultyScoreV5000 table
      `CREATE TABLE IF NOT EXISTS "DifficultyScoreV5000" (
        "id" TEXT NOT NULL,
        "keywordId" TEXT NOT NULL,
        "serpWeakness" DOUBLE PRECISION,
        "authorityProfile" DOUBLE PRECISION,
        "localPackStrength" DOUBLE PRECISION,
        "onpageCompetence" DOUBLE PRECISION,
        "finalDifficulty" DOUBLE PRECISION,
        "opportunity" DOUBLE PRECISION,
        "serpDifficulty" DOUBLE PRECISION,
        "kdComponent" DOUBLE PRECISION,
        "serpComponent" DOUBLE PRECISION,
        "packComponent" DOUBLE PRECISION,
        "onpageComponent" DOUBLE PRECISION,
        "cpcMultiplier" DOUBLE PRECISION,
        "leadValueMultiplier" DOUBLE PRECISION,
        "baseOpportunity" DOUBLE PRECISION,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DifficultyScoreV5000_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "DifficultyScoreV5000_keywordId_key" ON "DifficultyScoreV5000"("keywordId")`,
      `CREATE INDEX IF NOT EXISTS "DifficultyScoreV5000_keywordId_idx" ON "DifficultyScoreV5000"("keywordId")`,
      `CREATE INDEX IF NOT EXISTS "DifficultyScoreV5000_opportunity_idx" ON "DifficultyScoreV5000"("opportunity")`,
      `CREATE INDEX IF NOT EXISTS "DifficultyScoreV5000_finalDifficulty_idx" ON "DifficultyScoreV5000"("finalDifficulty")`,
    ];

    // Execute each table creation separately
    for (const sql of tables) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (error: any) {
        // Ignore errors for indexes/constraints that might already exist
        if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
          console.warn('Table creation warning:', error.message);
        }
      }
    }

    // CRITICAL: Fix scanBatchId -> batchId column name mismatch
    // Drop and recreate KeywordV5000 table if it has the wrong column name
    // This MUST run before foreign keys are created
    try {
      const hasWrongColumn = await prisma.$queryRaw<Array<{exists: boolean}>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'KeywordV5000' 
          AND column_name = 'scanBatchId'
          AND table_schema = 'public'
        ) as exists
      `;
      
      if (hasWrongColumn[0]?.exists) {
        console.log('⚠️  KeywordV5000 table has scanBatchId column - dropping and recreating...');
        // Drop dependent tables first
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "KeywordMetricsV5000" CASCADE`);
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "SerpSnapshotV5000" CASCADE`);
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "DifficultyScoreV5000" CASCADE`);
        // Drop KeywordV5000
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "KeywordV5000" CASCADE`);
        // Recreate with correct schema
        await prisma.$executeRawUnsafe(`
          CREATE TABLE "KeywordV5000" (
            "id" TEXT NOT NULL,
            "batchId" TEXT NOT NULL,
            "nicheKeywordId" TEXT NOT NULL,
            "cityId" TEXT NOT NULL,
            "localizedQuery" TEXT NOT NULL,
            "isSkipped" BOOLEAN NOT NULL DEFAULT false,
            "skipReason" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "KeywordV5000_pkey" PRIMARY KEY ("id")
          )
        `);
        // Recreate indexes
        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "KeywordV5000_batchId_nicheKeywordId_cityId_key" ON "KeywordV5000"("batchId", "nicheKeywordId", "cityId")`);
        await prisma.$executeRawUnsafe(`CREATE INDEX "KeywordV5000_batchId_idx" ON "KeywordV5000"("batchId")`);
        await prisma.$executeRawUnsafe(`CREATE INDEX "KeywordV5000_cityId_idx" ON "KeywordV5000"("cityId")`);
        console.log('✅ KeywordV5000 table recreated with batchId column');
      }
    } catch (error: any) {
      console.warn('Fix KeywordV5000 table warning:', error.message);
    }

    // Add foreign keys (using DO blocks to check existence first since IF NOT EXISTS doesn't work for constraints)
    const foreignKeys = [
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'NicheKeyword_nicheId_fkey' AND table_name = 'NicheKeyword') THEN ALTER TABLE "NicheKeyword" ADD CONSTRAINT "NicheKeyword_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ScanBatch_nicheId_fkey' AND table_name = 'ScanBatch') THEN ALTER TABLE "ScanBatch" ADD CONSTRAINT "ScanBatch_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'KeywordV5000_batchId_fkey' AND table_name = 'KeywordV5000') THEN ALTER TABLE "KeywordV5000" ADD CONSTRAINT "KeywordV5000_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ScanBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'KeywordV5000_nicheKeywordId_fkey' AND table_name = 'KeywordV5000') THEN ALTER TABLE "KeywordV5000" ADD CONSTRAINT "KeywordV5000_nicheKeywordId_fkey" FOREIGN KEY ("nicheKeywordId") REFERENCES "NicheKeyword"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'KeywordV5000_cityId_fkey' AND table_name = 'KeywordV5000') THEN ALTER TABLE "KeywordV5000" ADD CONSTRAINT "KeywordV5000_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "CityV5000"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'KeywordMetricsV5000_keywordId_fkey' AND table_name = 'KeywordMetricsV5000') THEN ALTER TABLE "KeywordMetricsV5000" ADD CONSTRAINT "KeywordMetricsV5000_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "KeywordV5000"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SerpSnapshotV5000_keywordId_fkey' AND table_name = 'SerpSnapshotV5000') THEN ALTER TABLE "SerpSnapshotV5000" ADD CONSTRAINT "SerpSnapshotV5000_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "KeywordV5000"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DifficultyScoreV5000_keywordId_fkey' AND table_name = 'DifficultyScoreV5000') THEN ALTER TABLE "DifficultyScoreV5000" ADD CONSTRAINT "DifficultyScoreV5000_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "KeywordV5000"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
    ];

    for (const sql of foreignKeys) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (error: any) {
        // Foreign key might already exist, ignore
        if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
          console.warn('Foreign key creation warning:', error.message);
        }
      }
    }

    // Add missing columns to other tables
    const addMissingColumns = [
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'KeywordV5000' AND column_name = 'nicheKeywordId') THEN
          ALTER TABLE "KeywordV5000" ADD COLUMN "nicheKeywordId" TEXT;
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'KeywordV5000' AND column_name = 'cityId') THEN
          ALTER TABLE "KeywordV5000" ADD COLUMN "cityId" TEXT;
        END IF;
      END $$;`,
    ];

    for (const sql of addMissingColumns) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (error: any) {
        console.warn('Add column warning:', error.message);
      }
    }

    // Fix foreign key constraints if they reference the wrong column name
    // This must happen AFTER the column rename
    const fixForeignKeys = [
      `DO $$ 
      BEGIN
        -- Drop ALL foreign keys that might reference scanBatchId (check multiple possible names)
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE (constraint_name LIKE '%scanBatchId%' OR constraint_name = 'KeywordV5000_scanBatchId_fkey')
                   AND table_name = 'KeywordV5000'
                   AND constraint_type = 'FOREIGN KEY') THEN
          ALTER TABLE "KeywordV5000" DROP CONSTRAINT IF EXISTS "KeywordV5000_scanBatchId_fkey" CASCADE;
        END IF;
      END $$;`,
      `ALTER TABLE "KeywordV5000" 
       ADD CONSTRAINT IF NOT EXISTS "KeywordV5000_batchId_fkey" 
       FOREIGN KEY ("batchId") REFERENCES "ScanBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
    ];

    for (const sql of fixForeignKeys) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (error: any) {
        console.warn('Fix foreign key warning:', error.message);
      }
    }

    // Add missing columns if they don't exist
    const addColumns = [
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CityV5000' AND column_name = 'payout') THEN
          ALTER TABLE "CityV5000" ADD COLUMN "payout" DOUBLE PRECISION;
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ScanBatch' AND column_name = 'processingLog') THEN
          ALTER TABLE "ScanBatch" ADD COLUMN "processingLog" JSONB;
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ScanBatch' AND column_name = 'cancelledAt') THEN
          ALTER TABLE "ScanBatch" ADD COLUMN "cancelledAt" TIMESTAMP(3);
        END IF;
      END $$;`,
    ];

    for (const sql of addColumns) {
      await prisma.$executeRawUnsafe(sql);
    }

    // Migrate volume column to searchVolume if it exists
    const migrateVolumeColumn = [
      `DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'KeywordMetricsV5000' AND column_name = 'volume')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'KeywordMetricsV5000' AND column_name = 'searchVolume') THEN
          ALTER TABLE "KeywordMetricsV5000" RENAME COLUMN "volume" TO "searchVolume";
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'KeywordMetricsV5000' AND column_name = 'searchVolume')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'KeywordMetricsV5000' AND column_name = 'volume') THEN
          ALTER TABLE "KeywordMetricsV5000" ADD COLUMN "searchVolume" INTEGER;
        END IF;
      END $$;`,
    ];

    for (const sql of migrateVolumeColumn) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (error: any) {
        console.warn('Volume column migration warning:', error.message);
      }
    }

    return res.status(200).json({
      message: 'V5000 database tables created successfully',
      tables: [
        'Niche',
        'NicheKeyword',
        'CityV5000',
        'ScanBatch',
        'KeywordV5000',
        'KeywordMetricsV5000',
        'SerpSnapshotV5000',
        'DifficultyScoreV5000',
      ],
    });
  } catch (error: any) {
    console.error('Error setting up database:', error);
    return res.status(500).json({
      error: 'Failed to setup database',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}


