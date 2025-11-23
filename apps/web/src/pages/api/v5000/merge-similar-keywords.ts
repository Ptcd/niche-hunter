import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

/**
 * Normalize keyword to a canonical form
 */
function normalizeKeyword(keyword: string): string {
  let normalized = keyword.toLowerCase().trim();
  
  normalized = normalized
    .replace(/\ba\/c\b/g, 'ac') // "a/c" -> "ac"
    .replace(/\bair conditioning\b/g, 'air conditioner') // "air conditioning" -> "air conditioner"
    .replace(/\bhva\/c\b/g, 'hvac') // "hva/c" -> "hvac"
    .replace(/\s+/g, ' ') // Multiple spaces -> single space
    .replace(/[.,;:!?]/g, '') // Remove punctuation
    .trim();
  
  return normalized;
}

/**
 * Check if two keywords are essentially the same
 */
function areKeywordsEquivalent(keyword1: string, keyword2: string): boolean {
  const norm1 = normalizeKeyword(keyword1);
  const norm2 = normalizeKeyword(keyword2);
  
  if (norm1 === norm2) return true;
  
  // Check if difference is just location modifiers
  const locationModifiers = ['near me', 'nearby', 'local', 'in ', 'near ', 'around '];
  const withoutLocation1 = locationModifiers.reduce((str, mod) => str.replace(mod, ''), norm1).trim();
  const withoutLocation2 = locationModifiers.reduce((str, mod) => str.replace(mod, ''), norm2).trim();
  
  if (withoutLocation1 === withoutLocation2) return true;
  
  return false;
}

