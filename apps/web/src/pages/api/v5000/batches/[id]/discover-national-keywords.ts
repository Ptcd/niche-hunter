import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import {
  getKeywordsEverywhereAPIKey,
  getBulkKeywordData,
} from '@niche-hunter/crawler';
import { classifyKeyword } from '../../../../../lib/keyword-classifier';
import { detectMissingKeywords } from '../../../../../lib/missing-keyword-detector';

/**
 * Check if a keyword is primarily in English (Latin characters)
 */
function isEnglishKeyword(keyword: string): boolean {
  const cleaned = keyword.replace(/[0-9\s\-_.,!?]/g, '');
  const latinChars = cleaned.match(/[a-zA-Z]/g) || [];
  const nonLatinChars = cleaned.match(/[^\x00-\x7F]/g) || [];
  const totalChars = latinChars.length + nonLatinChars.length;
  if (totalChars === 0) return false;
  const latinRatio = latinChars.length / totalChars;
  return latinRatio >= 0.8;
}

/**
 * Check if a keyword is relevant to the niche
 */
function isRelevantToNiche(keyword: string, seedKeywords: string[]): boolean {
  const keywordLower = keyword.toLowerCase().trim();
  const keywordWords = keywordLower.split(/\s+/).filter(w => w.length > 2);

  for (const seed of seedKeywords) {
    const seedLower = seed.toLowerCase().trim();
    const seedWords = seedLower.split(/\s+/).filter(w => w.length > 2);

    if (seedWords.length === 0) continue;

    const commonWords = keywordWords.filter(kw =>
      seedWords.some(sw => {
        if (kw === sw) return true;
        if (kw.includes(sw) || sw.includes(kw)) return true;
        if (kw.length > 3 && sw.length > 3) {
          const minLen = Math.min(kw.length, sw.length);
          if (minLen >= 3 && kw.substring(0, 3) === sw.substring(0, 3)) return true;
        }
        return false;
      })
    );

    if (commonWords.length > 0) return true;
    if (keywordLower.includes(seedLower) || seedLower.includes(keywordLower)) return true;

    for (const seedWord of seedWords) {
      if (seedWord.length > 3 && keywordLower.includes(seedWord)) return true;
    }
  }

  return false;
}

/**
 * Normalize a keyword to a canonical form for comparison
 */
function normalizeKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\ba\/c\b/g, 'ac')
    .replace(/\bhv\/ac\b/g, 'hvac')
    .replace(/\bhva\/c\b/g, 'hvac')
    .replace(/[^a-z0-9\s]/g, '');
}

/**
 * Check if two keywords are equivalent (same meaning, different spelling/variations)
 */
function areKeywordsEquivalent(kw1: string, kw2: string): boolean {
  const norm1 = normalizeKeyword(kw1);
  const norm2 = normalizeKeyword(kw2);
  if (norm1 === norm2) return true;
  
  const words1 = norm1.split(/\s+/).filter(w => w.length > 2).sort();
  const words2 = norm2.split(/\s+/).filter(w => w.length > 2).sort();
  
  if (words1.length !== words2.length) return false;
  if (words1.length === 0) return false;
  
  return words1.every((w, i) => w === words2[i]);
}

/**
 * Merge similar keywords, keeping the one with highest volume
 */
function mergeSimilarKeywords(keywords: Array<{ keyword: string; volume: number; competition?: number }>): Array<{ keyword: string; volume: number; competition?: number }> {
  const grouped = new Map<string, Array<{ keyword: string; volume: number; competition?: number }>>();
  
  for (const kw of keywords) {
    const normalized = normalizeKeyword(kw.keyword);
    if (!grouped.has(normalized)) {
      grouped.set(normalized, []);
    }
    grouped.get(normalized)!.push(kw);
  }
  
  const merged: Array<{ keyword: string; volume: number; competition?: number }> = [];
  for (const group of grouped.values()) {
    group.sort((a, b) => b.volume - a.volume);
    merged.push(group[0]);
  }
  
  return merged;
}

/**
 * Generate national service keywords (money/supporting keywords)
 */
