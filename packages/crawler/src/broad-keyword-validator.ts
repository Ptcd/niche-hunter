/**
 * Broad Keyword Validator
 * 
 * Validates keywords at a national/broad level (without location) before
 * checking location-specific volumes. This saves API credits and ensures
 * we only analyze keywords with proven search volume.
 * 
 * Caching Strategy:
 * - Broad keyword volumes are extremely stable
 * - Once validated for a niche, results are cached indefinitely
 * - Future runs for the same niche reuse cached data (0 API calls)
 */

import { prisma } from '@niche-hunter/db';
import { getVolumeFromKeywordsEverywhereAPI, getKeywordsEverywhereAPIKey, shouldUseKeywordsEverywhereAPI, getRelatedKeywordsFromAPI } from './keywords-everywhere-api';

export interface ValidatedKeyword {
  keyword: string;
  volume: number;
  competition?: number;
  cpc?: string;
  isDiscovered?: boolean; // True if discovered from related keywords API
}

export interface ValidationResult {
  validated: ValidatedKeyword[];
  rejected: Array<{ keyword: string; volume: number; reason: string }>;
  discovered: ValidatedKeyword[]; // Keywords discovered from related keywords API
  stats: {
    total: number;
    validated: number;
    rejected: number;
    discovered: number; // Count of discovered keywords
    fromCache: number;
    fromAPI: number;
  };
}

/**
 * Get minimum volume threshold from settings or use default
 */
async function getMinimumVolumeThreshold(): Promise<number> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'MINIMUM_BROAD_VOLUME' },
    });
    
    if (setting && setting.value) {
      const threshold = parseInt(setting.value, 10);
      if (!isNaN(threshold) && threshold > 0) {
        return threshold;
      }
    }
  } catch (error) {
    // If setting doesn't exist or error, use default
  }
  
  // Default: 1,000 searches/month
  return 1000;
}

/**
 * Validate keywords at broad (national) level
 * 
 * @param niche - The niche name (e.g., "plumbing", "hvac")
 * @param keywords - Array of keywords to validate
 * @returns Validation result with validated and rejected keywords
 */