/**
 * API endpoint to merge similar keywords in the database
 * Merges variants like "ac repair" and "a/c repair" into one
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { batchId } = req.body;

  if (!batchId) {
    return res.status(400).json({ error: 'batchId is required' });
  }

  console.log(`🔄 [MERGE-KEYWORDS] Starting merge for batch: ${batchId}`);

  try {
    // Get all keywords for this batch
    const allKeywords = await prisma.keywordV5000.findMany({
      where: {
        batchId: batchId,
        isSkipped: false,
      },
      include: {
        nicheKeyword: true,
        city: true,
        metrics: true,
        difficultyScore: true,
      },
    });

    console.log(`📊 [MERGE-KEYWORDS] Found ${allKeywords.length} keywords to process`);

    // Group by city (merge within each city)
    const keywordsByCity = new Map<string, typeof allKeywords>();
    for (const kw of allKeywords) {
      const cityKey = kw.cityId;
      if (!keywordsByCity.has(cityKey)) {
        keywordsByCity.set(cityKey, []);
      }
      keywordsByCity.get(cityKey)!.push(kw);
    }

    let totalMerged = 0;
    const mergeLog: string[] = [];
    const errors: string[] = [];

    // Process each city separately
    for (const [cityId, cityKeywords] of keywordsByCity.entries()) {
      console.log(`\n🏙️  [MERGE-KEYWORDS] Processing city: ${cityKeywords[0]?.city.city}, ${cityKeywords[0]?.city.state} (${cityKeywords.length} keywords)`);

      // Group keywords by normalized form
      const normalizedGroups = new Map<string, typeof cityKeywords>();
      
      for (const kw of cityKeywords) {
        const normalized = normalizeKeyword(kw.nicheKeyword.keyword);
        
        if (!normalizedGroups.has(normalized)) {
          normalizedGroups.set(normalized, []);
        }
        normalizedGroups.get(normalized)!.push(kw);
      }

      // Find groups with multiple keywords (duplicates/variants)
      for (const [normalized, group] of normalizedGroups.entries()) {
        if (group.length > 1) {
          // Sort by volume (descending), then by keyword length (ascending)
          group.sort((a, b) => {
            const volA = a.metrics?.volume || 0;
            const volB = b.metrics?.volume || 0;
            if (volB !== volA) return volB - volA;
            return a.nicheKeyword.keyword.length - b.nicheKeyword.keyword.length;
          });

          const keepKeyword = group[0];
          const mergeKeywords = group.slice(1);

          console.log(`   🔄 Merging ${group.length} variants of "${normalized}":`);
          console.log(`      ✅ Keeping: "${keepKeyword.nicheKeyword.keyword}" (vol: ${keepKeyword.metrics?.volume || 0})`);
          
          for (const mergeKw of mergeKeywords) {
            try {
              console.log(`      ❌ Merging: "${mergeKw.nicheKeyword.keyword}" (vol: ${mergeKw.metrics?.volume || 0})`);
              
              // Delete related records first
              await prisma.keywordMetricsV5000.deleteMany({
                where: { keywordId: mergeKw.id }
              }).catch(err => {
                console.warn(`      ⚠️  Warning deleting metrics for "${mergeKw.nicheKeyword.keyword}":`, err.message);
              });
              
              await prisma.serpSnapshotV5000.deleteMany({
                where: { keywordId: mergeKw.id }
              }).catch(err => {
                console.warn(`      ⚠️  Warning deleting SERP for "${mergeKw.nicheKeyword.keyword}":`, err.message);
              });
              
              await prisma.difficultyScoreV5000.deleteMany({
                where: { keywordId: mergeKw.id }
              }).catch(err => {
                console.warn(`      ⚠️  Warning deleting difficulty for "${mergeKw.nicheKeyword.keyword}":`, err.message);
              });

              // Delete the keyword
              await prisma.keywordV5000.delete({
                where: { id: mergeKw.id }
              });

              totalMerged++;
              mergeLog.push(`Merged "${mergeKw.nicheKeyword.keyword}" into "${keepKeyword.nicheKeyword.keyword}" in ${keepKeyword.city.city}, ${keepKeyword.city.state}`);
            } catch (error: any) {
              const errorMsg = `Error merging "${mergeKw.nicheKeyword.keyword}": ${error.message}`;
              console.error(`      ❌ ${errorMsg}`);
              console.error(`      ❌ Error details:`, error);
              errors.push(errorMsg);
              mergeLog.push(`ERROR: ${errorMsg}`);
            }
          }
        }
      }
    }

    // Also check for cross-normalized duplicates (e.g., "ac repair" and "a/c repair" in different groups)
    // This handles cases where normalization didn't catch them in the first pass
    console.log(`\n🔄 [MERGE-KEYWORDS] Checking for cross-normalized duplicates...`);
    
    const remainingKeywords = await prisma.keywordV5000.findMany({
      where: {
        batchId: batchId,
        isSkipped: false,
      },
      include: {
        nicheKeyword: true,
        city: true,
        metrics: true,
      },
    });

    // Group by city again
    const remainingByCity = new Map<string, typeof remainingKeywords>();
    for (const kw of remainingKeywords) {
      const cityKey = kw.cityId;
      if (!remainingByCity.has(cityKey)) {
        remainingByCity.set(cityKey, []);
      }
      remainingByCity.get(cityKey)!.push(kw);
    }

    let crossMerged = 0;
    for (const [cityId, cityKeywords] of remainingByCity.entries()) {
      const processed = new Set<string>();
      
      for (let i = 0; i < cityKeywords.length; i++) {
        const kw1 = cityKeywords[i];
        if (processed.has(kw1.id)) continue;
        
        const kw1Norm = normalizeKeyword(kw1.nicheKeyword.keyword);
        const equivalent: typeof cityKeywords = [kw1];
        
        // Find all equivalent keywords
        for (let j = i + 1; j < cityKeywords.length; j++) {
          const kw2 = cityKeywords[j];
          if (processed.has(kw2.id)) continue;
          
          if (areKeywordsEquivalent(kw1.nicheKeyword.keyword, kw2.nicheKeyword.keyword)) {
            equivalent.push(kw2);
            processed.add(kw2.id);
          }
        }
        
        if (equivalent.length > 1) {
          // Sort by volume
          equivalent.sort((a, b) => {
            const volA = a.metrics?.volume || 0;
            const volB = b.metrics?.volume || 0;
            if (volB !== volA) return volB - volA;
            return a.nicheKeyword.keyword.length - b.nicheKeyword.keyword.length;
          });

          const keepKeyword = equivalent[0];
          const mergeKeywords = equivalent.slice(1);

          console.log(`   🔄 Cross-merge: ${equivalent.length} equivalent keywords:`);
          console.log(`      ✅ Keeping: "${keepKeyword.nicheKeyword.keyword}"`);
          
          for (const mergeKw of mergeKeywords) {
            try {
              console.log(`      ❌ Merging: "${mergeKw.nicheKeyword.keyword}"`);
              
              // Delete related records
              await prisma.keywordMetricsV5000.deleteMany({
                where: { keywordId: mergeKw.id }
              }).catch(err => {
                console.warn(`      ⚠️  Warning deleting metrics for "${mergeKw.nicheKeyword.keyword}":`, err.message);
              });
              
              await prisma.serpSnapshotV5000.deleteMany({
                where: { keywordId: mergeKw.id }
              }).catch(err => {
                console.warn(`      ⚠️  Warning deleting SERP for "${mergeKw.nicheKeyword.keyword}":`, err.message);
              });
              
              await prisma.difficultyScoreV5000.deleteMany({
                where: { keywordId: mergeKw.id }
              }).catch(err => {
                console.warn(`      ⚠️  Warning deleting difficulty for "${mergeKw.nicheKeyword.keyword}":`, err.message);
              });

              await prisma.keywordV5000.delete({
                where: { id: mergeKw.id }
              });

              crossMerged++;
              mergeLog.push(`Cross-merged "${mergeKw.nicheKeyword.keyword}" into "${keepKeyword.nicheKeyword.keyword}" in ${keepKeyword.city.city}, ${keepKeyword.city.state}`);
            } catch (error: any) {
              const errorMsg = `Error cross-merging "${mergeKw.nicheKeyword.keyword}": ${error.message}`;
              console.error(`      ❌ ${errorMsg}`);
              console.error(`      ❌ Error details:`, error);
              errors.push(errorMsg);
              mergeLog.push(`ERROR: ${errorMsg}`);
            }
          }
        }
        
        processed.add(kw1.id);
      }
    }

    // Clean up orphaned NicheKeyword records (only those that were part of this batch)
    // Get all nicheKeywordIds that were in the batch
    const nicheKeywordIdsInBatch = new Set(
      allKeywordsInBatch.map(kw => kw.nicheKeywordId)
    );

    // Find nicheKeywords that are no longer referenced by ANY KeywordV5000 (in any batch)
    // But only check keywords that were part of this batch
    const orphanedNicheKeywords: Array<{ id: string }> = [];
    
    for (const nicheKeywordId of nicheKeywordIdsInBatch) {
      const referenceCount = await prisma.keywordV5000.count({
        where: {
          nicheKeywordId: nicheKeywordId
        }
      });
      
      if (referenceCount === 0) {
        orphanedNicheKeywords.push({ id: nicheKeywordId });
      }
    }

    let orphanedDeleted = 0;
    if (orphanedNicheKeywords.length > 0) {
      console.log(`\n🧹 [MERGE-KEYWORDS] Deleting ${orphanedNicheKeywords.length} orphaned NicheKeyword records...`);
      try {
        await prisma.nicheKeyword.deleteMany({
          where: {
            id: {
              in: orphanedNicheKeywords.map(k => k.id)
            }
          }
        });
        orphanedDeleted = orphanedNicheKeywords.length;
      } catch (error: any) {
        console.error(`❌ [MERGE-KEYWORDS] Error deleting orphaned keywords:`, error.message);
        errors.push(`Error deleting orphaned keywords: ${error.message}`);
      }
    }

    const totalDeleted = totalMerged + crossMerged;
    console.log(`\n✅ [MERGE-KEYWORDS] Complete! Merged ${totalDeleted} duplicate keywords (${totalMerged} normalized + ${crossMerged} cross-normalized), deleted ${orphanedDeleted} orphaned records`);

    return res.status(200).json({
      message: errors.length > 0 ? 'Merge completed with some errors' : 'Merge completed successfully',
      merged: totalDeleted,
      normalizedMerged: totalMerged,
      crossMerged: crossMerged,
      orphanedDeleted: orphanedDeleted,
      errors: errors.length > 0 ? errors : undefined,
      errorCount: errors.length,
      mergeLog: mergeLog.slice(0, 50) // Return first 50 merge operations
    });
  } catch (error: any) {
    console.error('❌ [MERGE-KEYWORDS] Error:', error);
    console.error('❌ [MERGE-KEYWORDS] Error stack:', error.stack);
    console.error('❌ [MERGE-KEYWORDS] Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      name: error.name
    });
    return res.status(500).json({ 
      error: error.message || 'Failed to merge keywords',
      code: error.code,
      meta: error.meta,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