function generateNationalServiceKeywords(nicheName: string, seedKeywords: string[]): string[] {
  const keywords: string[] = [];
  const nicheLower = nicheName.toLowerCase().trim();
  
  const coreTerms = new Set<string>();
  for (const seed of seedKeywords) {
    const seedLower = seed.toLowerCase().trim();
    const cleaned = seedLower
      .replace(/\b(near me|nearby|local|in [a-z]+|near [a-z]+)\b/g, '')
      .trim();
    if (cleaned.length > 2) {
      coreTerms.add(cleaned);
    }
  }
  
  coreTerms.add(nicheLower);
  
  const serviceActions = [
    'repair', 'installation', 'install', 'replacement', 'replace',
    'maintenance', 'service', 'services', 'tune up', 'tune-up',
    'cleaning', 'clean', 'inspection', 'inspect'
  ];
  
  for (const term of Array.from(coreTerms)) {
    keywords.push(term);
    for (const action of serviceActions) {
      if (!term.includes(action)) {
        keywords.push(`${term} ${action}`);
      }
    }
    keywords.push(`emergency ${term}`);
    keywords.push(`24/7 ${term}`);
    keywords.push(`${term} company`);
    keywords.push(`${term} contractor`);
    keywords.push(`${term} service`);
  }
  
  const unique = Array.from(new Set(keywords));
  return unique.filter(kw => kw.length > 3 && kw.length < 60);
}

/**
 * Generate informational keywords (how-to, guides, FAQs, etc.)
 */
function generateInformationalKeywords(nicheName: string, seedKeywords: string[]): string[] {
  const keywords: string[] = [];
  const nicheLower = nicheName.toLowerCase().trim();
  
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
  
  // Expanded how-to actions
  const diyActions = ['fix', 'repair', 'maintain', 'install', 'replace', 'clean', 'troubleshoot', 'diagnose', 'service', 'winterize', 'prepare', 'check', 'test', 'reset', 'program'];
  for (const term of Array.from(coreTerms)) {
    for (const action of diyActions) {
      if (!term.includes(action)) {
        keywords.push(`how to ${action} ${term}`);
        keywords.push(`how to ${term} ${action}`);
        keywords.push(`${action} ${term} yourself`);
        keywords.push(`diy ${action} ${term}`);
      }
    }
  }
  
  // Expanded problem patterns
  const commonProblems = [
    'not working', 'not cooling', 'not heating', 'making noise', 'leaking',
    'broken', 'frozen', 'short cycling', 'blowing hot air', 'blowing cold air',
    'won\'t turn on', 'won\'t turn off', 'running constantly', 'tripping breaker',
    'smells bad', 'smells musty', 'low pressure', 'high pressure', 'not blowing air',
    'making loud noise', 'making strange noise', 'ice on unit', 'water leaking',
    'not responding', 'error code', 'flashing light'
  ];
  for (const term of Array.from(coreTerms)) {
    for (const problem of commonProblems) {
      keywords.push(`why ${term} ${problem}`);
      keywords.push(`why is my ${term} ${problem}`);
      keywords.push(`${term} ${problem}`);
      keywords.push(`what causes ${term} to ${problem}`);
    }
  }
  
  // Expanded concepts
  const concepts = [
    'tune up', 'maintenance', 'seer rating', 'btu', 'tonnage', 'refrigerant',
    'air filter', 'thermostat', 'compressor', 'evaporator coil', 'condenser',
    'ductwork', 'heat pump', 'furnace', 'air handler', 'zoned system',
    'programmable thermostat', 'smart thermostat', 'energy star'
  ];
  for (const concept of concepts) {
    keywords.push(`what is ${concept}`);
    keywords.push(`what is ${nicheLower} ${concept}`);
    keywords.push(`${concept} explained`);
    keywords.push(`understanding ${concept}`);
  }
  
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
    keywords.push(`${term} maintenance checklist`);
    keywords.push(`${term} seasonal maintenance`);
    keywords.push(`${term} preventive maintenance`);
    keywords.push(`${term} tune up checklist`);
    keywords.push(`${term} installation guide`);
    keywords.push(`${term} replacement guide`);
    keywords.push(`${term} buying guide`);
    keywords.push(`how to choose ${term}`);
    keywords.push(`${term} size calculator`);
    keywords.push(`${term} efficiency guide`);
    keywords.push(`${term} energy efficiency`);
    keywords.push(`${term} sizing guide`);
  }
  
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
  
  for (const term of Array.from(coreTerms)) {
    keywords.push(`how much does ${term} cost`);
    keywords.push(`${term} cost guide`);
    keywords.push(`${term} price guide`);
    keywords.push(`average ${term} cost`);
  }
  
  const comparisons = [
    'heat pump vs furnace',
    'gas vs electric',
    'central air vs window unit',
    'ductless vs central',
  ];
  keywords.push(...comparisons);
  
  // Seasonal patterns
  const seasons = ['winter', 'summer', 'spring', 'fall', 'autumn'];
  const seasonalActions = ['tips', 'maintenance', 'checklist', 'preparation', 'care', 'prep'];
  for (const season of seasons) {
    for (const action of seasonalActions) {
      keywords.push(`${season} ${nicheLower} ${action}`);
    }
    for (const term of Array.from(coreTerms)) {
      for (const action of seasonalActions) {
        keywords.push(`${season} ${term} ${action}`);
      }
    }
  }
  
  // Additional seasonal-specific
  keywords.push(`winter ${nicheLower} tips`);
  keywords.push(`summer ${nicheLower} maintenance`);
  keywords.push(`spring ${nicheLower} checklist`);
  keywords.push(`fall ${nicheLower} preparation`);
  keywords.push(`winterizing ${nicheLower}`);
  keywords.push(`summer ${nicheLower} efficiency`);
  
  const unique = Array.from(new Set(keywords));
  return unique.filter(kw => kw.length > 5 && kw.length < 70);
}

