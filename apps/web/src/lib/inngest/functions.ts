import { inngest } from "./client";
import { prisma } from "@niche-hunter/db";
import { getBulkKeywordData } from "@niche-hunter/crawler";
import { getBulkKeywordDifficulty, getBulkLocationCodes } from "@niche-hunter/crawler";
import { getOrganicSERP, getMapsSERP } from "@niche-hunter/crawler";
import { getPageMetrics, getDomainMetrics } from "@niche-hunter/crawler";
import {
  getCachedPageMetrics,
  getCachedDomainMetrics,
  storePageMetrics,
  storeDomainMetrics,
} from "@niche-hunter/crawler";
import {
  calculateSerpWeakness,
  calculateLocalPackStrength,
  calculateOnpageCompetence,
  calculateFinalDifficulty,
  calculateOpportunity,
  computeAuthorityDifficulty,
  type PageMetricsData,
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

    // Step 3: Filter keywords with volume
    const filterResult = await step.run("filter-keywords", async () => {
      const { keywords } = batchData;
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

      // Identify test cities (highest total volume) - top 3 cities
      const cityVolumes = new Map<string, number>();
      for (const kw of keywordsWithCityVolume) {
        const vol = volumeData[kw.localizedQuery]?.volume || 0;
        const cityKey = `${kw.cityName},${kw.cityState}`;
        cityVolumes.set(cityKey, (cityVolumes.get(cityKey) || 0) + vol);
      }

      const sortedCities = [...cityVolumes.entries()]
        .sort((a, b) => b[1] - a[1]);
      const testCities = new Set(sortedCities.slice(0, 3).map(([city]) => city));

      console.log(`🏙️ Test cities (top 3 by volume): ${[...testCities].join(', ')}`);

      // Find base keywords with 0 volume in ALL test cities
      const baseKeywordVolumeInTestCities = new Map<string, number>();
      for (const kw of keywordsWithCityVolume) {
        const cityKey = `${kw.cityName},${kw.cityState}`;
        if (!testCities.has(cityKey)) continue;
        
        const vol = volumeData[kw.localizedQuery]?.volume || 0;
        baseKeywordVolumeInTestCities.set(
          kw.nicheKeyword,
          (baseKeywordVolumeInTestCities.get(kw.nicheKeyword) || 0) + vol
        );
      }

      const deadKeywords = new Set(
        [...baseKeywordVolumeInTestCities.entries()]
          .filter(([_, vol]) => vol === 0)
          .map(([kw]) => kw)
      );

      console.log(`💀 Found ${deadKeywords.size} dead keywords (0 volume in all test cities): ${[...deadKeywords].slice(0, 5).join(', ')}${deadKeywords.size > 5 ? '...' : ''}`);

      // Filter keywords: skip 0-volume and dead keywords in smaller cities
      let skippedZeroVolume = 0;
      let skippedDeadKeywords = 0;
      
      const filteredKeywords = keywordsWithCityVolume.filter((kw) => {
        const vol = volumeData[kw.localizedQuery]?.volume || 0;
        
        // Skip 0-volume keywords
        if (vol <= 0) {
          skippedZeroVolume++;
          return false;
        }
        
        const cityKey = `${kw.cityName},${kw.cityState}`;
        const isTestCity = testCities.has(cityKey);
        
        // Skip dead keywords in smaller cities
        if (!isTestCity && deadKeywords.has(kw.nicheKeyword)) {
          skippedDeadKeywords++;
          return false;
        }
        
        return true;
      });

      console.log(`💰 Skipped ${skippedZeroVolume} keywords with 0 volume`);
      console.log(`💰 Skipped ${skippedDeadKeywords} dead keywords in smaller cities`);

      // Filter keywords with volume >= 10
      const minVolume = 10;
      const passingKeywords = filteredKeywords.filter((kw) => {
        const data = volumeData[kw.localizedQuery];
        return (data?.volume || 0) >= minVolume;
      });

      // Log all keywords
      for (const kw of keywordsWithCityVolume) {
        const data = volumeData[kw.localizedQuery];
        const vol = data?.volume || 0;

        await updateProcessingLog(batchId, {
          keyword: kw.localizedQuery,
          volume: vol,
          cpc: data?.cpc || null,
          kd: null, // No longer using KD from API
          status: vol >= minVolume ? 'passed' : 'filtered',
          reason: vol < minVolume ? `Volume ${vol} < ${minVolume}` : undefined,
        });
      }

      return { 
        passingKeywords, 
        volumeData 
      };
    });

    // Step 4: Process keywords in chunks (SERP analysis)
    const { passingKeywords, volumeData } = filterResult;
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
              kd: null, // Authority difficulty computed from page metrics, not KD API
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

            // Extract URLs from SERP results for authority metrics
            const serpUrls = organicResults.slice(0, 10).map(r => r.url).filter(Boolean);
            
            // Get cached page metrics and fetch missing ones
            let authorityDifficulty: number | null = null;
            try {
              const { cached: cachedPageMetrics, toFetch: urlsToFetch } = await getCachedPageMetrics(serpUrls);
              
              // Fetch missing page metrics
              let allPageMetrics = new Map(cachedPageMetrics);
              if (urlsToFetch.length > 0) {
                const fetchedMetrics = await getPageMetrics(urlsToFetch);
                for (const [url, metrics] of fetchedMetrics.entries()) {
                  allPageMetrics.set(url, metrics);
                }
                
                // Store newly fetched metrics
                await storePageMetrics([...fetchedMetrics.values()]);
              }
              
              // Extract domains and fetch domain metrics if needed
              const domains = [...new Set([...allPageMetrics.values()].map(m => m.domain))];
              const { cached: cachedDomainMetrics, toFetch: domainsToFetch } = await getCachedDomainMetrics(domains);
              
              if (domainsToFetch.length > 0) {
                const fetchedDomainMetrics = await getDomainMetrics(domainsToFetch);
                await storeDomainMetrics([...fetchedDomainMetrics.values()]);
                
                // Update page metrics with domain ranks
                for (const [url, pageMetrics] of allPageMetrics.entries()) {
                  const domainMetrics = fetchedDomainMetrics.get(pageMetrics.domain) || cachedDomainMetrics.get(pageMetrics.domain);
                  if (domainMetrics) {
                    pageMetrics.domainRank = domainMetrics.domainRank;
                  }
                }
              } else {
                // Use cached domain metrics
                for (const [url, pageMetrics] of allPageMetrics.entries()) {
                  const domainMetrics = cachedDomainMetrics.get(pageMetrics.domain);
                  if (domainMetrics) {
                    pageMetrics.domainRank = domainMetrics.domainRank;
                  }
                }
              }
              
              // Compute authority difficulty from page metrics
              const pageMetricsArray: PageMetricsData[] = serpUrls
                .map(url => allPageMetrics.get(url))
                .filter((m): m is PageMetricsData => m !== undefined)
                .map(m => ({
                  pageRank: m.pageRank,
                  backlinks: m.backlinks,
                  referringDomains: m.referringDomains,
                  domainRank: m.domainRank,
                }));
              
              authorityDifficulty = computeAuthorityDifficulty(pageMetricsArray);
            } catch (error: any) {
              console.error(`[Inngest] Error fetching authority metrics for ${kw.localizedQuery}:`, error.message);
              // Continue with fallback (no authority data)
            }

            // Calculate scores
            const service = kw.nicheKeyword;
            const city = kw.cityName;
            const serpWeakness = calculateSerpWeakness(organicResults, service);
            const packStrength = calculateLocalPackStrength(localPackResults, service);
            const onpage = calculateOnpageCompetence(organicResults, service, city);

            const difficultyBreakdown = calculateFinalDifficulty(authorityDifficulty, serpWeakness, packStrength, onpage);

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
                authorityProfile: authorityDifficulty ?? 0,
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
                authorityProfile: authorityDifficulty ?? 0,
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
              kd: authorityDifficulty, // Store authority difficulty (computed from page metrics)
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
