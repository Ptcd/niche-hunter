import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow both GET and POST for easy browser access
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Creating Keyword table...');
    
    // Create the table (single statement)
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
      )
    `);
    
    console.log('Creating indexes...');
    
    // Create indexes one at a time
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Keyword_scanId_idx" ON "Keyword"("scanId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Keyword_priority_idx" ON "Keyword"("priority")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Keyword_keyword_volume_idx" ON "Keyword"("keyword", "volume")`);
    
    console.log('Adding foreign key constraint...');
    
    // Add foreign key constraint (single DO block)
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
      END $$
    `);
    
    console.log('✅ Keyword table created successfully!');
    
    return res.status(200).json({ 
      success: true, 
      message: 'Keyword table created successfully!' 
    });
  } catch (error: any) {
    console.error('❌ Error creating Keyword table:', error.message);
    return res.status(500).json({ 
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
}