/**
 * Generate supporting/comparison keywords (best, reviews, vs, etc.)
 */
function generateSupportingKeywords(nicheName: string, seedKeywords: string[]): string[] {
  const keywords: string[] = [];
  const nicheLower = nicheName.toLowerCase().trim();
  
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
  
  // Quality modifiers
  const qualityModifiers = ['best', 'top', 'top rated', 'highly rated', 'professional', 'reliable', 'trusted', 'affordable', 'cheap', 'quality', 'premium', 'expert'];
  const companyTypes = ['company', 'companies', 'contractor', 'contractors', 'service', 'services', 'provider', 'providers', 'specialist', 'specialists', 'technician', 'technicians'];
  
  // Best/top patterns with more variations
  for (const term of Array.from(coreTerms)) {
    for (const modifier of qualityModifiers) {
      keywords.push(`${modifier} ${term}`);
      keywords.push(`${modifier} ${term} companies`);
      keywords.push(`${modifier} ${term} brands`);
    }
  }
  
  // Review patterns
  for (const term of Array.from(coreTerms)) {
    keywords.push(`${term} reviews`);
    keywords.push(`${term} company reviews`);
    keywords.push(`best ${term} reviews`);
    keywords.push(`${term} ratings`);
    keywords.push(`${term} testimonials`);
    keywords.push(`${term} customer reviews`);
    keywords.push(`${term} online reviews`);
  }
  
  // Comparison patterns
  const brands = ['lennox', 'carrier', 'trane', 'rheem', 'goodman', 'york', 'daikin', 'bryant', 'american standard'];
  for (let i = 0; i < brands.length - 1; i++) {
    for (let j = i + 1; j < brands.length; j++) {
      keywords.push(`${brands[i]} vs ${brands[j]}`);
    }
  }
  
  // Term vs term comparisons
  const termArray = Array.from(coreTerms);
  for (let i = 0; i < termArray.length - 1; i++) {
    for (let j = i + 1; j < termArray.length; j++) {
      keywords.push(`${termArray[i]} vs ${termArray[j]}`);
    }
  }
  
  // Comparison keywords
  for (const term of Array.from(coreTerms)) {
    keywords.push(`${term} comparison`);
    keywords.push(`compare ${term}`);
    keywords.push(`${term} vs alternatives`);
  }
  
  // Cost/price patterns
  const costTerms = ['cost', 'price', 'pricing', 'rates', 'estimate', 'quote', 'how much', 'average cost', 'installation cost', 'repair cost'];
  for (const term of Array.from(coreTerms)) {
    for (const costTerm of costTerms) {
      keywords.push(`${term} ${costTerm}`);
    }
    keywords.push(`affordable ${term}`);
    keywords.push(`cheap ${term}`);
    keywords.push(`budget ${term}`);
    keywords.push(`low cost ${term}`);
  }
  
  // Quality/reliability patterns
  for (const term of Array.from(coreTerms)) {
    keywords.push(`reliable ${term}`);
    keywords.push(`quality ${term}`);
    keywords.push(`trusted ${term} companies`);
    keywords.push(`certified ${term}`);
    keywords.push(`licensed ${term}`);
    keywords.push(`insured ${term}`);
    keywords.push(`experienced ${term}`);
  }
  
  // Company type combinations
  for (const term of Array.from(coreTerms)) {
    for (const companyType of companyTypes) {
      keywords.push(`${term} ${companyType}`);
      keywords.push(`best ${term} ${companyType}`);
    }
  }
  
  const unique = Array.from(new Set(keywords));
  return unique.filter(kw => kw.length > 3 && kw.length < 60);
}

