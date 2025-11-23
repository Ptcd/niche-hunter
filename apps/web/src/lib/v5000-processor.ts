/**
 * V5000 Batch Processor
 * 
 * Orchestrates the complete V5000 analysis pipeline:
 * 1. Generate localized keywords
 * 2. Fetch volume/CPC from Keywords Everywhere
 * 3. Fetch KD from DataForSEO Labs
 * 4. Filter keywords (volume >= 10)
 * 5. Fetch SERP data (organic + local pack)
 * 6. Calculate difficulty and opportunity scores
 * 7. Store results in database
 */

import { prisma } from '@niche-hunter/db';
import { getBulkKeywordData } from '@niche-hunter/crawler';
import { getBulkKeywordDifficulty } from '@niche-hunter/crawler';
import { getOrganicSERP, getMapsSERP } from '@niche-hunter/crawler';
import {
  calculateSerpWeakness,
  calculateLocalPackStrength,
  calculateOnpageCompetence,
  calculateFinalDifficulty,
  calculateOpportunity,
} from '@niche-hunter/core';
import { isLargeCity } from '@niche-hunter/core';

interface ProcessingLogEntry {
  keyword: string;
  volume?: number | null;
  cpc?: number | null;
  kd?: number | null;
  status: 'checking' | 'passed' | 'filtered';
  reason?: string;
  timestamp: string;
}

/**
 * Update processing log in database
 */
