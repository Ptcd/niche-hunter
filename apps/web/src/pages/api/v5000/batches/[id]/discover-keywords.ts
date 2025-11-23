import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { 
  getRelatedKeywordsFromAPI, 
  getKeywordsEverywhereAPIKey,
  getRelatedKeywordsFromSERP,
  generateKeywordVariations,
  getGoogleAutocompleteSuggestions,
  extractCompetitorKeywords,
  generateNicheTemplates
} from '@niche-hunter/crawler';
import { getBulkKeywordData, getBulkKeywordDifficulty, getOrganicSERP, getMapsSERP } from '@niche-hunter/crawler';
import {
  calculateSerpWeakness,
  calculateLocalPackStrength,
  calculateOnpageCompetence,
  calculateFinalDifficulty,
  calculateOpportunity,
} from '@niche-hunter/core';
import { classifyKeyword } from '../../../../../lib/keyword-classifier';

/**
 * Check if a keyword is primarily in English (Latin characters)
 */
function isEnglishKeyword(keyword: string): boolean {
  // Remove common punctuation and numbers
  const cleaned = keyword.replace(/[0-9\s\-_.,!?]/g, '');
  
  // Check if it contains primarily Latin characters (a-z, A-Z)
  // Allow some non-Latin characters but majority should be Latin
  const latinChars = cleaned.match(/[a-zA-Z]/g) || [];
  const nonLatinChars = cleaned.match(/[^\x00-\x7F]/g) || []; // Non-ASCII characters
  
  // If more than 20% non-Latin characters, reject it
  const totalChars = latinChars.length + nonLatinChars.length;
  if (totalChars === 0) return false;
  
  const latinRatio = latinChars.length / totalChars;
  return latinRatio >= 0.8; // At least 80% Latin characters
}

/**
 * Check if a keyword is relevant to the niche based on seed keywords
 * Made more lenient to catch variations like "best hvac repair" from seed "hvac repair"
 */
function isRelevantToNiche(keyword: string, seedKeywords: string[]): boolean {
  const keywordLower = keyword.toLowerCase().trim();
  const keywordWords = keywordLower.split(/\s+/).filter(w => w.length > 2);
  
  // Check if keyword shares significant words with any seed keyword
  for (const seed of seedKeywords) {
    const seedLower = seed.toLowerCase().trim();
    const seedWords = seedLower.split(/\s+/).filter(w => w.length > 2);
    
    // If seed is empty, skip
    if (seedWords.length === 0) continue;
    
    // Count common words (more lenient matching)
    const commonWords = keywordWords.filter(kw => 
      seedWords.some(sw => {
        // Exact match
        if (kw === sw) return true;
        // One contains the other (catches "hvac" in "hvac repair")
        if (kw.includes(sw) || sw.includes(kw)) return true;
        // Similar words (catches plurals, etc.)
        if (kw.length > 3 && sw.length > 3) {
          // Check if they share 3+ character prefix
          const minLen = Math.min(kw.length, sw.length);
          if (minLen >= 3 && kw.substring(0, 3) === sw.substring(0, 3)) return true;
        }
        return false;
      })
    );
    
    // If at least one significant word matches, it's relevant
    if (commonWords.length > 0) {
      return true;
    }
    
    // Also check if keyword contains the seed keyword or vice versa
    // This catches "best hvac repair" containing "hvac repair"
    if (keywordLower.includes(seedLower) || seedLower.includes(keywordLower)) {
      return true;
    }
    
    // Check if any seed word appears in keyword (catches "hvac" in "best hvac company")
    for (const seedWord of seedWords) {
      if (seedWord.length > 3 && keywordLower.includes(seedWord)) {
        return true;
      }
    }
  }
  
  return false;
}

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
 * Merge similar keywords, keeping the one with highest volume
 */
