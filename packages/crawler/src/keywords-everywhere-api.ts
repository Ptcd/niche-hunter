/**
 * Keywords Everywhere API integration for fetching keyword search volumes
 * This is a more reliable alternative to browser automation
 * 
 * To use this:
 * 1. Get your API key from https://keywordseverywhere.com/first-install-addon.html
 * 2. Add KEYWORDS_EVERYWHERE_API_KEY=your_key_here to your .env file (or use settings dashboard)
 * 
 * Configuration via environment variables:
 * - KEYWORDS_EVERYWHERE_API_KEY: Your API key (required)
 * - KEYWORDS_EVERYWHERE_COUNTRY: Default country code (default: us)
 * - KEYWORDS_EVERYWHERE_CURRENCY: Default currency (default: usd)
 * - KEYWORDS_EVERYWHERE_DATA_SOURCE: Data source (gkp|cli, default: cli)
 * 
 * API Documentation: https://api.keywordseverywhere.com/docs/
 */

import { prisma } from '@niche-hunter/db';

export interface KeywordsEverywhereVolumeResponse {
  volume: number;
  competition?: number;
  cpc?: { currency: string; value: string };
  trend?: Array<{ month: string; year: number; value: number }>;
}

interface KeywordsEverywhereApiResponse {
  data: Array<{
    vol: number;
    keyword: string;
    competition: number;
    cpc: {
      currency: string;
      value: string;
    };
    trend: Array<{
      month: string;
      year: number;
      value: number;
    }>;
  }>;
  credits: number;
  credits_consumed: number;
  time: number;
}

/**
 * Get Keywords Everywhere API key from environment or database
 */
let cachedApiKey: string | null | undefined = undefined;

async function getKeywordsEverywhereAPIKeyFromDB(): Promise<string | null> {
  // V5000 doesn't use settings table - using env var directly
  // if (process.env.NODE_ENV === 'development') {
  //   console.log(`   🔍 [API Detection] Checking database for KEYWORDS_EVERYWHERE_API_KEY...`);
  // }
  
  // try {
  //   const setting = await prisma.setting.findUnique({
  //     where: { key: 'KEYWORDS_EVERYWHERE_API_KEY' },
  //   });
  //   
  //   if (setting && setting.value) {
  //     if (process.env.NODE_ENV === 'development') {
  //       console.log(`   ✅ [API Detection] Found API key in database (length: ${setting.value.length})`);
  //     }
  //     return setting.value;
  //   }
  //   
  //   if (process.env.NODE_ENV === 'development') {
  //     console.log(`   ℹ️  [API Detection] No API key found in database`);
  //   }
  // } catch (error: any) {
  //   console.warn(`   ⚠️  [API Detection] Database error: ${error.message}`);
  //   return null;
  // }
  
  return null;
}

export async function shouldUseKeywordsEverywhereAPI(): Promise<boolean> {
  // Check cache first
  if (cachedApiKey !== undefined) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`   📦 [API Detection] Using cached API key detection: ${cachedApiKey ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
    }
    return cachedApiKey !== null;
  }
  
  // Check environment variable first
  if (process.env.KEYWORDS_EVERYWHERE_API_KEY) {
    cachedApiKey = process.env.KEYWORDS_EVERYWHERE_API_KEY;
    if (process.env.NODE_ENV === 'development') {
      console.log(`   ✅ [API Detection] KEYWORDS_EVERYWHERE_API_KEY found in environment (length: ${cachedApiKey.length})`);
    }
    return true;
  }
  
  // Check database
  cachedApiKey = await getKeywordsEverywhereAPIKeyFromDB();
  return cachedApiKey !== null;
}

export async function getKeywordsEverywhereAPIKey(): Promise<string | null> {
  if (cachedApiKey !== undefined && cachedApiKey !== null) {
    return cachedApiKey;
  }
  
  const envKey = process.env.KEYWORDS_EVERYWHERE_API_KEY;
  if (envKey) {
    cachedApiKey = envKey;
    return envKey;
  }
  
  cachedApiKey = await getKeywordsEverywhereAPIKeyFromDB();
  return cachedApiKey;
}

/**
 * Get related keywords from Keywords Everywhere API
 * Returns keywords similar to the input keyword with their volumes
 */
export async function getRelatedKeywordsFromAPI(
  keyword: string,
  apiKey: string,
  country: string = 'us'
): Promise<Array<{ keyword: string; volume: number; competition?: number }>> {
  const baseUrl = 'https://api.keywordseverywhere.com/v1/get_related_keywords';
  
  const requestBody = {
    keyword,
    country,
    num: 100, // Request up to 100 related keywords
  };
  
  console.log(`🔍 [DISCOVER-KEYWORDS] ========================================`);
  console.log(`🔍 [DISCOVER-KEYWORDS] Fetching related keywords for: "${keyword}"`);
  console.log(`🔍 [DISCOVER-KEYWORDS] Endpoint: ${baseUrl}`);
  console.log(`🔍 [DISCOVER-KEYWORDS] Request body:`, JSON.stringify(requestBody, null, 2));
  console.log(`🔍 [DISCOVER-KEYWORDS] API Key length: ${apiKey?.length || 0}`);
  console.log(`🔍 [DISCOVER-KEYWORDS] Country: ${country}`);
  
  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log(`🔍 [DISCOVER-KEYWORDS] Response status: ${response.status} ${response.statusText}`);
    // Note: Headers.entries() not available in all environments, skip header logging
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`❌ [DISCOVER-KEYWORDS] API Error Response:`);
      console.error(`   Status: ${response.status}`);
      console.error(`   Status Text: ${response.statusText}`);
      console.error(`   Error Body: ${errorText}`);
      console.error(`   Full Error (first 500 chars): ${errorText.substring(0, 500)}`);
      throw new Error(`Related keywords API error (${response.status}): ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    
    console.log(`🔍 [DISCOVER-KEYWORDS] Response data structure:`);
    console.log(`   - Has 'data' property: ${!!data.data}`);
    console.log(`   - 'data' is array: ${Array.isArray(data.data)}`);
    console.log(`   - 'data' length: ${data.data?.length || 0}`);
    console.log(`   - Response keys: ${Object.keys(data).join(', ')}`);
    
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      console.log(`🔍 [DISCOVER-KEYWORDS] First 3 items structure:`, data.data.slice(0, 3).map((item: any) => ({
        hasKeyword: !!item.keyword,
        keyword: item.keyword,
        hasVol: !!item.vol,
        vol: item.vol,
        hasCompetition: !!item.competition,
        competition: item.competition,
        allKeys: Object.keys(item)
      })));
    }
    
    // Parse related keywords from response
    // Expected format: { data: [{ keyword: string, vol: number, competition: number }], ... }
    if (data.data && Array.isArray(data.data)) {
      const relatedKeywords = data.data.map((item: any) => ({
        keyword: item.keyword || '',
        volume: item.vol || 0,
        competition: item.competition,
      })).filter((item: any) => item.keyword && item.volume > 0);
      
      console.log(`✅ [DISCOVER-KEYWORDS] Successfully parsed ${relatedKeywords.length} related keywords (filtered from ${data.data.length} total)`);
      if (relatedKeywords.length > 0) {
        console.log(`   Top 5 keywords:`, relatedKeywords.slice(0, 5).map((k: { keyword: string; volume: number }) => `${k.keyword} (vol: ${k.volume})`).join(', '));
      }
      
      return relatedKeywords;
    }
    
    console.warn(`⚠️  [DISCOVER-KEYWORDS] Response data structure unexpected. Expected 'data' array, got:`, {
      hasData: !!data.data,
      dataType: typeof data.data,
      isArray: Array.isArray(data.data),
      responseKeys: Object.keys(data),
      responseSample: JSON.stringify(data).substring(0, 500)
    });
    
    return [];
  } catch (error: any) {
    console.error(`❌ [DISCOVER-KEYWORDS] ========================================`);
    console.error(`❌ [DISCOVER-KEYWORDS] FAILED to fetch related keywords for "${keyword}"`);
    console.error(`❌ [DISCOVER-KEYWORDS] Error type: ${error.constructor.name}`);
    console.error(`❌ [DISCOVER-KEYWORDS] Error message: ${error.message}`);
    console.error(`❌ [DISCOVER-KEYWORDS] Error stack:`, error.stack);
    console.error(`❌ [DISCOVER-KEYWORDS] ========================================`);
    return [];
  }
}