async function updateProcessingLog(
  batchId: string,
  logEntry: Omit<ProcessingLogEntry, 'timestamp'>
) {
  try {
    const batch = await prisma.scanBatch.findUnique({
      where: { id: batchId },
      select: { processingLog: true },
    });

    const currentLog = (batch?.processingLog as any) || { entries: [] };
    if (!currentLog.entries) {
      currentLog.entries = [];
    }

    currentLog.entries.push({
      ...logEntry,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 500 entries to prevent log from growing too large
    if (currentLog.entries.length > 500) {
      currentLog.entries = currentLog.entries.slice(-500);
    }

    await prisma.scanBatch.update({
      where: { id: batchId },
      data: { processingLog: currentLog },
    });
  } catch (error) {
    // Don't fail processing if logging fails
    console.error('Failed to update processing log:', error);
  }
}

/**
 * Check if batch has been cancelled
 */
async function isBatchCancelled(batchId: string): Promise<boolean> {
  const batch = await prisma.scanBatch.findUnique({
    where: { id: batchId },
    select: { cancelledAt: true },
  });
  return batch?.cancelledAt !== null;
}

/**
 * Main batch processing function
 */
export async function processBatch(batchId: string) {
  console.log(`🚀 Starting batch processing for batch ${batchId}`);

  try {
    // Initialize processing log and set status to running
    await prisma.scanBatch.update({
      where: { id: batchId },
      data: {
        processingLog: { entries: [] },
        status: 'running',
      },
    });

    // Load batch with all related data
    const batch = await prisma.scanBatch.findUnique({
      where: { id: batchId },
      include: {
        niche: {
          include: {
            keywords: {
              where: { isActive: true },
            },
          },
        },
        keywords: {
          include: {
            city: true,
            nicheKeyword: true,
          },
        },
      },
    });

    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Filter large cities (> 300k population)
    const validKeywords = batch.keywords.filter((kw) => {
      const city = kw.city;
      const isLarge = isLargeCity(city.city, city.state);
      if (isLarge) {
        return false;
      }
      return true;
    });

    const skippedCities = batch.keywords.length - validKeywords.length;

    console.log(`✅ Filtered cities: ${validKeywords.length} valid, ${skippedCities} skipped`);

    // Update batch with skipped cities count
    await prisma.scanBatch.update({
      where: { id: batchId },
      data: {
        skippedCities,
        totalKeywords: validKeywords.length,
      },
    });

    if (validKeywords.length === 0) {
      await prisma.scanBatch.update({
        where: { id: batchId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
      return;
    }

    // Generate localized keyword strings
    const localizedQueries = validKeywords.map((kw) => kw.localizedQuery);
    console.log(`📊 Processing ${localizedQueries.length} keywords`);
    console.log(`📝 Sample keywords:`, localizedQueries.slice(0, 3));

    // Step 1: Fetch volume and CPC from Keywords Everywhere
    console.log(`📡 Fetching volumes and CPC from Keywords Everywhere...`);
    const volumeData = await getBulkKeywordData(localizedQueries);
    console.log(`✅ Keywords Everywhere returned ${volumeData.size} results`);

    // Filter out cities where ALL keywords have 0 volume
    const citiesWithVolume = new Map<string, boolean>();
    for (const kw of validKeywords) {
      const data = volumeData.get(kw.localizedQuery);
      const hasVolume = (data?.volume || 0) > 0;
      if (hasVolume) {
        citiesWithVolume.set(kw.cityId, true);
      }
    }

    // Filter keywords to only include cities with at least one keyword having volume > 0
    const keywordsWithCityVolume = validKeywords.filter(kw => 
      citiesWithVolume.has(kw.cityId)
    );

    const skippedCityCount = validKeywords.length - keywordsWithCityVolume.length;
    if (skippedCityCount > 0) {
      console.log(`⏭️  Skipped ${skippedCityCount} keywords from cities with zero volume`);
    }

    // Store metrics in database (only for cities with volume)
    for (const kw of keywordsWithCityVolume) {
      const data = volumeData.get(kw.localizedQuery);
      if (data) {
        await prisma.keywordMetricsV5000.upsert({
          where: { keywordId: kw.id },
          create: {
            keywordId: kw.id,
            searchVolume: data.volume,
            cpc: data.cpc,
            source: 'keywords_everywhere',
          },
          update: {
            searchVolume: data.volume,
            cpc: data.cpc,
            retrievedAt: new Date(),
          },
        });
      }
    }

    // Step 2: Fetch KD from DataForSEO Labs
    console.log(`📡 Fetching keyword difficulty from DataForSEO Labs...`);
    let kdData: Map<string, number>;
    try {
      kdData = await getBulkKeywordDifficulty(localizedQueries);
      console.log(`✅ DataForSEO Labs returned ${kdData.size} KD values`);
    } catch (error: any) {
      console.error(`⚠️ DataForSEO Labs error:`, error.message);
      // Continue with empty KD map - we'll calculate difficulty from SERP only
      kdData = new Map();
    }

    // Update KD in metrics (only for cities with volume)
    for (const kw of keywordsWithCityVolume) {
      const kd = kdData.get(kw.localizedQuery);
      if (kd !== undefined) {
        await prisma.keywordMetricsV5000.update({
          where: { keywordId: kw.id },
          data: { kd },
        });
      }
    }

    // Step 3: Filter keywords (volume >= 10) - only from cities with volume
    const minVolume = 10;
    const passingKeywords = keywordsWithCityVolume.filter((kw) => {
      const data = volumeData.get(kw.localizedQuery);
      const volume = data?.volume || 0;
      return volume >= minVolume;
    });

    console.log(`✅ Found ${passingKeywords.length} promising keywords for SERP analysis`);

    // Log filtered keywords (only for cities with volume)
    for (const kw of keywordsWithCityVolume) {
      const data = volumeData.get(kw.localizedQuery);
      const volume = data?.volume || 0;
      const kd = kdData.get(kw.localizedQuery);

      if (volume < minVolume) {
        await updateProcessingLog(batchId, {
          keyword: kw.localizedQuery,
          volume,
          cpc: data?.cpc || null,
          kd: kd !== undefined ? kd : null,
          status: 'filtered',
          reason: `Volume ${volume} < ${minVolume}`,
        });
      } else {
        await updateProcessingLog(batchId, {
          keyword: kw.localizedQuery,
          volume,
          cpc: data?.cpc || null,
          kd: kd !== undefined ? kd : null,
          status: 'passed',
        });
      }
    }

    // Step 4: Process each passing keyword with SERP analysis
    let processedCount = 0;
    for (const kw of passingKeywords) {
      // Check for cancellation
      if (await isBatchCancelled(batchId)) {
        console.log(`⏹️ Batch ${batchId} was cancelled during keyword processing`);
        await prisma.scanBatch.update({
          where: { id: batchId },
          data: { status: 'cancelled' },
        });
        return;
      }

      const data = volumeData.get(kw.localizedQuery);
      const volume = data?.volume || 0;

      // Update log
      await updateProcessingLog(batchId, {
        keyword: kw.localizedQuery,
        volume,
        cpc: data?.cpc || null,
        kd: kdData.get(kw.localizedQuery) !== undefined ? kdData.get(kw.localizedQuery)! : null,
        status: 'checking',
      });

      try {
        // Fetch SERP data
        const locationName = `${kw.city.city}, ${kw.city.state}, United States`;
        console.log(`🔍 Fetching SERP for: "${kw.localizedQuery}" in ${locationName}`);
        const [organicResults, localPackResults] = await Promise.all([
          getOrganicSERP(kw.localizedQuery, locationName).catch((err) => {
            console.error(`Error fetching organic SERP for ${kw.localizedQuery}:`, err.message);
            return [];
          }),
          getMapsSERP(kw.localizedQuery, locationName).catch((err) => {
            console.error(`Error fetching maps SERP for ${kw.localizedQuery}:`, err.message);
            return [];
          }),
        ]);
        
        console.log(`📊 SERP results: ${organicResults.length} organic, ${localPackResults.length} local pack`);

        // Store SERP snapshot
        await prisma.serpSnapshotV5000.upsert({
          where: { keywordId: kw.id },
          create: {
            keywordId: kw.id,
            organicResults: organicResults as any,
            localPackResults: localPackResults as any,
          },
          update: {
            organicResults: organicResults as any,
            localPackResults: localPackResults as any,
          },
        });

        // Calculate scores
        const service = kw.nicheKeyword.keyword;
        const city = kw.city.city;
        const kd = kdData.get(kw.localizedQuery) || null;

        const serpWeakness = calculateSerpWeakness(organicResults, service);
        const packStrength = calculateLocalPackStrength(localPackResults, service);
        const onpage = calculateOnpageCompetence(organicResults, service, city);

        console.log(`📈 Scores for "${kw.localizedQuery}": KD=${kd || 'N/A'}, SERP Weakness=${serpWeakness.toFixed(1)}, Pack Strength=${packStrength.toFixed(1)}, On-page=${onpage.toFixed(1)}`);

        const difficultyBreakdown = calculateFinalDifficulty(kd, serpWeakness, packStrength, onpage);
        
        console.log(`🎯 Final difficulty: ${difficultyBreakdown.finalDifficulty.toFixed(1)} (KD: ${difficultyBreakdown.kdComponent.toFixed(1)}, SERP: ${difficultyBreakdown.serpComponent.toFixed(1)}, Pack: ${difficultyBreakdown.packComponent.toFixed(1)}, On-page: ${difficultyBreakdown.onpageComponent.toFixed(1)})`);

        // Get lead value from city payout
        if (!kw.city.payout) {
          throw new Error(
            `Missing payout for ${kw.city.city}, ${kw.city.state}. Payout must be provided in CSV.`
          );
        }

        const opportunityBreakdown = calculateOpportunity(
          volume,
          data?.cpc || 0,
          kw.city.payout,
          difficultyBreakdown.finalDifficulty
        );

        // Store difficulty score with full breakdown
        await prisma.difficultyScoreV5000.upsert({
          where: { keywordId: kw.id },
          create: {
            keywordId: kw.id,
            serpWeakness,
            authorityProfile: 0, // Not used in V5000
            localPackStrength: packStrength,
            onpageCompetence: onpage,
            finalDifficulty: difficultyBreakdown.finalDifficulty,
            opportunity: opportunityBreakdown.opportunity,
            serpDifficulty: difficultyBreakdown.serpDifficulty,
            kdComponent: difficultyBreakdown.kdComponent,
            serpComponent: difficultyBreakdown.serpComponent,
            packComponent: difficultyBreakdown.packComponent,
            onpageComponent: difficultyBreakdown.onpageComponent,
            cpcMultiplier: opportunityBreakdown.cpcMultiplier,
            leadValueMultiplier: opportunityBreakdown.leadValueMultiplier,
            baseOpportunity: opportunityBreakdown.baseOpportunity,
          },
          update: {
            serpWeakness,
            localPackStrength: packStrength,
            onpageCompetence: onpage,
            finalDifficulty: difficultyBreakdown.finalDifficulty,
            opportunity: opportunityBreakdown.opportunity,
            serpDifficulty: difficultyBreakdown.serpDifficulty,
            kdComponent: difficultyBreakdown.kdComponent,
            serpComponent: difficultyBreakdown.serpComponent,
            packComponent: difficultyBreakdown.packComponent,
            onpageComponent: difficultyBreakdown.onpageComponent,
            cpcMultiplier: opportunityBreakdown.cpcMultiplier,
            leadValueMultiplier: opportunityBreakdown.leadValueMultiplier,
            baseOpportunity: opportunityBreakdown.baseOpportunity,
          },
        });

        processedCount++;

        // Update batch progress
        await prisma.scanBatch.update({
          where: { id: batchId },
          data: { processedKeywords: processedCount },
        });

        // Update log
        await updateProcessingLog(batchId, {
          keyword: kw.localizedQuery,
          volume,
          cpc: data?.cpc || null,
          kd: kd !== undefined ? kd : null,
          status: 'passed',
        });
      } catch (error: any) {
        console.error(`Error processing keyword ${kw.localizedQuery}:`, error.message);
        await prisma.keywordV5000.update({
          where: { id: kw.id },
          data: {
            isSkipped: true,
            skipReason: error.message.substring(0, 200),
          },
        });
        await updateProcessingLog(batchId, {
          keyword: kw.localizedQuery,
          volume: data?.volume || null,
          cpc: data?.cpc || null,
          kd: kdData.get(kw.localizedQuery) !== undefined ? kdData.get(kw.localizedQuery)! : null,
          status: 'filtered',
          reason: error.message.substring(0, 100),
        });
      }
    }

    // Mark batch as completed
    await prisma.scanBatch.update({
      where: { id: batchId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        processedKeywords: processedCount,
      },
    });

    console.log(`✅ Batch ${batchId} completed. Processed ${processedCount} keywords.`);
  } catch (error: any) {
    console.error(`❌ Error processing batch ${batchId}:`, error);
    await prisma.scanBatch.update({
      where: { id: batchId },
      data: {
        status: 'failed',
      },
    });
    throw error;
  }
}


