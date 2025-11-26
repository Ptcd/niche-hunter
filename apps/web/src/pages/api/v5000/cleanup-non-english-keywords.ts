import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

/**
 * Check if a keyword is primarily in English (Latin characters)
 */
function isEnglishKeyword(keyword: string): boolean {
  // Remove common punctuation and numbers
  const cleaned = keyword.replace(/[0-9\s\-_.,!?]/g, '');
  
  // Check if it contains primarily Latin characters (a-z, A-Z)
  const latinChars = cleaned.match(/[a-zA-Z]/g) || [];
  const nonLatinChars = cleaned.match(/[^\x00-\x7F]/g) || []; // Non-ASCII characters
  
  // If more than 20% non-Latin characters, reject it
  const totalChars = latinChars.length + nonLatinChars.length;
  if (totalChars === 0) return false;
  
  const latinRatio = latinChars.length / totalChars;
  return latinRatio >= 0.8; // At least 80% Latin characters
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🧹 [CLEANUP] Starting cleanup of non-English keywords...');

  try {
    // Find all keywords
    const allKeywords = await prisma.keywordV5000.findMany({
      include: {
        nicheKeyword: true,
        city: true,
        batch: true
      }
    });

    console.log(`📊 [CLEANUP] Found ${allKeywords.length} total keywords`);

    const nonEnglishKeywords = [];
    
    for (const kw of allKeywords) {
      const keywordText = kw.nicheKeyword.keyword;
      if (!isEnglishKeyword(keywordText)) {
        nonEnglishKeywords.push({
          id: kw.id,
          keyword: keywordText,
          city: `${kw.city.city}, ${kw.city.state}`,
          batchId: kw.batchId,
          batchName: kw.batch.name
        });
      }
    }

    if (nonEnglishKeywords.length === 0) {
      console.log('✅ [CLEANUP] No non-English keywords found!');
      return res.status(200).json({ 
        message: 'No non-English keywords found',
        deleted: 0 
      });
    }

    console.log(`❌ [CLEANUP] Found ${nonEnglishKeywords.length} non-English keywords to delete`);

    let deletedCount = 0;
    const errors: string[] = [];

    // Delete in batches
    for (const kw of nonEnglishKeywords) {
      try {
        // Delete related records first (metrics, SERP, difficulty scores)
        await prisma.keywordMetricsV5000.deleteMany({
          where: { keywordId: kw.id }
        });
        
        await prisma.serpSnapshotV5000.deleteMany({
          where: { keywordId: kw.id }
        });
        
        await prisma.difficultyScoreV5000.deleteMany({
          where: { keywordId: kw.id }
        });

        // Delete the keyword itself
        await prisma.keywordV5000.delete({
          where: { id: kw.id }
        });

        deletedCount++;
        console.log(`✅ [CLEANUP] Deleted: "${kw.keyword}" from ${kw.city}`);
      } catch (error: any) {
        const errorMsg = `Error deleting "${kw.keyword}": ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ [CLEANUP] ${errorMsg}`);
      }
    }

    // Also check and delete orphaned NicheKeyword records
    const orphanedNicheKeywords = await prisma.nicheKeyword.findMany({
      where: {
        keywords: {
          none: {}
        }
      }
    });

    let orphanedDeleted = 0;
    if (orphanedNicheKeywords.length > 0) {
      console.log(`🧹 [CLEANUP] Found ${orphanedNicheKeywords.length} orphaned NicheKeyword records`);
      await prisma.nicheKeyword.deleteMany({
        where: {
          id: {
            in: orphanedNicheKeywords.map(k => k.id)
          }
        }
      });
      orphanedDeleted = orphanedNicheKeywords.length;
      console.log(`✅ [CLEANUP] Deleted ${orphanedDeleted} orphaned NicheKeyword records`);
    }

    console.log(`✅ [CLEANUP] Cleanup complete! Deleted ${deletedCount} non-English keywords.`);

    return res.status(200).json({
      message: 'Cleanup completed',
      deleted: deletedCount,
      orphanedDeleted: orphanedDeleted,
      errors: errors.length > 0 ? errors : undefined,
      deletedKeywords: nonEnglishKeywords.map(k => ({
        keyword: k.keyword,
        city: k.city,
        batch: k.batchName
      }))
    });
  } catch (error: any) {
    console.error('❌ [CLEANUP] Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to cleanup keywords' 
    });
  }
}


