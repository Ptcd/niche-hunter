import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Purging bad cached volumes (where keyword doesn\'t contain city)...');
    
    // Delete VolumeSample rows where city is not null but the cached keyword doesn't contain the city
    // These are likely national volumes that were incorrectly cached as city data
    // Use raw SQL to check if keyword contains city (case-insensitive)
    // Note: This is a simple check - if keyword is null or doesn't contain city, delete it
    const result = await prisma.$executeRawUnsafe(`
      DELETE FROM "VolumeSample"
      WHERE "city" IS NOT NULL 
        AND (
          "keyword" IS NULL 
          OR LOWER("keyword") NOT LIKE '%' || LOWER("city") || '%'
        )
    `);
    
    console.log(`✅ Purged bad cached volumes`);
    
    return res.status(200).json({ 
      success: true, 
      message: `Purged bad cached volumes`,
      count: typeof result === 'number' ? result : 0
    });
  } catch (error: any) {
    console.error('❌ Error purging bad volumes:', error.message);
    return res.status(500).json({ 
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
}