/**
 * Fetch keyword search volume from Keywords Everywhere API
 */
export async function getVolumeFromKeywordsEverywhereAPI(
  keyword: string,
  city: string,
  state: string,
  apiKey: string
): Promise<KeywordsEverywhereVolumeResponse> {
  const baseUrl = 'https://api.keywordseverywhere.com/v1/get_keyword_data';
  
  // Get configuration from environment variables
  const country = process.env.KEYWORDS_EVERYWHERE_COUNTRY || 'us';
  const currency = process.env.KEYWORDS_EVERYWHERE_CURRENCY || 'usd';
  const dataSource = process.env.KEYWORDS_EVERYWHERE_DATA_SOURCE || 'cli';
  
  // For local queries, use "keyword city" (no state) as per user requirement
  // State makes queries too specific and often returns 0 or national volumes
  let searchQuery = '';
  
  if (city) {
    // Local query: "keyword city" only
    searchQuery = `${keyword} ${city}`;
    if (process.env.NODE_ENV === 'development') {
      console.log(`   📡 [Keywords Everywhere API] Using city-only query: "${searchQuery}"`);
    }
  } else {
    // No location - use keyword only (national)
    searchQuery = keyword;
    if (process.env.NODE_ENV === 'development') {
      console.log(`   📡 [Keywords Everywhere API] Using keyword-only query: "${searchQuery}"`);
    }
  }
  
  const requestBody = {
    kw: [searchQuery],
    country,
    currency,
    dataSource,
  };
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`   🌍 Country: ${country}, Currency: ${currency}, Data Source: ${dataSource}`);
  }
  
  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`   📥 Status: ${response.status} ${response.statusText}`);
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      
      if (response.status === 401) {
        throw new Error(
          `Invalid Keywords Everywhere API key. ` +
          `Get your API key from https://keywordseverywhere.com/first-install-addon.html. ` +
          `Response: ${errorText.substring(0, 200)}`
        );
      }
      
      if (response.status === 402) {
        throw new Error(
          `Insufficient credits in Keywords Everywhere account. ` +
          `Please purchase more credits. ` +
          `Response: ${errorText.substring(0, 200)}`
        );
      }
      
      throw new Error(
        `Keywords Everywhere API error (${response.status}): ${errorText.substring(0, 200)}`
      );
    }
    
    const data: KeywordsEverywhereApiResponse = await response.json();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`   ✅ Response received. Credits remaining: ${data.credits}, Used: ${data.credits_consumed}`);
    }
    
    // Extract the first result (we only queried one keyword)
    let result = null;
    if (data.data && data.data.length > 0) {
      result = data.data[0];
      
      // CRITICAL: Verify the returned keyword matches our search query
      // If the API returns a different keyword (e.g., "plumber" instead of "plumber Morrison"),
      // it's giving us national volume, not local volume - reject it
      const returnedKeyword = (result.keyword || '').toLowerCase().trim();
      const searchQueryLower = searchQuery.toLowerCase().trim();
      const cityLower = city ? city.toLowerCase() : '';
      
      // LOCAL_API_VALIDATION: For city queries, the returned keyword MUST contain the city
      // If it doesn't, the API is giving us national data, not local data - reject it
      if (city) {
        const keywordContainsCity = returnedKeyword.includes(cityLower);
        const keywordContainsBaseKeyword = returnedKeyword.includes(keyword.toLowerCase());
        
        // CRITICAL: If the returned keyword doesn't contain the city, it's national data
        // Also check that it contains our base keyword (to avoid false matches)
        if (!keywordContainsCity || !keywordContainsBaseKeyword) {
          const originalVol = result.vol;
          result.vol = 0; // Reject - this is national data, not local
          console.log(`   ⚠️  [LOCAL_API_VALIDATION] REJECTED: Search="${searchQuery}", Returned="${result.keyword}", Vol=${originalVol}`);
          if (!keywordContainsCity) {
            console.log(`   ⚠️  [LOCAL_API_VALIDATION] Reason: Returned keyword "${result.keyword}" doesn't contain city "${city}" - this is NATIONAL data, not local`);
          }
          if (!keywordContainsBaseKeyword) {
            console.log(`   ⚠️  [LOCAL_API_VALIDATION] Reason: Returned keyword "${result.keyword}" doesn't contain base keyword "${keyword}" - mismatch`);
          }
        } else {
          console.log(`   ✅ [LOCAL_API_VALIDATION] ACCEPTED: Search="${searchQuery}", Returned="${result.keyword}", Vol=${result.vol} (contains city "${city}")`);
        }
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`   📊 Volume: ${result.vol}, Competition: ${result.competition}, CPC: ${result.cpc.currency}${result.cpc.value}`);
        console.log(`   📊 Returned keyword: "${result.keyword}" vs search: "${searchQuery}"`);
      }
    }
    
    // If volume is 0 or very low, try to find related keywords with volume
    if (!result || result.vol < 10) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`   🔄 Volume is ${result?.vol || 0}, checking related keywords...`);
      }
      
      try {
        const relatedKeywords = await getRelatedKeywordsFromAPI(keyword, apiKey, country);
        
        // Filter for keywords that contain the city name
        const cityLower = city.toLowerCase();
        const relevantRelated = relatedKeywords.filter(kw => 
          kw.keyword.toLowerCase().includes(cityLower) && kw.volume > 0
        );
        
        // If we found related keywords with volume, use the highest one
        if (relevantRelated.length > 0) {
          const bestMatch = relevantRelated.sort((a, b) => b.volume - a.volume)[0];
          if (process.env.NODE_ENV === 'development') {
            console.log(`   🔄 Using related keyword "${bestMatch.keyword}" (vol: ${bestMatch.volume}) instead of "${searchQuery}" (vol: ${result?.vol || 0})`);
          }
          
          return {
            volume: bestMatch.volume,
            competition: bestMatch.competition,
            cpc: result?.cpc || { currency: 'usd', value: '0' },
            trend: result?.trend,
          };
        }
      } catch (relatedError: any) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`   ⚠️  Related keywords lookup failed: ${relatedError.message}`);
        }
        // Continue to next fallback
      }
    }
    
    // If we have a result with volume, return it
    if (result && result.vol > 0) {
      return {
        volume: result.vol,
        competition: result.competition,
        cpc: result.cpc,
        trend: result.trend,
      };
    }
    
    // Don't fall back to base keyword - it would give us national volumes
    // The "keyword + city" query already represents local demand
    // If it has no volume, accept that there's no local demand
    // No data returned - return 0 volume
    if (process.env.NODE_ENV === 'development') {
      console.log(`   ⚠️  No data returned from API for "${searchQuery}"`);
    }
    
    return {
      volume: result?.vol || 0,
      competition: result?.competition,
      cpc: result?.cpc || { currency: 'usd', value: '0' },
      trend: result?.trend,
    };
  } catch (error: any) {
    // Re-throw API errors
    if (error.message.includes('Keywords Everywhere API')) {
      throw error;
    }
    
    // Handle network errors
    throw new Error(
      `Failed to connect to Keywords Everywhere API: ${error.message}. ` +
      `Check your internet connection and try again.`
    );
  }
}

