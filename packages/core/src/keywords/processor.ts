import {
  KeywordMetrics,
  KeywordTaxonomy,
  IntentWeights,
  CompetitorInfo,
} from '../types';
// These functions are from the old system and not used by V5000
// import {
//   calculateKeywordDifficulty,
//   calculateKeywordPriority,
//   classifyKeywordDifficulty,
// } from '../scoring';

/**
 * Process and prioritize keywords based on volume, difficulty, and intent
 */
export function prioritizeKeywords(
  keywords: Array<{
    keyword: string;
    volume: number;
    intent?: 'core' | 'transactional' | 'emergency' | 'adjacency';
    competitors?: CompetitorInfo[];
  }>,
  locationDifficulty: number,
  intentWeights: IntentWeights,
  maxKeywords: number = 10
): KeywordMetrics[] {
  const processed: KeywordMetrics[] = [];

  for (const kw of keywords) {
    // Calculate keyword difficulty (stub - old system)
    const competitors = kw.competitors || [];
    const keywordDifficulty = 50; // calculateKeywordDifficulty(competitors, locationDifficulty);

    // Calculate priority (stub - old system)
    const priority = kw.volume * (100 - keywordDifficulty) / 100; // calculateKeywordPriority(kw.volume, keywordDifficulty, kw.intent, intentWeights);

    processed.push({
      keyword: kw.keyword,
      volume: kw.volume,
      difficulty: keywordDifficulty,
      intent: kw.intent,
      priority,
    });
  }

  // Sort by priority (highest first) and take top N
  return processed
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, maxKeywords);
}

/**
 * Map keyword to intent bucket based on taxonomy
 */
export function getKeywordIntent(
  keyword: string,
  taxonomy: KeywordTaxonomy
): 'core' | 'transactional' | 'emergency' | 'adjacency' | undefined {
  if (taxonomy.core.includes(keyword)) return 'core';
  if (taxonomy.transactional.includes(keyword)) return 'transactional';
  if (taxonomy.emergency.includes(keyword)) return 'emergency';
  if (taxonomy.adjacency.includes(keyword)) return 'adjacency';
  return undefined;
}




