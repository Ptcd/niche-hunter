import { inngest } from "./client";
import { prisma } from "@niche-hunter/db";
import { getBulkKeywordData } from "@niche-hunter/crawler";
import { getBulkKeywordDifficulty } from "@niche-hunter/crawler";
import { getOrganicSERP, getMapsSERP } from "@niche-hunter/crawler";
import {
  calculateSerpWeakness,
  calculateLocalPackStrength,
  calculateOnpageCompetence,
  calculateFinalDifficulty,
  calculateOpportunity,
} from "@niche-hunter/core";
import { isLargeCity } from "@niche-hunter/core";

/**
 * Update processing log in database
 */
async function updateProcessingLog(
  batchId: string,
  logEntry: {
    keyword: string;
    volume?: number | null;
    cpc?: number | null;
    kd?: number | null;
    status: 'checking' | 'passed' | 'filtered';
    reason?: string;
  }
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

    // Keep only last 500 entries
    if (currentLog.entries.length > 500) {
      currentLog.entries = currentLog.entries.slice(-500);
    }

    await prisma.scanBatch.update({
      where: { id: batchId },
      data: { processingLog: currentLog },
    });
  } catch (error) {
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

export const processBatch = inngest.createFunction(
  { id: "process-batch", name: "Process Batch Keywords" },
  { event: "batch/process" },
  async ({ event, step }) => {
    const { batchId } = event.data;

    // Step 1: Initialize and fetch batch data
    const batchData = await step.run("initialize-batch", async () => {
      await prisma.scanBatch.update({
        where: { id: batchId },
        data: {
          processingLog: { entries: [] },
          status: 'running',
        },
      });

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

      // Filter large cities
      const validKeywords = batch.keywords.filter((kw) => {
        const city = kw.city;
        const isLarge = isLargeCity(city.city, city.state);
        return !isLarge;
      });

      const skippedCities = batch.keywords.length - validKeywords.length;

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
        return null;
      }

      return {
        batchId,
        keywords: validKeywords,
        localizedQueries: validKeywords.map((kw) => kw.localizedQuery),
      };
    });

    if (!batchData) {
      return { success: true, message: "No keywords to process" };
    }

    // Step 2: Fetch volumes from Keywords Everywhere (in chunks of 100)
    const volumeData = await step.run("fetch-volumes", async () => {
      const { localizedQueries } = batchData;
      console.log(`📡 Fetching volumes for ${localizedQueries.length} keywords...`);
      
      const volumeMap = await getBulkKeywordData(localizedQueries);
      console.log(`✅ Keywords Everywhere returned ${volumeMap.size} results`);

      // Store metrics in database
      for (const kw of batchData.keywords) {
        const data = volumeMap.get(kw.localizedQuery);
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

      return volumeMap;
    });

    // Step 3: Filter cities with volume and fetch KD
    const keywordsWithVolume = await step.run("filter-and-fetch-kd", async () => {
      const { keywords, localizedQueries } = batchData;
      
      // Filter out cities where ALL keywords have 0 volume
      const citiesWithVolume = new Set<string>();
      for (const kw of keywords) {
        const data = volumeData.get(kw.localizedQuery);
        if ((data?.volume || 0) > 0) {
          citiesWithVolume.add(kw.cityId);
        }
      }

      const keywordsWithCityVolume = keywords.filter(kw => 
        citiesWithVolume.has(kw.cityId)
      );

      // Fetch KD from DataForSEO
      let kdData: Map<string, number>;
      try {
        kdData = await getBulkKeywordDifficulty(localizedQueries);
        console.log(`✅ DataForSEO Labs returned ${kdData.size} KD values`);
      } catch (error: any) {
        console.error(`⚠️ DataForSEO Labs error:`, error.message);
        kdData = new Map();
      }

      // Update KD in metrics
      for (const kw of keywordsWithCityVolume) {
        const kd = kdData.get(kw.localizedQuery);
        if (kd !== undefined) {
          await prisma.keywordMetricsV5000.update({
            where: { keywordId: kw.id },
            data: { kd },
          });
        }
      }

      // Filter keywords with volume >= 10
      const minVolume = 10;
      const passingKeywords = keywordsWithCityVolume.filter((kw) => {
        const data = volumeData.get(kw.localizedQuery);
        return (data?.volume || 0) >= minVolume;
      });

      // Log all keywords
      for (const kw of keywordsWithCityVolume) {
        const data = volumeData.get(kw.localizedQuery);
        const vol = data?.volume || 0;
        const kd = kdData.get(kw.localizedQuery);

        await updateProcessingLog(batchId, {
          keyword: kw.localizedQuery,
          volume: vol,
          cpc: data?.cpc || null,
          kd: kd !== undefined ? kd : null,
          status: vol >= minVolume ? 'passed' : 'filtered',
          reason: vol < minVolume ? `Volume ${vol} < ${minVolume}` : undefined,
        });
      }

      return { passingKeywords, kdData };
    });

    // Step 4: Process keywords in chunks (SERP analysis)
    const { passingKeywords, kdData } = keywordsWithVolume;
    const chunkSize = 10; // Process 10 keywords per step to avoid timeout

    for (let i = 0; i < passingKeywords.length; i += chunkSize) {
      const chunk = passingKeywords.slice(i, i + chunkSize);
      
      await step.run(`process-serp-chunk-${i}`, async () => {
        // Check for cancellation
        if (await isBatchCancelled(batchId)) {
          await prisma.scanBatch.update({
            where: { id: batchId },
            data: { status: 'cancelled' },
          });
          return { cancelled: true };
        }

        for (const kw of chunk) {
          try {
            const data = volumeData.get(kw.localizedQuery);
            const volume = data?.volume || 0;

            await updateProcessingLog(batchId, {
              keyword: kw.localizedQuery,
              volume,
              cpc: data?.cpc || null,
              kd: kdData.get(kw.localizedQuery) !== undefined ? kdData.get(kw.localizedQuery)! : null,
              status: 'checking',
            });

            // Fetch SERP data
            const locationName = `${kw.city.city}, ${kw.city.state}, United States`;
            const [organicResults, localPackResults] = await Promise.all([
              getOrganicSERP(kw.localizedQuery, locationName).catch(() => []),
              getMapsSERP(kw.localizedQuery, locationName).catch(() => []),
            ]);

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

            const difficultyBreakdown = calculateFinalDifficulty(kd, serpWeakness, packStrength, onpage);

            if (!kw.city.payout) {
              throw new Error(`Missing payout for ${kw.city.city}, ${kw.city.state}`);
            }

            const opportunityBreakdown = calculateOpportunity(
              volume,
              data?.cpc || 0,
              kw.city.payout,
              difficultyBreakdown.finalDifficulty
            );

            // Store difficulty score
            await prisma.difficultyScoreV5000.upsert({
              where: { keywordId: kw.id },
              create: {
                keywordId: kw.id,
                serpWeakness,
                authorityProfile: 0,
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
                skipReason: error.message,
              },
            });
          }
        }

        return { processed: chunk.length };
      });
    }

    // Step 5: Mark batch as completed
    await step.run("complete-batch", async () => {
      await prisma.scanBatch.update({
        where: { id: batchId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
    });

    return { success: true, processed: passingKeywords.length };
  }
);