/**
 * Bulk fetch keyword data (volume + CPC) from Keywords Everywhere API
 * Can fetch up to 100 keywords at once
 * 
 * @param keywords Array of keyword strings (e.g., ["hvac repair Milwaukee", "ac repair Milwaukee"])
 * @returns Map of keyword -> { volume, cpc }
 */
export async function getBulkKeywordData(
  keywords: string[]
): Promise<Map<string, { volume: number; cpc: number }>> {
  const apiKey = await getKeywordsEverywhereAPIKey();
  if (!apiKey) {
    throw new Error('Keywords Everywhere API key not found');
  }

  const baseUrl = 'https://api.keywordseverywhere.com/v1/get_keyword_data';
  const maxBatchSize = 100;
  const resultMap = new Map<string, { volume: number; cpc: number }>();

  for (let i = 0; i < keywords.length; i += maxBatchSize) {
    const batch = keywords.slice(i, i + maxBatchSize);
    const country = process.env.KEYWORDS_EVERYWHERE_COUNTRY || 'us';
    const currency = process.env.KEYWORDS_EVERYWHERE_CURRENCY || 'usd';
    const dataSource = process.env.KEYWORDS_EVERYWHERE_DATA_SOURCE || 'cli';

    const requestBody = { kw: batch, country, currency, dataSource };

    console.log(`[KE API] Fetching ${batch.length} keywords (batch ${Math.floor(i / maxBatchSize) + 1})`);

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(
          `Keywords Everywhere API error (${response.status}): ${errorText.substring(0, 200)}`
        );
      }

      const data: KeywordsEverywhereApiResponse = await response.json();

      console.log(`[KE API] Received ${data.data?.length || 0} results for ${batch.length} keywords`);
      console.log(`[KE API] Response structure:`, {
        hasData: !!data.data,
        dataLength: data.data?.length,
        credits: data.credits,
        creditsConsumed: data.credits_consumed
      });

      if (data.data && data.data.length > 0) {
        console.log(`[KE API] First 3 results:`, data.data.slice(0, 3).map(r => ({
          keyword: r.keyword,
          vol: r.vol,
          cpc: r.cpc?.value,
          competition: r.competition
        })));
      }

      // Map results - Keywords Everywhere returns results in same order as request
      if (data.data && Array.isArray(data.data)) {
        // Create a map of keyword -> result for easier lookup
        const resultByKeyword = new Map<string, any>();
        for (const result of data.data) {
          if (result.keyword) {
            resultByKeyword.set(result.keyword.toLowerCase().trim(), result);
          }
        }

        // Match results to requested keywords (case-insensitive)
        for (const requestedKeyword of batch) {
          const normalizedRequested = requestedKeyword.toLowerCase().trim();
          const result = resultByKeyword.get(normalizedRequested);

          if (result) {
            const cpcValue = parseFloat(result.cpc?.value || '0');
            resultMap.set(requestedKeyword, {
              volume: result.vol || 0,
              cpc: cpcValue,
            });
          } else {
            // No match found - might be because keyword format doesn't match
            console.log(`[KE API] No match for keyword: "${requestedKeyword}"`);
            resultMap.set(requestedKeyword, { volume: 0, cpc: 0 });
          }
        }
      } else {
        // No data array - set all to 0
        for (const keyword of batch) {
          resultMap.set(keyword, { volume: 0, cpc: 0 });
        }
      }
    } catch (error: any) {
      console.error(`[KE API] Error fetching batch:`, error.message);
      // Set all keywords in this batch to 0
      for (const keyword of batch) {
        resultMap.set(keyword, { volume: 0, cpc: 0 });
      }
    }
  }

  return resultMap;
}