/**
 * Discover national (non-localized) keywords for a niche
 * Volume thresholds:
 * - Money/Supporting: ≥3,000
 * - Informational: ≥300
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Batch ID is required' });
  }

  console.log('🚀 [DISCOVER-NATIONAL-KEYWORDS] API called');
  console.log('📥 [DISCOVER-NATIONAL-KEYWORDS] Request params:', { id });

  try {
    // Get batch and niche
    const batch = await prisma.scanBatch.findUnique({
      where: { id },
      include: {
        niche: true,
      },
    });

    if (!batch) {
      console.error('❌ [DISCOVER-NATIONAL-KEYWORDS] Batch not found:', id);
      return res.status(404).json({ error: 'Batch not found' });
    }

    console.log('✅ [DISCOVER-NATIONAL-KEYWORDS] Batch found:', batch.name);
    console.log('✅ [DISCOVER-NATIONAL-KEYWORDS] Niche:', batch.niche.name);

    // Get existing keywords for this niche to use as seeds
    const existingKeywords = await prisma.nicheKeyword.findMany({
      where: {
        nicheId: batch.nicheId,
        isActive: true,
      },
      take: 20, // Get top 20 for seed generation
      orderBy: {
        createdAt: 'desc',
      },
    });

    const seedKeywords = existingKeywords.map(nk => nk.keyword);
    if (seedKeywords.length === 0) {
      // Fallback to niche name
      seedKeywords.push(batch.niche.name.toLowerCase());
    }

    console.log(`📋 [DISCOVER-NATIONAL-KEYWORDS] Using ${seedKeywords.length} seed keywords:`, seedKeywords.slice(0, 10).join(', '));

    // Check API key
    const apiKey = await getKeywordsEverywhereAPIKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'Keywords Everywhere API key not found' });
    }
    console.log('✅ Keywords Everywhere API key found');

    // Generate national keywords
    console.log('🔍 [DISCOVER-NATIONAL-KEYWORDS] Generating national keyword variations...');

    // 1. Service keywords (money/supporting)
    const serviceKeywords = generateNationalServiceKeywords(batch.niche.name, seedKeywords);
    console.log(`   📡 Generated ${serviceKeywords.length} service keyword variations`);

    // 2. Supporting keywords
    const supportingKeywords = generateSupportingKeywords(batch.niche.name, seedKeywords);
    console.log(`   📡 Generated ${supportingKeywords.length} supporting keyword variations`);

    // 3. Informational keywords
    const informationalKeywords = generateInformationalKeywords(batch.niche.name, seedKeywords);
    console.log(`   📡 Generated ${informationalKeywords.length} informational keyword variations`);

    // Combine all
    const allGeneratedKeywords = [
      ...serviceKeywords,
      ...supportingKeywords,
      ...informationalKeywords,
    ];

    // Remove duplicates
    const uniqueKeywords = Array.from(new Set(allGeneratedKeywords.map(k => k.toLowerCase().trim())));
    console.log(`✅ [DISCOVER-NATIONAL-KEYWORDS] Total unique keywords generated: ${uniqueKeywords.length}`);

    // Get existing national keywords to avoid duplicates
    const existingNationalKeywords = await prisma.nicheKeyword.findMany({
      where: {
        nicheId: batch.nicheId,
        scope: 'national',
      },
    });

    const existingKeywordsSet = new Set(
      existingNationalKeywords.map(nk => normalizeKeyword(nk.keyword))
    );
    console.log(`📊 [DISCOVER-NATIONAL-KEYWORDS] Found ${existingNationalKeywords.length} existing national keywords`);

    // Filter out existing keywords
    const newKeywordsToCheck = uniqueKeywords.filter(kw => {
      const normalized = normalizeKeyword(kw);
      // Check exact match
      if (existingKeywordsSet.has(normalized)) return false;
      // Check if equivalent to any existing
      for (const existing of existingNationalKeywords) {
        if (areKeywordsEquivalent(kw, existing.keyword)) return false;
      }
      return true;
    });

    console.log(`📊 [DISCOVER-NATIONAL-KEYWORDS] ${newKeywordsToCheck.length} new keywords to check volumes for`);

    if (newKeywordsToCheck.length === 0) {
      return res.status(200).json({
        message: 'No new national keywords to discover',
        added: 0,
        processed: 0,
      });
    }

    // Fetch volumes in batches
    const discoveredKeywords = new Map<string, { keyword: string; volume: number; competition?: number }>();
    const batchSize = 100;

    for (let i = 0; i < newKeywordsToCheck.length; i += batchSize) {
      const batch = newKeywordsToCheck.slice(i, i + batchSize);
      console.log(`   📡 Fetching volumes for batch ${Math.floor(i / batchSize) + 1} (${batch.length} keywords)...`);

      try {
        const volumeData = await getBulkKeywordData(batch);
        console.log(`   ✅ Received volume data for ${volumeData.size} keywords`);

        for (const [keyword, data] of volumeData.entries()) {
          try {
            const volume = data.volume || 0;
            const competition = data.competition || 0;

            // Classify keyword to determine threshold
            const keywordType = classifyKeyword(keyword);
            const isInformational = keywordType === 'informational';
            // Lowered thresholds to find more keywords: supporting/money 3000, informational 300
            const minVolume = isInformational ? 300 : 3000;

            // Apply volume threshold
            if (volume >= minVolume) {
              // Final filters
              if (!isEnglishKeyword(keyword)) {
                console.log(`   ⚠️  Rejected non-English: "${keyword}"`);
                continue;
              }

              if (!isRelevantToNiche(keyword, seedKeywords)) {
                console.log(`   ⚠️  Rejected irrelevant: "${keyword}"`);
                continue;
              }

              discoveredKeywords.set(keyword.toLowerCase().trim(), {
                keyword,
                volume,
                competition,
              });
              console.log(`   ✅ Accepted: "${keyword}" (vol: ${volume}, type: ${keywordType})`);
            } else {
              console.log(`   ⚠️  Rejected (volume ${volume} < ${minVolume}): "${keyword}"`);
            }
          } catch (keywordError: any) {
            console.error(`   ⚠️  Error processing keyword "${keyword}":`, keywordError.message);
            // Continue with next keyword
            continue;
          }
        }
      } catch (error: any) {
        console.error(`   ❌ Error fetching volumes for batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        if (error.stack) {
          console.error(`   Stack trace:`, error.stack);
        }
        // Continue with next batch - don't fail entire discovery if one batch fails
        console.log(`   ⏭️  Continuing with next batch...`);
      }
    }

    console.log(`✅ [DISCOVER-NATIONAL-KEYWORDS] Discovered ${discoveredKeywords.size} keywords with sufficient volume`);

    // Merge similar keywords
    const keywordsArray = Array.from(discoveredKeywords.values());
    const mergedKeywords = mergeSimilarKeywords(keywordsArray);
    console.log(`🔄 [MERGE] Merged ${keywordsArray.length} keywords into ${mergedKeywords.length} unique keywords`);

    if (mergedKeywords.length === 0) {
      return res.status(200).json({
        message: 'No new national keywords found after filtering',
        added: 0,
        processed: 0,
      });
    }

    // Classify and save keywords
    let added = 0;
    const keywordClassifications = new Map<string, string>();

    for (const kw of mergedKeywords) {
      const keywordType = classifyKeyword(kw.keyword);
      keywordClassifications.set(kw.keyword, keywordType);

      try {
        await prisma.nicheKeyword.upsert({
          where: {
            nicheId_keyword: {
              nicheId: batch.nicheId,
              keyword: kw.keyword.trim(),
            },
          },
          create: {
            nicheId: batch.nicheId,
            keyword: kw.keyword.trim(),
            keywordType: keywordType,
            scope: 'national',
            nationalVolume: kw.volume,
            nationalKd: kw.competition ? Math.round(kw.competition * 100) : null,
            isActive: true,
          },
          update: {
            keywordType: keywordType,
            nationalVolume: kw.volume,
            nationalKd: kw.competition ? Math.round(kw.competition * 100) : null,
            scope: 'national',
          },
        });
        added++;
      } catch (error: any) {
        console.error(`   ❌ Error saving keyword "${kw.keyword}":`, error.message);
      }
    }

    console.log(`✅ [DISCOVER-NATIONAL-KEYWORDS] Successfully added ${added} national keywords`);

    // Missing keyword detection
    const allNicheKeywords = await prisma.nicheKeyword.findMany({
      where: {
        nicheId: batch.nicheId,
        isActive: true,
      },
    });

    const existingKeywords = new Set(
      allNicheKeywords.map((nk) => nk.keyword.toLowerCase())
    );

    const missingCandidates = detectMissingKeywords(
      mergedKeywords.map((kw) => ({ keyword: kw.keyword, volume: kw.volume })),
      existingKeywords
    );

    let missingAdded = 0;
    if (missingCandidates.length > 0) {
      console.log(`🔍 [MISSING-KEYWORDS] Found ${missingCandidates.length} missing high-value keywords`);
      
      for (const candidate of missingCandidates) {
        try {
          await prisma.nicheKeyword.upsert({
            where: {
              nicheId_keyword: {
                nicheId: batch.nicheId,
                keyword: candidate.keyword.trim(),
              },
            },
            create: {
              nicheId: batch.nicheId,
              keyword: candidate.keyword.trim(),
              keywordType: candidate.suggestedPageType === 'Service' ? 'money' : 'supporting',
              scope: 'national',
              nationalVolume: candidate.volume,
              isActive: true,
            },
            update: {
              keywordType: candidate.suggestedPageType === 'Service' ? 'money' : 'supporting',
              nationalVolume: candidate.volume,
              scope: 'national',
            },
          });
          missingAdded++;
          console.log(`   ✨ Added missing keyword: "${candidate.keyword}" (${candidate.patternType}, vol: ${candidate.volume})`);
        } catch (error: any) {
          console.error(`   ❌ Error saving missing keyword "${candidate.keyword}":`, error.message);
        }
      }
    }

    // Count by type
    const byType = {
      money: 0,
      supporting: 0,
      informational: 0,
      other: 0,
    };

    for (const type of keywordClassifications.values()) {
      if (type === 'money') byType.money++;
      else if (type === 'supporting') byType.supporting++;
      else if (type === 'informational') byType.informational++;
      else byType.other++;
    }

    return res.status(200).json({
      message: 'National keywords discovered successfully',
      added: added + missingAdded,
      processed: mergedKeywords.length,
      missingKeywordsAdded: missingAdded,
      byType,
    });
  } catch (error: any) {
    console.error('❌ [DISCOVER-NATIONAL-KEYWORDS] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to discover national keywords',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

