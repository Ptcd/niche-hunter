import { inngest } from "./client";
import { prisma } from "@niche-hunter/db";
import { getBulkKeywordData } from "@niche-hunter/crawler";
import { getBulkKeywordDifficulty, getBulkLocationCodes } from "@niche-hunter/crawler";
import { getOrganicSERP, getMapsSERP } from "@niche-hunter/crawler";
import {
  calculateSerpWeakness,
  calculateLocalPackStrength,
  calculateOnpageCompetence,
  calculateFinalDifficulty,
  calculateOpportunity,
} from "@niche-hunter/core";
import { isLargeCity } from "@niche-hunter/core";

// Type for serializable volume data (Maps don't serialize between steps)
type VolumeDataRecord = Record<string, { volume: number; cpc: number }>;
type KdDataRecord = Record<string, number>;

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

      // Serialize keywords for passing between steps
      const serializedKeywords = validKeywords.map((kw) => ({
        id: kw.id,
        localizedQuery: kw.localizedQuery,
        cityId: kw.cityId,
        cityName: kw.city.city,
        cityState: kw.city.state,
        cityPayout: kw.city.payout,
        cityLocationCode: kw.city.dataforseoLocationCode,
        nicheKeyword: kw.nicheKeyword.keyword,
      }));

      // Get unique cities that need location code lookup
      const citiesNeedingLookup = [...new Map(
        validKeywords
          .filter(kw => !kw.city.dataforseoLocationCode)
          .map(kw => [`${kw.city.city},${kw.city.state}`, { city: kw.city.city, state: kw.city.state, id: kw.city.id }])
      ).values()];

      // Lookup location codes for cities that don't have them
      let cityLocationCodes: Record<string, number> = {};
      if (citiesNeedingLookup.length > 0) {
        console.log(`📍 Looking up location codes for ${citiesNeedingLookup.length} cities...`);
        const locationMap = await getBulkLocationCodes(citiesNeedingLookup);
        
        // Store location codes in database and build lookup map
        for (const [key, code] of locationMap.entries()) {
          cityLocationCodes[key] = code;
          const [city, state] = key.split(',');
          const cityRecord = citiesNeedingLookup.find(c => c.city === city && c.state === state);
          if (cityRecord) {
            await prisma.cityV5000.update({
              where: { id: cityRecord.id },
              data: { dataforseoLocationCode: code },
            });
          }
        }
        console.log(`✅ Found location codes for ${locationMap.size} cities`);
      }

      // Also include already-known location codes
      for (const kw of validKeywords) {
        if (kw.city.dataforseoLocationCode) {
          cityLocationCodes[`${kw.city.city},${kw.city.state}`] = kw.city.dataforseoLocationCode;
        }
      }

      return {
        batchId,
        keywords: serializedKeywords,
        localizedQueries: validKeywords.map((kw) => kw.localizedQuery),
        cityLocationCodes,
      };
    });

    if (!batchData) {
      return { success: true, message: "No keywords to process" };
    }

    // Step 2: Fetch volumes from Keywords Everywhere
    const volumeDataResult = await step.run("fetch-volumes", async () => {
      const { localizedQueries, keywords } = batchData;
      console.log(`📡 Fetching volumes for ${localizedQueries.length} keywords...`);
      
      const volumeMap = await getBulkKeywordData(localizedQueries);
      console.log(`✅ Keywords Everywhere returned ${volumeMap.size} results`);

      // Convert Map to plain object for serialization
      const volumeData: VolumeDataRecord = {};
      for (const [key, value] of volumeMap.entries()) {
        volumeData[key] = { volume: value.volume, cpc: value.cpc };
      }

      // Store metrics in database
      for (const kw of keywords) {
        const data = volumeData[kw.localizedQuery];
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

      return volumeData;
    });

    // Step 3: Filter cities with volume and fetch KD
    const filterResult = await step.run("filter-and-fetch-kd", async () => {
      const { keywords, cityLocationCodes } = batchData;
      const volumeData = volumeDataResult;
      
      // Filter out cities where ALL keywords have 0 volume
      const citiesWithVolume = new Set<string>();
      for (const kw of keywords) {
        const data = volumeData[kw.localizedQuery];
        if ((data?.volume || 0) > 0) {
          citiesWithVolume.add(kw.cityId);
        }
      }

      const keywordsWithCityVolume = keywords.filter(kw => 
        citiesWithVolume.has(kw.cityId)
      );

      // Group keywords by city location code for efficient KD fetching
      const keywordsByLocationCode = new Map<number, string[]>();
      const keywordsWithoutLocationCode: string[] = [];
      
      for (const kw of keywordsWithCityVolume) {
        const locationCode = kw.cityLocationCode || cityLocationCodes[`${kw.cityName},${kw.cityState}`];
        if (locationCode) {
          if (!keywordsByLocationCode.has(locationCode)) {
            keywordsByLocationCode.set(locationCode, []);
          }
          keywordsByLocationCode.get(locationCode)!.push(kw.localizedQuery);
        } else {
          keywordsWithoutLocationCode.push(kw.localizedQuery);
        }
      }

      console.log(`📊 Keywords grouped by location: ${keywordsByLocationCode.size} locations, ${keywordsWithoutLocationCode.length} without location code`);

      // Fetch KD from DataForSEO - by city location code for better accuracy
      let kdData: KdDataRecord = {};
      
      // Fetch KD for each location code group
      for (const [locationCode, kwList] of keywordsByLocationCode.entries()) {
        try {
          console.log(`🔍 Fetching KD for ${kwList.length} keywords with location code ${locationCode}...`);
          const kdMap = await getBulkKeywordDifficulty(kwList, locationCode);
          console.log(`✅ DataForSEO Labs returned ${kdMap.size} KD values for location ${locationCode}`);
          
          // Store with lowercase keys for consistent lookup
          for (const [key, value] of kdMap.entries()) {
            kdData[key.toLowerCase()] = value;
          }
        } catch (error: any) {
          console.error(`⚠️ DataForSEO Labs error for location ${locationCode}:`, error.message);
        }
      }

      // Fetch KD for keywords without location code using US national (fallback)
      if (keywordsWithoutLocationCode.length > 0) {
        try {
          console.log(`🔍 Fetching KD for ${keywordsWithoutLocationCode.length} keywords with US national location...`);
          const kdMap = await getBulkKeywordDifficulty(keywordsWithoutLocationCode, 2840);
          console.log(`✅ DataForSEO Labs returned ${kdMap.size} KD values for US national`);
          
          for (const [key, value] of kdMap.entries()) {
            kdData[key.toLowerCase()] = value;
          }
        } catch (error: any) {
          console.error(`⚠️ DataForSEO Labs error for US national:`, error.message);
        }
      }

      console.log(`📈 Total KD values collected: ${Object.keys(kdData).length}`)

      // Update KD in metrics (normalize to lowercase for matching - DataForSEO returns lowercase)
      for (const kw of keywordsWithCityVolume) {
        const kd = kdData[kw.localizedQuery] ?? kdData[kw.localizedQuery.toLowerCase()];
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
        const data = volumeData[kw.localizedQuery];
        return (data?.volume || 0) >= minVolume;
      });

      // Log all keywords (normalize KD lookup to lowercase - DataForSEO returns lowercase)
      for (const kw of keywordsWithCityVolume) {
        const data = volumeData[kw.localizedQuery];
        const vol = data?.volume || 0;
        const kd = kdData[kw.localizedQuery] ?? kdData[kw.localizedQuery.toLowerCase()];

        await updateProcessingLog(batchId, {
          keyword: kw.localizedQuery,
          volume: vol,
          cpc: data?.cpc || null,
          kd: kd !== undefined ? kd : null,
          status: vol >= minVolume ? 'passed' : 'filtered',
          reason: vol < minVolume ? `Volume ${vol} < ${minVolume}` : undefined,
        });
      }

      return { 
        passingKeywords, 
        kdData,
        volumeData 
      };
    });

    // Step 4: Process keywords in chunks (SERP analysis)
    const { passingKeywords, kdData, volumeData } = filterResult;
    const chunkSize = 10; // Process 10 keywords per step to avoid timeout

    for (let i = 0; i < passingKeywords.length; i += chunkSize) {
      const chunkIndex = i;
      const chunk = passingKeywords.slice(i, i + chunkSize);
      
      await step.run(`process-serp-chunk-${chunkIndex}`, async () => {
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
            const data = volumeData[kw.localizedQuery];
            const volume = data?.volume || 0;

            await updateProcessingLog(batchId, {
              keyword: kw.localizedQuery,
              volume,
              cpc: data?.cpc || null,
              kd: kdData[kw.localizedQuery] !== undefined ? kdData[kw.localizedQuery] : null,
              status: 'checking',
            });

            // Fetch SERP data
            const locationName = `${kw.cityName}, ${kw.cityState}, United States`;
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

            // Calculate scores (normalize KD lookup to lowercase - DataForSEO returns lowercase)
            const service = kw.nicheKeyword;
            const city = kw.cityName;
            const kd = kdData[kw.localizedQuery] ?? kdData[kw.localizedQuery.toLowerCase()] ?? null;

            const serpWeakness = calculateSerpWeakness(organicResults, service);
            const packStrength = calculateLocalPackStrength(localPackResults, service);
            const onpage = calculateOnpageCompetence(organicResults, service, city);

            const difficultyBreakdown = calculateFinalDifficulty(kd, serpWeakness, packStrength, onpage);

            if (!kw.cityPayout) {
              throw new Error(`Missing payout for ${kw.cityName}, ${kw.cityState}`);
            }

            const opportunityBreakdown = calculateOpportunity(
              volume,
              data?.cpc || 0,
              kw.cityPayout,
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

            // Update progress
            await prisma.scanBatch.update({
              where: { id: batchId },
              data: {
                processedKeywords: {
                  increment: 1,
                },
              },
            });

            await updateProcessingLog(batchId, {
              keyword: kw.localizedQuery,
              volume,
              cpc: data?.cpc || null,
              kd: kd !== undefined && kd !== null ? kd : null,
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