export async function validateBroadKeywords(
  niche: string,
  keywords: string[],
  discoverRelated: boolean = true
): Promise<ValidationResult> {
  console.log(`🔍 [Broad Keyword Validation] Starting validation for niche: "${niche}"`);
  console.log(`   📝 Total keywords to validate: ${keywords.length}`);
  console.log(`   🔗 Discover related keywords: ${discoverRelated ? 'Yes' : 'No'}`);
  
  const validated: ValidatedKeyword[] = [];
  const rejected: Array<{ keyword: string; volume: number; reason: string }> = [];
  const discovered: ValidatedKeyword[] = [];
  const discoveredKeywordsSet = new Set<string>(); // Track to avoid duplicates
  let fromCache = 0;
  let fromAPI = 0;
  
  const minimumVolume = await getMinimumVolumeThreshold();
  console.log(`   📊 Minimum volume threshold: ${minimumVolume.toLocaleString()}/month`);
  
  // Check if API is available
  const useAPI = await shouldUseKeywordsEverywhereAPI();
  if (!useAPI) {
    console.warn(`   ⚠️  Keywords Everywhere API not available - cannot validate keywords`);
    console.warn(`   💡 All keywords will be accepted (no validation performed)`);
    // Return all keywords as validated if API is not available
    return {
      validated: keywords.map(kw => ({ keyword: kw, volume: 0 })),
      rejected: [],
      discovered: [],
      stats: {
        total: keywords.length,
        validated: keywords.length,
        rejected: 0,
        discovered: 0,
        fromCache: 0,
        fromAPI: 0,
      },
    };
  }
  
  const apiKey = await getKeywordsEverywhereAPIKey();
  if (!apiKey) {
    console.warn(`   ⚠️  API key not found - cannot validate keywords`);
    return {
      validated: keywords.map(kw => ({ keyword: kw, volume: 0 })),
      rejected: [],
      discovered: [],
      stats: {
        total: keywords.length,
        validated: keywords.length,
        rejected: 0,
        discovered: 0,
        fromCache: 0,
        fromAPI: 0,
      },
    };
  }
  
  // Process each keyword
  for (const keyword of keywords) {
    try {
      // Check cache first
      const cached = await prisma.broadKeywordVolume.findUnique({
        where: {
          niche_keyword: {
            niche,
            keyword,
          },
        },
      });
      
      if (cached) {
        // Use cached data (no expiration - broad volumes are stable)
        fromCache++;
        console.log(`   ✅ [${keyword}] Cached: ${cached.volume.toLocaleString()}/month`);
        
        if (cached.volume >= minimumVolume) {
          validated.push({
            keyword,
            volume: cached.volume,
            competition: cached.competition || undefined,
            cpc: cached.cpc || undefined,
          });
        } else {
          rejected.push({
            keyword,
            volume: cached.volume,
            reason: `Volume ${cached.volume} below threshold ${minimumVolume}`,
          });
        }
        continue;
      }
      
      // Not in cache - fetch from API (no location specified = national/broad)
      console.log(`   📡 [${keyword}] Fetching broad volume from API...`);
      fromAPI++;
      
      try {
        // Query without location (national/broad volume)
        // Pass empty strings for city/state to get national-level data
        const result = await getVolumeFromKeywordsEverywhereAPI(
          keyword.trim(),
          '', // No city = national/broad
          '', // No state = national/broad
          apiKey
        );
        
        const volume = result.volume || 0;
        
        // Cache the result (even if volume is 0, so we don't query again)
        await prisma.broadKeywordVolume.upsert({
          where: {
            niche_keyword: {
              niche,
              keyword,
            },
          },
          create: {
            niche,
            keyword,
            volume,
            competition: result.competition || null,
            cpc: result.cpc ? `${result.cpc.currency}${result.cpc.value}` : null,
            source: 'keywords-everywhere-api',
          },
          update: {
            volume,
            competition: result.competition || null,
            cpc: result.cpc ? `${result.cpc.currency}${result.cpc.value}` : null,
            capturedAt: new Date(),
          },
        });
        
        console.log(`   ${volume >= minimumVolume ? '✅' : '❌'} [${keyword}] API: ${volume.toLocaleString()}/month`);
        
        if (volume >= minimumVolume) {
          validated.push({
            keyword,
            volume,
            competition: result.competition,
            cpc: result.cpc ? `${result.cpc.currency}${result.cpc.value}` : undefined,
          });
        } else {
          rejected.push({
            keyword,
            volume,
            reason: `Volume ${volume} below threshold ${minimumVolume}`,
          });
        }
      } catch (error: any) {
        console.error(`   ❌ [${keyword}] API error: ${error.message}`);
        // On API error, accept the keyword (fail open)
        validated.push({
          keyword,
          volume: 0,
        });
      }
    } catch (error: any) {
      console.error(`   ❌ [${keyword}] Validation error: ${error.message}`);
      // On error, accept the keyword (fail open)
      validated.push({
        keyword,
        volume: 0,
      });
    }
  }
  
  // PHASE 2: Discover related keywords for validated keywords
  if (discoverRelated && validated.length > 0 && apiKey) {
    console.log(`\n🔗 [Related Keywords Discovery] Discovering related keywords from ${validated.length} validated terms...`);
    
    // Add original keywords to the set to avoid discovering them
    keywords.forEach(kw => discoveredKeywordsSet.add(kw.toLowerCase().trim()));
    
    // Fetch related keywords for each validated keyword (limit to prevent API overuse)
    const maxKeywordsToExpand = Math.min(validated.length, 10); // Only expand top 10 keywords
    console.log(`   📊 Expanding ${maxKeywordsToExpand} highest-volume keywords`);
    
    // Sort by volume and take top keywords
    const keywordsToExpand = validated
      .sort((a, b) => b.volume - a.volume)
      .slice(0, maxKeywordsToExpand);
    
    for (const validatedKw of keywordsToExpand) {
      try {
        const relatedKeywords = await getRelatedKeywordsFromAPI(
          validatedKw.keyword,
          apiKey,
          'us'
        );
        
        console.log(`   🔍 "${validatedKw.keyword}" → Found ${relatedKeywords.length} related keywords`);
        
        // Validate and add related keywords
        for (const related of relatedKeywords) {
          const relatedLower = related.keyword.toLowerCase().trim();
          
          // Skip if already in the set or already validated
          if (discoveredKeywordsSet.has(relatedLower)) {
            continue;
          }
          
          // Check if meets minimum volume threshold
          if (related.volume >= minimumVolume) {
            // Cache the discovered keyword
            await prisma.broadKeywordVolume.upsert({
              where: {
                niche_keyword: {
                  niche,
                  keyword: related.keyword,
                },
              },
              create: {
                niche,
                keyword: related.keyword,
                volume: related.volume,
                competition: related.competition || null,
                source: 'keywords-everywhere-api',
              },
              update: {
                volume: related.volume,
                competition: related.competition || null,
                capturedAt: new Date(),
              },
            });
            
            discovered.push({
              keyword: related.keyword,
              volume: related.volume,
              competition: related.competition,
              isDiscovered: true,
            });
            
            discoveredKeywordsSet.add(relatedLower);
            console.log(`     ✅ "${related.keyword}": ${related.volume.toLocaleString()}/month (discovered)`);
          }
        }
        
        // Small delay between API calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`   ❌ Failed to fetch related keywords for "${validatedKw.keyword}": ${error.message}`);
      }
    }
  }
  
  // Log summary
  console.log(`\n📊 [Broad Keyword Validation] Summary:`);
  console.log(`   ✅ Validated: ${validated.length}/${keywords.length} keywords`);
  console.log(`   🔗 Discovered: ${discovered.length} additional keywords`);
  console.log(`   ❌ Rejected: ${rejected.length}/${keywords.length} keywords`);
  console.log(`   📦 From cache: ${fromCache} keywords`);
  console.log(`   📡 From API: ${fromAPI} keywords`);
  
  if (discovered.length > 0) {
    console.log(`\n   Top discovered keywords:`);
    discovered
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10)
      .forEach(({ keyword, volume }) => {
        console.log(`     🔗 "${keyword}": ${volume.toLocaleString()}/month`);
      });
    if (discovered.length > 10) {
      console.log(`     ... and ${discovered.length - 10} more`);
    }
  }
  
  if (rejected.length > 0) {
    console.log(`\n   Rejected keywords:`);
    rejected.slice(0, 10).forEach(({ keyword, volume, reason }) => {
      console.log(`     ❌ "${keyword}": ${volume.toLocaleString()}/month (${reason})`);
    });
    if (rejected.length > 10) {
      console.log(`     ... and ${rejected.length - 10} more`);
    }
  }
  
  return {
    validated,
    rejected,
    discovered,
    stats: {
      total: keywords.length,
      validated: validated.length,
      rejected: rejected.length,
      discovered: discovered.length,
      fromCache,
      fromAPI,
    },
  };
}

/**
 * Get validated keywords for a niche (from cache only, no API calls)
 * Useful for checking what keywords were previously validated
 */
export async function getValidatedKeywords(niche: string): Promise<ValidatedKeyword[]> {
  const cached = await prisma.broadKeywordVolume.findMany({
    where: { niche },
    orderBy: { volume: 'desc' },
  });
  
  const minimumVolume = await getMinimumVolumeThreshold();
  
  return cached
    .filter(c => c.volume >= minimumVolume)
    .map(c => ({
      keyword: c.keyword,
      volume: c.volume,
      competition: c.competition || undefined,
      cpc: c.cpc || undefined,
    }));
}