/**
 * Extract related keywords from SERP data
 * Uses Google's "People also ask" and "Related searches" sections
 */
export async function getRelatedKeywordsFromSERP(
  keyword: string,
  city: string,
  state: string
): Promise<Array<{ keyword: string; volume: number }>> {
  console.log(`🔍 [SERP-DISCOVERY] Extracting keywords from SERP for: "${keyword}" in ${city}, ${state}`);
  
  try {
    const { fetchSerpTop } = await import('./serp');
    const serpData = await fetchSerpTop(keyword, city, state);
    
    const discoveredKeywords: Array<{ keyword: string; volume: number }> = [];
    
    // Extract from related keywords found in SERP
    if (serpData.relatedKeywords && serpData.relatedKeywords.length > 0) {
      console.log(`🔍 [SERP-DISCOVERY] Found ${serpData.relatedKeywords.length} related keywords from SERP`);
      
      // Clean and normalize keywords
      for (const relatedKw of serpData.relatedKeywords) {
        // Remove question marks and clean up
        const cleaned = relatedKw
          .trim()
          .replace(/^[?¿]\s*/, '')
          .replace(/\s+/g, ' ')
          .toLowerCase();
        
        // Remove location-specific parts if they exist (we'll add them back)
        const withoutLocation = cleaned
          .replace(new RegExp(`\\b${city.toLowerCase()}\\b`, 'gi'), '')
          .replace(new RegExp(`\\b${state.toLowerCase()}\\b`, 'gi'), '')
          .trim();
        
        if (withoutLocation.length > 3 && withoutLocation.length < 60) {
          // Check if it's similar to the base keyword (avoid completely unrelated terms)
          const baseKeywordLower = keyword.toLowerCase();
          const hasCommonWords = withoutLocation.split(/\s+/).some(word => 
            baseKeywordLower.includes(word) || word.length > 4
          );
          
          if (hasCommonWords) {
            discoveredKeywords.push({
              keyword: withoutLocation,
              volume: 0, // Will be fetched later
            });
          }
        }
      }
    }
    
    // Extract keywords from result titles and snippets
    if (serpData.results && serpData.results.length > 0) {
      const titleKeywords = new Set<string>();
      
      for (const result of serpData.results.slice(0, 10)) {
        // Extract potential keywords from titles
        const titleWords = result.title
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 3 && !['the', 'and', 'for', 'with', 'from'].includes(word));
        
        // Look for keyword-like phrases (2-4 words)
        for (let i = 0; i < titleWords.length - 1; i++) {
          const phrase = titleWords.slice(i, i + 2).join(' ');
          if (phrase.length > 5 && phrase.length < 40) {
            // Remove location
            const withoutLocation = phrase
              .replace(new RegExp(`\\b${city.toLowerCase()}\\b`, 'gi'), '')
              .replace(new RegExp(`\\b${state.toLowerCase()}\\b`, 'gi'), '')
              .trim();
            
            if (withoutLocation.length > 3) {
              titleKeywords.add(withoutLocation);
            }
          }
        }
      }
      
      // Add title-based keywords
      for (const kw of Array.from(titleKeywords).slice(0, 10)) {
        discoveredKeywords.push({
          keyword: kw,
          volume: 0, // Will be fetched later
        });
      }
    }
    
    // Remove duplicates
    const uniqueKeywords = new Map<string, { keyword: string; volume: number }>();
    for (const kw of discoveredKeywords) {
      const key = kw.keyword.toLowerCase().trim();
      if (!uniqueKeywords.has(key)) {
        uniqueKeywords.set(key, kw);
      }
    }
    
    const result = Array.from(uniqueKeywords.values());
    console.log(`✅ [SERP-DISCOVERY] Extracted ${result.length} unique keywords from SERP`);
    
    return result;
  } catch (error: any) {
    console.error(`❌ [SERP-DISCOVERY] Failed to extract keywords from SERP: ${error.message}`);
    return [];
  }
}

/**
 * Normalize keyword to a canonical form
 * Removes common variations that Google treats as the same:
 * - "a/c" -> "ac"
 * - "air conditioning" -> "air conditioner" (standardize to singular)
 * - Removes extra spaces, standardizes punctuation
 */
