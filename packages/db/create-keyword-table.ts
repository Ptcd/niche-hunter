import { prisma } from './src/index';

async function createKeywordTable() {
  try {
    console.log('Creating Keyword table...');
    
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Keyword" (
        "id" TEXT NOT NULL,
        "scanId" TEXT NOT NULL,
        "keyword" TEXT NOT NULL,
        "volume" INTEGER NOT NULL,
        "difficulty" DOUBLE PRECISION,
        "cpc" DOUBLE PRECISION,
        "intent" TEXT,
        "priority" DOUBLE PRECISION,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
      );
    `);
    
    console.log('Creating indexes...');
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Keyword_scanId_idx" ON "Keyword"("scanId");
      CREATE INDEX IF NOT EXISTS "Keyword_priority_idx" ON "Keyword"("priority");
      CREATE INDEX IF NOT EXISTS "Keyword_keyword_volume_idx" ON "Keyword"("keyword", "volume");
    `);
    
    console.log('Adding foreign key constraint...');
    
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'Keyword_scanId_fkey'
        ) THEN
          ALTER TABLE "Keyword" 
          ADD CONSTRAINT "Keyword_scanId_fkey" 
          FOREIGN KEY ("scanId") 
          REFERENCES "Scan"("id") 
          ON DELETE CASCADE 
          ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    
    console.log('✅ Keyword table created successfully!');
  } catch (error: any) {
    console.error('❌ Error creating Keyword table:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createKeywordTable();