function mergeSimilarKeywords(
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🚀 [DISCOVER-KEYWORDS] API called');
  
  if (req.method !== 'POST') {
    console.log('❌ [DISCOVER-KEYWORDS] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { city, state } = req.body;

  console.log('📥 [DISCOVER-KEYWORDS] Request params:', { id, city, state });

  if (typeof id !== 'string' || !city || !state) {
    console.error('❌ [DISCOVER-KEYWORDS] Invalid parameters');
    return res.status(400).json({ error: 'Invalid parameters. Batch ID, city, and state are required.' });
  }

  try {
    // Get batch and niche info
    const batch = await prisma.scanBatch.findUnique({
      where: { id },
      include: {
        niche: true,
      },
    });

    if (!batch) {
      console.error('❌ [DISCOVER-KEYWORDS] Batch not found:', id);
      return res.status(404).json({ error: 'Batch not found' });
    }
    console.log('✅ [DISCOVER-KEYWORDS] Batch found:', batch.name);

    // Get city
    const cityRecord = await prisma.cityV5000.findFirst({
      where: {
        city: city,
        state: state,
        countryCode: 'US',
      },
    });

    if (!cityRecord) {
      console.error(`❌ [DISCOVER-KEYWORDS] City not found: ${city}, ${state}`);
      return res.status(404).json({ error: 'City not found' });
    }
    console.log('✅ [DISCOVER-KEYWORDS] City found:', cityRecord.id);

    // Get existing keywords for this city (use top performers as seeds)
    // First get all keywords, then sort by opportunity in JavaScript to handle nulls
    const allExistingKeywords = await prisma.keywordV5000.findMany({
      where: {
        batchId: id,
        cityId: cityRecord.id,
        isSkipped: false,
      },
      include: {
        nicheKeyword: true,
        metrics: true,
        difficultyScore: true,
      },
    });
    
    console.log(`📊 [DISCOVER-KEYWORDS] Found ${allExistingKeywords.length} total existing keywords for this city`);
    
    // Sort by opportunity (highest first), handling nulls
    const existingKeywords = allExistingKeywords
      .sort((a, b) => {
        const oppA = a.difficultyScore?.opportunity ?? 0;
        const oppB = b.difficultyScore?.opportunity ?? 0;
        return oppB - oppA;
      })
      .slice(0, 10); // Take top 10

    if (existingKeywords.length === 0) {
      console.error(`❌ [DISCOVER-KEYWORDS] No existing keywords found for ${city}, ${state} to use as seeds`);
      return res.status(400).json({ error: 'No existing keywords found for this city to use as seeds' });
    }
    
    const seedKeywords = existingKeywords.map(kw => kw.nicheKeyword.keyword);
    console.log(`✅ [DISCOVER-KEYWORDS] Found ${existingKeywords.length} existing keywords to use as seeds`);
    console.log(`📋 [DISCOVER-KEYWORDS] Seed keywords: ${seedKeywords.join(', ')}`);
    console.log(`📋 [DISCOVER-KEYWORDS] Existing keywords for this city: ${Array.from(new Set(existingKeywords.map(kw => kw.nicheKeyword.keyword.toLowerCase().trim()))).slice(0, 10).join(', ')}`);
    
    // Also get ALL existing keywords in the batch (across all cities) to avoid duplicates
    const allBatchKeywords = await prisma.keywordV5000.findMany({
      where: {
        batchId: id,
        isSkipped: false,
      },
      include: {
        nicheKeyword: true,
      },
    });
    
    const allExistingKeywordTexts = new Set(
      allBatchKeywords.map(kw => kw.nicheKeyword.keyword.toLowerCase().trim())
    );
    console.log(`📊 [DISCOVER-KEYWORDS] Total existing keywords in batch (all cities): ${allExistingKeywordTexts.size}`);
    
    // Create set of existing keywords for THIS city (used for filtering)
    const existingKeywordsForCity = new Set(
      allExistingKeywords.map(kw => kw.nicheKeyword.keyword.toLowerCase().trim())
    );
    console.log(`📊 [DISCOVER-KEYWORDS] Existing keywords for ${city}, ${state}: ${existingKeywordsForCity.size}`);

    // Get Keywords Everywhere API key
    const apiKey = await getKeywordsEverywhereAPIKey();
    if (!apiKey) {
      console.error('❌ Keywords Everywhere API key not configured');
      return res.status(400).json({ error: 'Keywords Everywhere API key not configured' });
    }
    console.log('✅ Keywords Everywhere API key found');

    // Discover related keywords using multiple methods
    const discoveredKeywords = new Map<string, { keyword: string; volume: number; competition?: number }>();

    console.log(`🔍 [DISCOVER-KEYWORDS] Discovering keywords from ${seedKeywords.length} seed keywords...`);

    // Method 1: Comprehensive Keyword Expansion (Most Reliable)
    console.log(`\n📡 [METHOD 1] Generating comprehensive keyword variations...`);
    let expansionFound = 0;
    try {
      const allVariations: string[] = [];
      // Use more seed keywords and generate variations
      const seedsToUse = seedKeywords.slice(0, 15); // Use top 15 seeds
      console.log(`   [METHOD 1] Using ${seedsToUse.length} seed keywords: ${seedsToUse.slice(0, 5).join(', ')}...`);
      
      for (const seedKeyword of seedsToUse) {
        const vars = generateKeywordVariations(seedKeyword, city);
        allVariations.push(...vars);
        if (allVariations.length <= 50) { // Only log first few to avoid spam
          console.log(`   [METHOD 1] Generated ${vars.length} variations from seed: "${seedKeyword}"`);
        }
      }
      
      const uniqueVariations = Array.from(new Set(allVariations));
      console.log(`   [METHOD 1] Generated ${uniqueVariations.length} unique keyword variations total`);
      console.log(`   [METHOD 1] Sample variations: ${uniqueVariations.slice(0, 10).join(', ')}`);
      
      if (uniqueVariations.length === 0) {
        console.error(`   ❌ [METHOD 1] No variations generated! Check generateKeywordVariations function.`);
      } else if (uniqueVariations.length < 50) {
        console.warn(`   ⚠️  [METHOD 1] Only ${uniqueVariations.length} variations generated - expected 200+ per seed keyword. This might indicate an issue.`);
      }
      
      // Filter out variations that are exact matches to existing keywords BEFORE volume check
      // This saves API calls
      const existingSet = new Set(existingKeywordsForCity);
      const filteredVariations = uniqueVariations.filter(v => {
        const vLower = v.toLowerCase().trim();
        const isDuplicate = existingSet.has(vLower);
        return !isDuplicate;
      });
      console.log(`   [METHOD 1] Filtered out ${uniqueVariations.length - filteredVariations.length} exact duplicates before volume check`);
      console.log(`   [METHOD 1] ${filteredVariations.length} variations remaining to check volumes for`);
      
      if (filteredVariations.length === 0) {
        console.warn(`   ⚠️  [METHOD 1] All ${uniqueVariations.length} variations were exact duplicates! This means we need to generate more diverse variations.`);
        console.log(`   [METHOD 1] Sample existing keywords: ${Array.from(existingSet).slice(0, 10).join(', ')}`);
        console.log(`   [METHOD 1] Sample generated variations: ${uniqueVariations.slice(0, 10).join(', ')}`);
      }
      
      // Fetch volumes in bulk (100 at a time) - use filtered variations
      let batchNum = 0;
      for (let i = 0; i < filteredVariations.length; i += 100) {
        batchNum++;
        const batch = filteredVariations.slice(i, i + 100);
        // For local queries, use "keyword city" format (not "keyword city state")
        // State makes queries too specific and often returns 0 or national volumes
        const variationQueries = batch.map(kw => `${kw} ${city}`);
        console.log(`   [METHOD 1] Fetching volumes for batch ${batchNum} (${batch.length} keywords)...`);
        console.log(`   [METHOD 1] Sample queries: ${variationQueries.slice(0, 3).join(', ')}`);
        const volumeData = await getBulkKeywordData(variationQueries);
        console.log(`   [METHOD 1] Received volume data for ${volumeData.size} keywords`);
        
        // Debug: Show sample volume data
        if (volumeData.size > 0) {
          const sampleEntries = Array.from(volumeData.entries()).slice(0, 3);
          console.log(`   [METHOD 1] Sample volume data:`, sampleEntries.map(([q, d]) => `${q}: vol=${d.volume}, cpc=${d.cpc}`).join(', '));
        } else {
          console.log(`   ⚠️  [METHOD 1] WARNING: No volume data returned from API!`);
        }
        
        let batchAccepted = 0;
        let batchRejectedEnglish = 0;
        let batchRejectedRelevance = 0;
        let batchRejectedVolume = 0;
        let batchRejectedDuplicate = 0;
        
        for (const variation of batch) {
          // Filter: Must be in English
          if (!isEnglishKeyword(variation)) {
            batchRejectedEnglish++;
            continue;
          }
          
          // Filter: Must be relevant to niche
          if (!isRelevantToNiche(variation, seedKeywords)) {
            batchRejectedRelevance++;
            if (batchRejectedRelevance <= 3) {
              console.log(`   ⚠️  [METHOD 1] Rejected (not relevant): "${variation}"`);
            }
            continue;
          }
          
          // Use "keyword city" format to match what we queried
          const localizedQuery = `${variation} ${city}`;
          const data = volumeData.get(localizedQuery);
          const volume = data?.volume || 0;
          
          // Lower threshold for local keywords (they often have lower volumes)
          // Accept any keyword with volume > 0 if it's relevant
          const minVolume = 1; // Very low threshold - accept anything with volume
          
          if (volume >= minVolume) {
            const key = variation.toLowerCase().trim();
            
            // Check if already discovered in this run
            if (discoveredKeywords.has(key)) {
              batchRejectedDuplicate++;
              continue;
            }
            
            discoveredKeywords.set(key, {
              keyword: variation.trim(), // Trim whitespace before storing
              volume: volume,
              competition: undefined,
            });
            expansionFound++;
            batchAccepted++;
            if (expansionFound <= 10) {
              console.log(`   ✅ [METHOD 1] Accepted: "${variation}" (vol: ${volume})`);
            }
          } else {
            batchRejectedVolume++;
            if (batchRejectedVolume <= 3) {
              console.log(`   ⚠️  [METHOD 1] Rejected (no volume): "${variation}" (vol: ${volume})`);
            }
          }
        }
        
        console.log(`   [METHOD 1] Batch ${batchNum} results: ${batchAccepted} accepted, ${batchRejectedEnglish} non-English, ${batchRejectedRelevance} irrelevant, ${batchRejectedVolume} no volume, ${batchRejectedDuplicate} duplicates`);
      }
      console.log(`✅ [METHOD 1] Discovered ${expansionFound} keywords from expansion method`);
    } catch (error: any) {
      console.error(`❌ [METHOD 1] Expansion failed:`, error.message);
    }

    // Method 2: Google Autocomplete (Optional - uses public endpoint, may be rate-limited)
    // Note: This uses Google's public autocomplete endpoint, not an official API
    // If it fails, we continue with other methods
    console.log(`\n📡 [METHOD 2] Fetching Google Autocomplete suggestions (optional - may be rate-limited)...`);
    let autocompleteFound = 0;
    try {
      const allAutocompleteSuggestions: string[] = [];
      // Limit to 3 seed keywords to reduce chance of rate limiting
      for (const seedKeyword of seedKeywords.slice(0, 3)) {
        try {
          const suggestions = await getGoogleAutocompleteSuggestions(seedKeyword, city, state);
          allAutocompleteSuggestions.push(...suggestions);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay for public endpoint
        } catch (error: any) {
          console.log(`   ⚠️  [METHOD 2] Autocomplete failed for "${seedKeyword}": ${error.message} - continuing with other methods`);
          // Continue with other seed keywords
        }
      }
      
      const uniqueAutocomplete = Array.from(new Set(allAutocompleteSuggestions));
      console.log(`   [METHOD 2] Found ${uniqueAutocomplete.length} unique autocomplete suggestions`);
      
      if (uniqueAutocomplete.length > 0) {
        // Fetch volumes in bulk
          const autocompleteQueries = uniqueAutocomplete.map(kw => `${kw} ${city}`);
          const volumeData = await getBulkKeywordData(autocompleteQueries);
          
          for (const suggestion of uniqueAutocomplete) {
            // Filter: Must be in English
            if (!isEnglishKeyword(suggestion)) {
              continue;
            }
            
            // Filter: Must be relevant to niche
            if (!isRelevantToNiche(suggestion, seedKeywords)) {
              continue;
            }
            
            const localizedQuery = `${suggestion} ${city}`;
            const data = volumeData.get(localizedQuery);
            const volume = data?.volume || 0;
          
          if (volume >= 1) { // Lower threshold like Method 1
            const key = suggestion.toLowerCase().trim();
            if (!discoveredKeywords.has(key) || discoveredKeywords.get(key)!.volume < volume) {
              discoveredKeywords.set(key, {
                keyword: suggestion.trim(), // Trim whitespace before storing
                volume: volume,
                competition: undefined,
              });
              autocompleteFound++;
            }
          }
        }
      }
      console.log(`✅ [METHOD 2] Discovered ${autocompleteFound} keywords from autocomplete`);
    } catch (error: any) {
      console.error(`❌ [METHOD 2] Autocomplete failed:`, error.message);
    }

    // Method 3: SERP-based extraction (Related searches + Competitor keywords)
    console.log(`\n📡 [METHOD 3] Extracting keywords from SERP data...`);
    let serpFound = 0;
    try {
      const topSeedKeyword = seedKeywords[0];
      console.log(`🔍 [METHOD 3] Fetching SERP for: "${topSeedKeyword}" in ${city}, ${state}`);
      
      // Get SERP data
      const { fetchSerpTop } = await import('@niche-hunter/crawler');
      const serpData = await fetchSerpTop(topSeedKeyword, city, state);
      
      // Extract from related searches
      const serpKeywords = await getRelatedKeywordsFromSERP(topSeedKeyword, city, state);
      
      // Extract from competitor titles/snippets
      const competitorKeywords = extractCompetitorKeywords(
        serpData.results || [],
        topSeedKeyword
      );
      
      const allSerpKeywords = [...serpKeywords.map(k => k.keyword), ...competitorKeywords];
      const uniqueSerp = Array.from(new Set(allSerpKeywords));
      console.log(`   [METHOD 3] Found ${uniqueSerp.length} keywords from SERP`);
      
      if (uniqueSerp.length > 0) {
        const serpQueries = uniqueSerp.map(kw => `${kw} ${city}`);
        const volumeData = await getBulkKeywordData(serpQueries);
        
        for (const serpKw of uniqueSerp) {
          // Filter: Must be in English
          if (!isEnglishKeyword(serpKw)) {
            continue;
          }
          
          // Filter: Must be relevant to niche
          if (!isRelevantToNiche(serpKw, seedKeywords)) {
            continue;
          }
          
          const localizedQuery = `${serpKw} ${city}`;
          const data = volumeData.get(localizedQuery);
          const volume = data?.volume || 0;
          
          if (volume >= 1) { // Lower threshold like Method 1
            const key = serpKw.toLowerCase().trim();
            if (!discoveredKeywords.has(key) || discoveredKeywords.get(key)!.volume < volume) {
              discoveredKeywords.set(key, {
                keyword: serpKw.trim(), // Trim whitespace before storing
                volume: volume,
                competition: undefined,
              });
              serpFound++;
            }
          }
        }
      }
      console.log(`✅ [METHOD 3] Discovered ${serpFound} keywords from SERP`);
    } catch (error: any) {
      console.error(`❌ [METHOD 3] SERP extraction failed:`, error.message);
    }

    // Method 4: Niche-specific templates
    console.log(`\n📡 [METHOD 4] Generating niche-specific template keywords...`);
    let templateFound = 0;
    try {
      const templateKeywords = generateNicheTemplates(batch.niche.name, seedKeywords, city);
      console.log(`   [METHOD 4] Generated ${templateKeywords.length} template-based keywords`);
      
      if (templateKeywords.length > 0) {
        // Fetch volumes in bulk (100 at a time)
        for (let i = 0; i < templateKeywords.length; i += 100) {
          const batch = templateKeywords.slice(i, i + 100);
          // Templates already include city, so use as-is (or add city if missing)
          const templateQueries = batch.map(kw => {
            if (kw.includes(city.toLowerCase())) {
              return kw; // Already has city
            }
            return `${kw} ${city}`; // Add city
          });
          const volumeData = await getBulkKeywordData(templateQueries);
          
          for (let idx = 0; idx < batch.length; idx++) {
            const templateKw = batch[idx];
            const queryUsed = templateQueries[idx];
            
            // Filter: Must be in English
            if (!isEnglishKeyword(templateKw)) {
              continue;
            }
            
            // Filter: Must be relevant to niche
            if (!isRelevantToNiche(templateKw, seedKeywords)) {
              continue;
            }
            
            // Get volume data using the query we actually sent
            const data = volumeData.get(queryUsed);
            const volume = data?.volume || 0;
            
            if (volume >= 1) { // Lower threshold like Method 1
              const key = templateKw.toLowerCase().trim();
              if (!discoveredKeywords.has(key) || discoveredKeywords.get(key)!.volume < volume) {
                discoveredKeywords.set(key, {
                  keyword: templateKw.trim(), // Trim whitespace before storing
                  volume: volume,
                  competition: undefined,
                });
                templateFound++;
              }
            }
          }
        }
      }
      console.log(`✅ [METHOD 4] Discovered ${templateFound} keywords from templates`);
    } catch (error: any) {
      console.error(`❌ [METHOD 4] Template generation failed:`, error.message);
    }

    console.log(`\n✅ [DISCOVER-KEYWORDS] Total discovered: ${discoveredKeywords.size} unique keywords (with volume >= 1-10 depending on relevance)`);

    // Merge similar keywords (e.g., "ac repair" and "a/c repair" are the same to Google)
    const keywordsArray = Array.from(discoveredKeywords.values());
    const mergedKeywords = mergeSimilarKeywords(keywordsArray);
    console.log(`🔄 [MERGE] Merged ${keywordsArray.length} keywords into ${mergedKeywords.length} unique keywords (removed ${keywordsArray.length - mergedKeywords.length} duplicates/variants)`);
    
    // Update discoveredKeywords map with merged results
    discoveredKeywords.clear();
    for (const kw of mergedKeywords) {
      const key = kw.keyword.toLowerCase().trim();
      discoveredKeywords.set(key, kw);
    }
    console.log(`📊 [AFTER-MERGE] ${discoveredKeywords.size} unique keywords after merging similar variants`);

    // Filter out keywords that already exist for THIS CITY (not all cities - same keyword can exist for different cities)
    // Note: existingKeywordsForCity is already defined above
    // Also normalize existing keywords for comparison
    const normalizedExisting = new Set(
      Array.from(existingKeywordsForCity).map(kw => normalizeKeyword(kw))
    );
    console.log(`📊 [FILTER] Checking ${discoveredKeywords.size} discovered keywords against ${normalizedExisting.size} existing keywords for ${city}, ${state}...`);

    // Helper function to strip city/state from keyword for comparison (defined once, used in multiple places)
    const stripCityFromKeyword = (keyword: string): string => {
      let cleaned = keyword.toLowerCase().trim();
      // Remove city name
      cleaned = cleaned.replace(new RegExp(`\\b${city.toLowerCase()}\\b`, 'g'), '').trim();
      // Remove state abbreviation
      cleaned = cleaned.replace(new RegExp(`\\b${state.toLowerCase()}\\b`, 'g'), '').trim();
      // Remove common location modifiers that might be left
      cleaned = cleaned.replace(/\b(in|near|around|local|nearby|near me)\b/g, '').trim();
      // Clean up multiple spaces
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      return cleaned;
    };

    // Final safety filter: Remove any keywords that slipped through
    let duplicateCount = 0;
    let englishRejected = 0;
    let relevanceRejected = 0;
    
    const newKeywords = Array.from(discoveredKeywords.values()).filter(kw => {
      const kwLower = kw.keyword.toLowerCase().trim();
      const kwNormalized = normalizeKeyword(kw.keyword);
      
      // Strip city/state from discovered keyword for comparison
      const kwWithoutCity = stripCityFromKeyword(kw.keyword);
      const kwWithoutCityNormalized = normalizeKeyword(kwWithoutCity);
      
      // Check if exact match exists (with or without city)
      if (existingKeywordsForCity.has(kwLower) || existingKeywordsForCity.has(kwWithoutCity)) {
        duplicateCount++;
        if (duplicateCount <= 5) {
          console.log(`   ⚠️  [FILTER] Duplicate (exact match): "${kw.keyword}" (compared as: "${kwWithoutCity}")`);
        }
        return false;
      }
      
      // Check if normalized version exists (e.g., "ac repair" vs "a/c repair")
      if (normalizedExisting.has(kwNormalized) || normalizedExisting.has(kwWithoutCityNormalized)) {
        duplicateCount++;
        if (duplicateCount <= 5) {
          console.log(`   ⚠️  [FILTER] Duplicate (normalized variant exists): "${kw.keyword}" (normalized: "${kwWithoutCityNormalized}")`);
        }
        return false;
      }
      
      // Final check: Must be English
      if (!isEnglishKeyword(kw.keyword)) {
        englishRejected++;
        console.log(`   ⚠️  [FINAL-FILTER] Rejected non-English keyword: "${kw.keyword}"`);
        return false;
      }
      
      // Final check: Must be relevant
      if (!isRelevantToNiche(kw.keyword, seedKeywords)) {
        relevanceRejected++;
        console.log(`   ⚠️  [FINAL-FILTER] Rejected irrelevant keyword: "${kw.keyword}"`);
        return false;
      }
      
      return true;
    });

    console.log(`📊 [FILTER] Results:`);
    console.log(`   - Total discovered: ${discoveredKeywords.size}`);
    console.log(`   - Duplicates (already exist): ${duplicateCount}`);
    console.log(`   - Rejected (non-English): ${englishRejected}`);
    console.log(`   - Rejected (irrelevant): ${relevanceRejected}`);
    console.log(`   - New keywords to add: ${newKeywords.length}`);
    
    if (newKeywords.length === 0 && discoveredKeywords.size > 0) {
      console.log(`⚠️  [WARNING] All ${discoveredKeywords.size} discovered keywords were filtered out!`);
      console.log(`   This could mean:`);
      console.log(`   1. All variations already exist in the database`);
      console.log(`   2. Relevance filter is too strict`);
      console.log(`   3. Volume threshold (>= 10) is too high`);
      
      // Show sample of what was discovered but filtered
      const sample = Array.from(discoveredKeywords.values()).slice(0, 5);
      console.log(`   Sample discovered keywords:`, sample.map(k => `${k.keyword} (vol: ${k.volume})`).join(', '));
    }

    if (newKeywords.length === 0) {
      console.log('⚠️ No new keywords found after filtering duplicates');
      
      // Return detailed debug info
      const debugInfo: any = {
        totalDiscovered: discoveredKeywords.size,
        duplicates: duplicateCount,
        englishRejected: englishRejected,
        relevanceRejected: relevanceRejected,
        existingKeywordsCount: existingKeywordsForCity.size,
        sampleExisting: Array.from(existingKeywordsForCity).slice(0, 10),
        sampleDiscovered: Array.from(discoveredKeywords.values()).slice(0, 10).map(k => ({
          keyword: k.keyword,
          volume: k.volume,
          normalized: normalizeKeyword(k.keyword)
        })),
        seedKeywords: seedKeywords.slice(0, 10),
        seedKeywordsCount: seedKeywords.length,
        note: "Similar keywords (e.g., 'ac repair' vs 'a/c repair') are automatically merged to avoid double-counting volumes"
      };
      
      // Try to get variation generation stats if available
      try {
        // This will be populated if Method 1 ran
        debugInfo.method1Stats = {
          note: "Check server logs for detailed Method 1 stats (variations generated, filtered, etc.)"
        };
      } catch (e) {
        // Ignore
      }
      
      console.log('📊 [DEBUG] Filter breakdown:', JSON.stringify(debugInfo, null, 2));
      
      return res.status(200).json({ 
        message: 'No new keywords found',
        added: 0,
        processed: 0,
        debug: debugInfo
      });
    }

    // Classify keywords
    const keywordClassifications = new Map<string, string>();
    for (const kw of newKeywords) {
      const type = classifyKeyword(kw.keyword);
      keywordClassifications.set(kw.keyword, type);
    }

    // Create NicheKeyword records (or get existing ones)
    // Strip city/state from keywords before saving (keywords should not include city name)
    // Note: stripCityFromKeyword is already defined above
    
    const nicheKeywordMap = new Map<string, string>();
    for (const kw of newKeywords) {
      // Strip city/state from keyword before saving
      const cleanKeyword = stripCityFromKeyword(kw.keyword);
      const keywordType = keywordClassifications.get(kw.keyword) || 'other';
      
      const nicheKeyword = await prisma.nicheKeyword.upsert({
        where: {
          nicheId_keyword: {
            nicheId: batch.nicheId,
            keyword: cleanKeyword,
          },
        },
        create: {
          nicheId: batch.nicheId,
          keyword: cleanKeyword,
          keywordType: keywordType,
          scope: 'local', // Local keywords are city-specific
        },
        update: {
          keywordType: keywordType, // Update type if keyword already exists
          // Don't update scope if it's already set to 'national' (preserve national keywords)
          scope: 'local', // Ensure local scope for city-specific keywords
        },
      });
      
      // Use original keyword as key (before cleaning) since we need to match it later
      nicheKeywordMap.set(kw.keyword, nicheKeyword.id);
    }

    // Create KeywordV5000 records
    const localizedQueries: string[] = [];
    const keywordRecords: Array<{ id: string; keyword: string; localizedQuery: string }> = [];

    for (const kw of newKeywords) {
      // Strip city/state from keyword for storage, but use full keyword for localized query
      const cleanKeyword = stripCityFromKeyword(kw.keyword);
      const localizedQuery = `${cleanKeyword} ${city} ${state}`;
      const keywordType = keywordClassifications.get(kw.keyword) || 'other';
      
      // Get the nicheKeywordId using the original keyword (before cleaning)
      const nicheKeywordId = nicheKeywordMap.get(kw.keyword);
      if (!nicheKeywordId) {
        console.error(`❌ [DISCOVER-KEYWORDS] Could not find nicheKeywordId for "${kw.keyword}"`);
        continue;
      }
      
      const keywordRecord = await prisma.keywordV5000.create({
        data: {
          batchId: id,
          nicheKeywordId: nicheKeywordId,
          cityId: cityRecord.id,
          localizedQuery: localizedQuery,
          keywordType: keywordType,
          isSkipped: false,
        },
      });

      localizedQueries.push(localizedQuery);
      keywordRecords.push({
        id: keywordRecord.id,
        keyword: kw.keyword,
        localizedQuery: localizedQuery,
      });
    }

    console.log(`✅ Created ${keywordRecords.length} keyword records`);

    // Fetch metrics (volume, CPC) from Keywords Everywhere
    console.log(`📡 Fetching volumes and CPC...`);
    const volumeData = await getBulkKeywordData(localizedQueries);

    // Store metrics
    for (const record of keywordRecords) {
      const data = volumeData.get(record.localizedQuery);
      if (data) {
        await prisma.keywordMetricsV5000.upsert({
          where: { keywordId: record.id },
          create: {
            keywordId: record.id,
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

    // Fetch KD from DataForSEO Labs
    console.log(`📡 Fetching keyword difficulty...`);
    let kdData: Map<string, number>;
    try {
      kdData = await getBulkKeywordDifficulty(localizedQueries);
    } catch (error: any) {
      console.error(`⚠️ DataForSEO Labs error:`, error.message);
      kdData = new Map();
    }

    // Update KD in metrics
    for (const record of keywordRecords) {
      const kd = kdData.get(record.localizedQuery);
      if (kd !== undefined) {
        await prisma.keywordMetricsV5000.update({
          where: { keywordId: record.id },
          data: { kd },
        });
      }
    }

    // Filter keywords with volume >= 10 for SERP analysis
    const keywordsForSerp = keywordRecords.filter(record => {
      const data = volumeData.get(record.localizedQuery);
      return (data?.volume || 0) >= 10;
    });

    console.log(`📊 Processing ${keywordsForSerp.length} keywords for SERP analysis`);

    // Fetch SERP data and calculate scores
    for (const record of keywordsForSerp) {
      try {
        const metrics = await prisma.keywordMetricsV5000.findUnique({
          where: { keywordId: record.id },
        });

        if (!metrics) continue;

        // Fetch SERP data
        const locationName = `${city}, ${state}, United States`;
        const [organicSerp, mapsSerp] = await Promise.all([
          getOrganicSERP(record.localizedQuery, locationName).catch(() => []),
          getMapsSERP(record.localizedQuery, locationName).catch(() => []),
        ]);

        // Store SERP snapshot
        if (organicSerp.length > 0 || mapsSerp.length > 0) {
          await prisma.serpSnapshotV5000.upsert({
            where: { keywordId: record.id },
            create: {
              keywordId: record.id,
              organicResults: organicSerp.length > 0 ? (organicSerp as any) : null,
              localPackResults: mapsSerp.length > 0 ? (mapsSerp as any) : null,
            },
            update: {
              organicResults: organicSerp.length > 0 ? (organicSerp as any) : null,
              localPackResults: mapsSerp.length > 0 ? (mapsSerp as any) : null,
            },
          });
        }

        // Calculate difficulty scores
        const serpWeakness = organicSerp.length > 0 ? calculateSerpWeakness(organicSerp, record.keyword) : null;
        const localPackStrength = mapsSerp.length > 0 ? calculateLocalPackStrength(mapsSerp, record.keyword) : null;
        const onpageCompetence = organicSerp.length > 0 ? calculateOnpageCompetence(organicSerp, record.keyword, city) : null;
        const finalDifficulty = calculateFinalDifficulty(
          metrics.kd || null,
          serpWeakness,
          localPackStrength,
          onpageCompetence
        );

        // Get lead value from city
        const leadValue = cityRecord.payout || 0;

        // Calculate opportunity
        const opportunityBreakdown = calculateOpportunity(
          metrics.searchVolume || 0,
          metrics.cpc || 0,
          leadValue,
          finalDifficulty.finalDifficulty
        );

        // Store difficulty score
        await prisma.difficultyScoreV5000.upsert({
          where: { keywordId: record.id },
          create: {
            keywordId: record.id,
            serpWeakness: serpWeakness,
            localPackStrength: localPackStrength,
            onpageCompetence: onpageCompetence,
            finalDifficulty: finalDifficulty.finalDifficulty,
            opportunity: opportunityBreakdown.opportunity,
            serpDifficulty: finalDifficulty.serpDifficulty,
            kdComponent: finalDifficulty.kdComponent,
            serpComponent: finalDifficulty.serpComponent,
            packComponent: finalDifficulty.packComponent,
            onpageComponent: finalDifficulty.onpageComponent,
            cpcMultiplier: opportunityBreakdown.cpcMultiplier,
            leadValueMultiplier: opportunityBreakdown.leadValueMultiplier,
            baseOpportunity: opportunityBreakdown.baseOpportunity,
          },
          update: {
            serpWeakness: serpWeakness,
            localPackStrength: localPackStrength,
            onpageCompetence: onpageCompetence,
            finalDifficulty: finalDifficulty.finalDifficulty,
            opportunity: opportunityBreakdown.opportunity,
            serpDifficulty: finalDifficulty.serpDifficulty,
            kdComponent: finalDifficulty.kdComponent,
            serpComponent: finalDifficulty.serpComponent,
            packComponent: finalDifficulty.packComponent,
            onpageComponent: finalDifficulty.onpageComponent,
            cpcMultiplier: opportunityBreakdown.cpcMultiplier,
            leadValueMultiplier: opportunityBreakdown.leadValueMultiplier,
            baseOpportunity: opportunityBreakdown.baseOpportunity,
          },
        });
      } catch (error: any) {
        console.error(`Error processing keyword "${record.keyword}":`, error.message);
        // Continue with other keywords
      }
    }

    // Update batch processed count
    await prisma.scanBatch.update({
      where: { id },
      data: {
        processedKeywords: {
          increment: keywordRecords.length,
        },
      },
    });

    console.log(`✅ [DISCOVER-KEYWORDS] Success! Added ${keywordRecords.length} keywords, processed ${keywordsForSerp.length} with SERP analysis`);
    
    return res.status(200).json({
      message: 'Keywords discovered and processed successfully',
      added: keywordRecords.length,
      processed: keywordsForSerp.length,
    });
  } catch (error: any) {
    console.error('❌ [DISCOVER-KEYWORDS] Error:', error);
    console.error('❌ [DISCOVER-KEYWORDS] Error stack:', error.stack);
    return res.status(500).json({ error: error.message || 'Failed to discover keywords' });
  }
}