export function normalizeKeyword(keyword: string): string {
  let normalized = keyword.toLowerCase().trim();
  
  // Replace common variations that Google treats as the same
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
 * Check if two keywords are essentially the same (Google treats them as one)
 */
export function areKeywordsEquivalent(keyword1: string, keyword2: string): boolean {
  const norm1 = normalizeKeyword(keyword1);
  const norm2 = normalizeKeyword(keyword2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Check if one is a substring of the other (e.g., "ac repair" vs "ac repair near me")
  // But only if the difference is just location modifiers
  const locationModifiers = ['near me', 'nearby', 'local', 'in ', 'near ', 'around '];
  const withoutLocation1 = locationModifiers.reduce((str, mod) => str.replace(mod, ''), norm1).trim();
  const withoutLocation2 = locationModifiers.reduce((str, mod) => str.replace(mod, ''), norm2).trim();
  
  if (withoutLocation1 === withoutLocation2) return true;
  
  return false;
}

/**
 * Merge similar keywords, keeping the one with highest volume
 */
export function mergeSimilarKeywords(
  keywords: Array<{ keyword: string; volume: number; competition?: number }>
): Array<{ keyword: string; volume: number; competition?: number }> {
  const merged = new Map<string, { keyword: string; volume: number; competition?: number }>();
  
  for (const kw of keywords) {
    const normalized = normalizeKeyword(kw.keyword);
    
    // Check if we already have this normalized keyword
    if (merged.has(normalized)) {
      const existing = merged.get(normalized)!;
      // Keep the one with higher volume, or if volumes are equal, keep the shorter keyword
      if (kw.volume > existing.volume || (kw.volume === existing.volume && kw.keyword.length < existing.keyword.length)) {
        merged.set(normalized, kw);
      }
    } else {
      // Check if this keyword is equivalent to any existing one
      let foundEquivalent = false;
      for (const [existingNorm, existingKw] of merged.entries()) {
        if (areKeywordsEquivalent(kw.keyword, existingKw.keyword)) {
          foundEquivalent = true;
          // Keep the one with higher volume
          if (kw.volume > existingKw.volume || (kw.volume === existingKw.volume && kw.keyword.length < existingKw.keyword.length)) {
            merged.delete(existingNorm);
            merged.set(normalizeKeyword(kw.keyword), kw);
          }
          break;
        }
      }
      
      if (!foundEquivalent) {
        merged.set(normalized, kw);
      }
    }
  }
  
  return Array.from(merged.values());
}

/**
 * Generate comprehensive keyword variations by adding modifiers
 * Creates 200+ variations for local service businesses
 */
export function generateKeywordVariations(
  baseKeyword: string,
  city?: string,
  modifiers?: string[]
): string[] {
  const variations: string[] = [];
  const baseLower = baseKeyword.toLowerCase().trim();
  
  // Comprehensive modifier sets
  const intentModifiers = modifiers || [
    'best', 'top rated', 'top', 'cheap', 'affordable', 'inexpensive', 'budget',
    'professional', 'licensed', 'certified', 'insured', 'experienced',
    'emergency', '24 hour', '24/7', 'same day', 'fast', 'quick',
    'reliable', 'trusted', 'local', 'nearby'
  ];
  
  const serviceModifiers = [
    'service', 'services', 'company', 'companies', 'contractor', 'contractors',
    'repair', 'repairs', 'installation', 'install', 'replacement', 'replace',
    'maintenance', 'maintain', 'tune up', 'tune-up', 'cleaning', 'clean',
    'inspection', 'inspect', 'estimate', 'estimates', 'quote', 'quotes'
  ];
  
  const qualityModifiers = [
    'professional', 'licensed', 'certified', 'insured', 'bonded',
    'experienced', 'expert', 'master', 'qualified', 'skilled'
  ];
  
  const localModifiers = city ? [
    `in ${city}`, `near ${city}`, `around ${city}`, `${city} area`,
    `near me`, `nearby`, `local`
  ] : ['near me', 'nearby', 'local'];
  
  // Safety check: Ensure localModifiers is an array (defensive programming)
  if (!Array.isArray(localModifiers)) {
    console.error(`[generateKeywordVariations] ERROR: localModifiers is not an array! Type: ${typeof localModifiers}`);
    return [];
  }
  
  // 1. Intent modifiers before keyword
  for (const modifier of intentModifiers) {
    variations.push(`${modifier} ${baseLower}`);
  }
  
  // 2. Service modifiers after keyword
  for (const modifier of serviceModifiers) {
    if (!baseLower.includes(modifier)) {
      variations.push(`${baseLower} ${modifier}`);
    }
  }
  
  // 3. Quality + keyword combinations
  for (const quality of qualityModifiers) {
    variations.push(`${quality} ${baseLower}`);
    for (const service of serviceModifiers.slice(0, 5)) { // Limit combinations
      if (!baseLower.includes(service)) {
        variations.push(`${quality} ${baseLower} ${service}`);
      }
    }
  }
  
  // 4. Local modifiers
  // Ensure localModifiers is an array (defensive check)
  if (Array.isArray(localModifiers)) {
    for (const local of localModifiers) {
      variations.push(`${baseLower} ${local}`);
      // Combine with intent modifiers
      for (const intent of intentModifiers.slice(0, 10)) {
        variations.push(`${intent} ${baseLower} ${local}`);
      }
    }
  } else {
    console.error(`[generateKeywordVariations] ERROR: localModifiers is not an array! Type: ${typeof localModifiers}, Value:`, localModifiers);
  }
  
  // 5. Question patterns
  const questionPatterns = [
    `how much ${baseLower}`,
    `how much does ${baseLower} cost`,
    `how to ${baseLower}`,
    `what is ${baseLower}`,
    `best ${baseLower} near me`,
    `cheap ${baseLower} near me`
  ];
  variations.push(...questionPatterns);
  
  // 6. Review/rating patterns
  const reviewPatterns = [
    `${baseLower} reviews`,
    `${baseLower} near me reviews`,
    `best rated ${baseLower}`,
    `top rated ${baseLower} near me`
  ];
  variations.push(...reviewPatterns);
  
  // 7. Plural/singular variations
  if (!baseLower.endsWith('s')) {
    variations.push(`${baseLower}s`);
    // Also add plural with modifiers
    for (const modifier of serviceModifiers.slice(0, 3)) {
      variations.push(`${baseLower}s ${modifier}`);
    }
  } else {
    const singular = baseLower.slice(0, -1);
    variations.push(singular);
  }
  
  // 8. Common misspellings/variations (for common terms)
  const commonVariations: Record<string, string[]> = {
    'hvac': ['hvac system', 'hvac unit', 'heating and cooling'],
    'ac': ['air conditioning', 'air conditioner', 'a/c'],
    'plumber': ['plumbing', 'plumbing service'],
    'electrician': ['electrical', 'electrical service'],
  };
  
  for (const [key, alts] of Object.entries(commonVariations)) {
    if (baseLower.includes(key)) {
      for (const alt of alts) {
        const replaced = baseLower.replace(key, alt);
        variations.push(replaced);
        // Add modifiers to variations too
        for (const modifier of intentModifiers.slice(0, 5)) {
          variations.push(`${modifier} ${replaced}`);
        }
      }
    }
  }
  
  // Remove duplicates and filter out very long keywords
  const unique = Array.from(new Set(variations));
  return unique.filter(kw => kw.length > 3 && kw.length < 80);
}

/**
 * Get Google Autocomplete suggestions for a keyword + location
 * Uses Google's public autocomplete endpoint (not an official API - may be rate-limited)
 * Note: Google Places API has official Autocomplete but requires API key and costs money
 * This uses the free public endpoint that Google's search bar uses
 */
export async function getGoogleAutocompleteSuggestions(
  keyword: string,
  city: string,
  state: string
): Promise<string[]> {
  console.log(`🔍 [AUTOCOMPLETE] Fetching Google public autocomplete suggestions for: "${keyword}" in ${city}, ${state}`);
  console.log(`   ℹ️  [AUTOCOMPLETE] Using public endpoint (not official API - may be rate-limited)`);
  
  const suggestions: string[] = [];
  
  try {
    // Query variations to get more suggestions
    const queries = [
      `${keyword} ${city}`,
      `${keyword} ${city} ${state}`,
      `${keyword} near ${city}`,
      `best ${keyword} ${city}`,
      `${keyword} service ${city}`
    ];
    
    for (const query of queries) {
      try {
        // Google's public autocomplete endpoint (used by search bar)
        // This is NOT an official API - it's the endpoint browsers use
        // May be rate-limited or blocked if overused
        const url = `https://www.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          console.log(`   ⚠️  [AUTOCOMPLETE] HTTP ${response.status} for query: "${query}" (may be rate-limited)`);
          // If we get blocked, stop trying more queries
          if (response.status === 429 || response.status === 403) {
            console.log(`   ⚠️  [AUTOCOMPLETE] Rate limited or blocked - stopping autocomplete requests`);
            break;
          }
          continue;
        }
        
        const data = await response.json();
        
        // Google returns: [query, [suggestions], ...]
        if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
          const querySuggestions = data[1].map((item: any) => {
            // Extract the suggestion text (could be string or array)
            const text = Array.isArray(item) ? item[0] : item;
            return typeof text === 'string' ? text : '';
          }).filter((text: string) => text.length > 0);
          
          suggestions.push(...querySuggestions);
          console.log(`   ✅ [AUTOCOMPLETE] Found ${querySuggestions.length} suggestions for "${query}"`);
        }
        
        // Longer delay to avoid rate limiting (public endpoint is sensitive)
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.log(`   ⚠️  [AUTOCOMPLETE] Error fetching suggestions for "${query}": ${error.message}`);
        // Continue with next query
      }
    }
    
    // Clean and normalize suggestions
    const cleaned = suggestions
      .map(s => s.toLowerCase().trim())
      .filter(s => {
        // Remove location-specific parts (we'll add them back)
        const withoutLocation = s
          .replace(new RegExp(`\\b${city.toLowerCase()}\\b`, 'gi'), '')
          .replace(new RegExp(`\\b${state.toLowerCase()}\\b`, 'gi'), '')
          .trim();
        
        // Must be relevant to base keyword
        return withoutLocation.length > 3 && 
               withoutLocation.length < 60 &&
               (withoutLocation.includes(keyword.toLowerCase()) || 
                keyword.toLowerCase().includes(withoutLocation.split(' ')[0]));
      })
      .map(s => {
        // Remove location for normalization
        return s
          .replace(new RegExp(`\\b${city.toLowerCase()}\\b`, 'gi'), '')
          .replace(new RegExp(`\\b${state.toLowerCase()}\\b`, 'gi'), '')
          .replace(/\s+/g, ' ')
          .trim();
      });
    
    // Remove duplicates
    const unique = Array.from(new Set(cleaned));
    console.log(`✅ [AUTOCOMPLETE] Extracted ${unique.length} unique suggestions`);
    
    return unique;
  } catch (error: any) {
    console.error(`❌ [AUTOCOMPLETE] Failed to fetch suggestions: ${error.message}`);
    return [];
  }
}

/**
 * Extract keywords from competitor SERP results
 */
export function extractCompetitorKeywords(
  serpResults: Array<{ title: string; snippet?: string; url: string }>,
  baseKeyword: string
): string[] {
  const keywords: string[] = [];
  const baseLower = baseKeyword.toLowerCase();
  const baseWords = baseLower.split(/\s+/).filter(w => w.length > 2);
  
  for (const result of serpResults.slice(0, 10)) {
    // Extract from title
    const titleWords = result.title.toLowerCase().split(/\s+/);
    for (let i = 0; i < titleWords.length - 1; i++) {
      // Look for 2-3 word phrases containing base keyword words
      for (let len = 2; len <= 3; len++) {
        if (i + len <= titleWords.length) {
          const phrase = titleWords.slice(i, i + len).join(' ');
          // Check if phrase contains base keyword or shares words
          const hasBaseWord = baseWords.some(bw => phrase.includes(bw));
          if (hasBaseWord && phrase.length > 5 && phrase.length < 50) {
            keywords.push(phrase);
          }
        }
      }
    }
    
    // Extract from snippet if available
    if (result.snippet) {
      const snippetWords = result.snippet.toLowerCase().split(/\s+/);
      for (let i = 0; i < snippetWords.length - 1; i++) {
        for (let len = 2; len <= 3; len++) {
          if (i + len <= snippetWords.length) {
            const phrase = snippetWords.slice(i, i + len).join(' ');
            const hasBaseWord = baseWords.some(bw => phrase.includes(bw));
            if (hasBaseWord && phrase.length > 5 && phrase.length < 50) {
              keywords.push(phrase);
            }
          }
        }
      }
    }
  }
  
  // Remove duplicates and filter
  const unique = Array.from(new Set(keywords))
    .filter(kw => kw.length > 3 && kw.length < 60);
  
  return unique;
}

/**
 * Generate niche-specific keyword templates
 */
export function generateNicheTemplates(
  niche: string,
  baseKeywords: string[],
  city: string
): string[] {
  const templates: string[] = [];
  
  // Service business templates
  const serviceTemplates = [
    '{keyword} {city}',
    '{keyword} service {city}',
    '{keyword} company {city}',
    '{keyword} contractor {city}',
    'best {keyword} {city}',
    '{keyword} near me',
    '{keyword} {city} area',
    'affordable {keyword} {city}',
    'professional {keyword} {city}',
    'licensed {keyword} {city}',
    'emergency {keyword} {city}',
    '24 hour {keyword} {city}',
    '{keyword} repair {city}',
    '{keyword} installation {city}',
    '{keyword} replacement {city}',
    '{keyword} maintenance {city}',
    'how much {keyword} {city}',
    '{keyword} cost {city}',
    '{keyword} price {city}',
    '{keyword} estimate {city}',
    '{keyword} reviews {city}',
    'top rated {keyword} {city}',
    'cheap {keyword} {city}',
    'local {keyword} {city}',
    '{keyword} service near me',
    '{keyword} company near me'
  ];
  
  // Apply templates to base keywords
  for (const baseKw of baseKeywords.slice(0, 10)) {
    for (const template of serviceTemplates) {
      const keyword = template
        .replace('{keyword}', baseKw)
        .replace('{city}', city)
        .toLowerCase()
        .trim();
      templates.push(keyword);
    }
  }
  
  // Remove duplicates
  return Array.from(new Set(templates));
}

/**
 * Batch fetch keyword search volumes from Keywords Everywhere API
 * Can fetch up to 100 keywords at once
 */
export async function getBatchVolumesFromKeywordsEverywhereAPI(
  keywords: Array<{ keyword: string; city: string; state: string }>,
  apiKey: string
): Promise<Map<string, KeywordsEverywhereVolumeResponse>> {
  const baseUrl = 'https://api.keywordseverywhere.com/v1/get_keyword_data';
  const maxBatchSize = 100;
  
  // Limit to 100 keywords per request
  const batch = keywords.slice(0, maxBatchSize);
  
  // Get configuration from environment variables
  const country = process.env.KEYWORDS_EVERYWHERE_COUNTRY || 'us';
  const currency = process.env.KEYWORDS_EVERYWHERE_CURRENCY || 'usd';
  const dataSource = process.env.KEYWORDS_EVERYWHERE_DATA_SOURCE || 'cli';
  
  // Build search queries (keyword + city, without state for better volume matches)
  const searchQueries = batch.map(({ keyword, city }) => `${keyword} ${city}`);
  
  const requestBody = {
    kw: searchQueries,
    country,
    currency,
    dataSource,
  };
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`   📡 [Keywords Everywhere API] Batch fetching ${batch.length} keywords`);
  }
  
  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(
        `Keywords Everywhere API error (${response.status}): ${errorText.substring(0, 200)}`
      );
    }
    
    const data: KeywordsEverywhereApiResponse = await response.json();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`   ✅ Batch response received. Credits remaining: ${data.credits}, Used: ${data.credits_consumed}`);
    }
    
    // Map results back to original keywords
    const resultMap = new Map<string, KeywordsEverywhereVolumeResponse>();
    
    for (let i = 0; i < batch.length; i++) {
      const { keyword, city } = batch[i];
      const searchQuery = `${keyword} ${city}`;
      const result = data.data[i];
      
      if (result) {
        resultMap.set(searchQuery, {
          volume: result.vol || 0,
          competition: result.competition,
          cpc: result.cpc,
          trend: result.trend,
        });
      } else {
        resultMap.set(searchQuery, { volume: 0 });
      }
    }
    
    return resultMap;
  } catch (error: any) {
    throw new Error(
      `Failed to fetch batch volumes from Keywords Everywhere API: ${error.message}`
    );
  }
}

/**
 * Generate national (non-localized) service keyword variations
 * Creates base service keywords without location modifiers
 */
export function generateNationalServiceKeywords(nicheName: string, seedKeywords: string[]): string[] {
  const keywords: string[] = [];
  const nicheLower = nicheName.toLowerCase().trim();
  
  // Extract core service terms from seed keywords
  const coreTerms = new Set<string>();
  for (const seed of seedKeywords) {
    const seedLower = seed.toLowerCase().trim();
    // Remove location modifiers
    const cleaned = seedLower
      .replace(/\b(near me|nearby|local|in [a-z]+|near [a-z]+)\b/g, '')
      .trim();
    if (cleaned.length > 2) {
      coreTerms.add(cleaned);
    }
  }
  
  // Add niche name itself
  coreTerms.add(nicheLower);
  
  // Service action verbs
  const serviceActions = [
    'repair', 'installation', 'install', 'replacement', 'replace',
    'maintenance', 'service', 'services', 'tune up', 'tune-up',
    'cleaning', 'clean', 'inspection', 'inspect'
  ];
  
  // Generate combinations
  for (const term of Array.from(coreTerms)) {
    // Base term
    keywords.push(term);
    
    // Term + service action
    for (const action of serviceActions) {
      if (!term.includes(action)) {
        keywords.push(`${term} ${action}`);
      }
    }
    
    // Emergency variations
    keywords.push(`emergency ${term}`);
    keywords.push(`24/7 ${term}`);
    
    // Company/service provider variations
    keywords.push(`${term} company`);
    keywords.push(`${term} contractor`);
    keywords.push(`${term} service`);
  }
  
  // Remove duplicates and filter
  const unique = Array.from(new Set(keywords));
  return unique.filter(kw => kw.length > 3 && kw.length < 60);
}

/**
 * Generate informational keywords (how-to, guides, FAQs, etc.)
 * These are for blog posts and educational content
 */
export function generateInformationalKeywords(nicheName: string, seedKeywords: string[]): string[] {
  const keywords: string[] = [];
  const nicheLower = nicheName.toLowerCase().trim();
  
  // Extract core terms
  const coreTerms = new Set<string>();
  for (const seed of seedKeywords) {
    const seedLower = seed.toLowerCase().trim()
      .replace(/\b(near me|nearby|local|in [a-z]+|near [a-z]+)\b/g, '')
      .trim();
    if (seedLower.length > 2) {
      coreTerms.add(seedLower);
    }
  }
  coreTerms.add(nicheLower);
  
  // How-to patterns
  const howToActions = ['fix', 'repair', 'maintain', 'install', 'replace', 'clean', 'troubleshoot', 'diagnose'];
  for (const term of Array.from(coreTerms)) {
    for (const action of howToActions) {
      if (!term.includes(action)) {
        keywords.push(`how to ${action} ${term}`);
        keywords.push(`how to ${term} ${action}`);
      }
    }
  }
  
  // Why patterns (problem-focused)
  const problems = ['not working', 'not cooling', 'not heating', 'making noise', 'leaking', 'broken', 'frozen'];
  for (const term of Array.from(coreTerms)) {
    for (const problem of problems) {
      keywords.push(`why ${term} ${problem}`);
      keywords.push(`why is my ${term} ${problem}`);
    }
  }
  
  // What is patterns (educational)
  const concepts = ['tune up', 'maintenance', 'seer rating', 'btu', 'tonnage', 'refrigerant'];
  for (const concept of concepts) {
    keywords.push(`what is ${concept}`);
    keywords.push(`what is ${nicheLower} ${concept}`);
  }
  
  // When to patterns
  const whenActions = ['replace', 'service', 'repair', 'upgrade', 'maintain'];
  for (const term of Array.from(coreTerms)) {
    for (const action of whenActions) {
      keywords.push(`when to ${action} ${term}`);
      keywords.push(`when should you ${action} ${term}`);
    }
  }
  
  // Guide/checklist/tips patterns
  for (const term of Array.from(coreTerms)) {
    keywords.push(`${term} guide`);
    keywords.push(`${term} checklist`);
    keywords.push(`${term} tips`);
    keywords.push(`${term} maintenance guide`);
    keywords.push(`${term} troubleshooting guide`);
  }
  
  // Signs/symptoms patterns
  const signs = ['signs', 'symptoms', 'warning signs'];
  const issues = ['failing', 'broken', 'needs repair', 'needs replacement'];
  for (const term of Array.from(coreTerms)) {
    for (const sign of signs) {
      keywords.push(`${sign} of ${term} problems`);
      keywords.push(`${sign} your ${term} is failing`);
    }
    for (const issue of issues) {
      keywords.push(`${term} ${issue}`);
    }
  }
  
  // Cost/price informational
  for (const term of Array.from(coreTerms)) {
    keywords.push(`how much does ${term} cost`);
    keywords.push(`${term} cost guide`);
    keywords.push(`${term} price guide`);
    keywords.push(`average ${term} cost`);
  }
  
  // Comparison patterns
  const comparisons = [
    'heat pump vs furnace',
    'gas vs electric',
    'central air vs window unit',
    'ductless vs central',
  ];
  keywords.push(...comparisons);
  
  // Seasonal patterns
  keywords.push(`winter ${nicheLower} tips`);
  keywords.push(`summer ${nicheLower} maintenance`);
  keywords.push(`spring ${nicheLower} checklist`);
  keywords.push(`fall ${nicheLower} preparation`);
  
  // Remove duplicates and filter
  const unique = Array.from(new Set(keywords));
  return unique.filter(kw => kw.length > 5 && kw.length < 70);
}

/**
 * Generate supporting/comparison keywords (best, reviews, vs, etc.)
 */
export function generateSupportingKeywords(nicheName: string, seedKeywords: string[]): string[] {
  const keywords: string[] = [];
  const nicheLower = nicheName.toLowerCase().trim();
  
  // Extract core terms
  const coreTerms = new Set<string>();
  for (const seed of seedKeywords) {
    const seedLower = seed.toLowerCase().trim()
      .replace(/\b(near me|nearby|local|in [a-z]+|near [a-z]+)\b/g, '')
      .trim();
    if (seedLower.length > 2) {
      coreTerms.add(seedLower);
    }
  }
  coreTerms.add(nicheLower);
  
  // Best/top patterns
  for (const term of Array.from(coreTerms)) {
    keywords.push(`best ${term}`);
    keywords.push(`top ${term}`);
    keywords.push(`top rated ${term}`);
    keywords.push(`best ${term} companies`);
    keywords.push(`best ${term} brands`);
  }
  
  // Review patterns
  for (const term of Array.from(coreTerms)) {
    keywords.push(`${term} reviews`);
    keywords.push(`${term} company reviews`);
    keywords.push(`best ${term} reviews`);
  }
  
  // Comparison patterns
  const brands = ['lennox', 'carrier', 'trane', 'rheem', 'goodman', 'york'];
  for (let i = 0; i < brands.length - 1; i++) {
    for (let j = i + 1; j < brands.length; j++) {
      keywords.push(`${brands[i]} vs ${brands[j]}`);
    }
  }
  
  // Cost comparison
  for (const term of Array.from(coreTerms)) {
    keywords.push(`${term} cost`);
    keywords.push(`${term} price`);
    keywords.push(`how much is ${term}`);
    keywords.push(`affordable ${term}`);
  }
  
  // Quality/reliability
  for (const term of Array.from(coreTerms)) {
    keywords.push(`reliable ${term}`);
    keywords.push(`quality ${term}`);
    keywords.push(`trusted ${term} companies`);
  }
  
  // Remove duplicates and filter
  const unique = Array.from(new Set(keywords));
  return unique.filter(kw => kw.length > 3 && kw.length < 60);
}

