/**
 * Missing Keyword Detector
 * 
 * Detects high-value keyword patterns that should be added as national keywords
 * but may have been missed during initial discovery.
 */

export interface KeywordPattern {
  pattern: RegExp;
  type: 'emergency' | 'cost' | 'best';
  minVolume: number;
  pageType: 'Service' | 'Blog';
}

export interface MissingKeywordCandidate {
  keyword: string;
  volume: number;
  patternType: 'emergency' | 'cost' | 'best';
  suggestedPageType: 'Service' | 'Blog';
}

export const KEYWORD_PATTERNS: KeywordPattern[] = [
  {
    pattern: /emergency/i,
    type: 'emergency',
    minVolume: 100,
    pageType: 'Service',
  },
  {
    pattern: /24[\s-]hour|24\/7/i,
    type: 'emergency',
    minVolume: 100,
    pageType: 'Service',
  },
  {
    pattern: /cost|price|pricing/i,
    type: 'cost',
    minVolume: 100,
    pageType: 'Blog',
  },
  {
    pattern: /^best\s/i,
    type: 'best',
    minVolume: 50,
    pageType: 'Blog',
  },
  {
    pattern: /^top\s/i,
    type: 'best',
    minVolume: 50,
    pageType: 'Blog',
  },
];

/**
 * Detect missing keywords from national keyword list
 * 
 * @param nationalKeywords - Array of discovered national keywords with volumes
 * @param existingKeywords - Set of existing keyword strings (lowercase) to avoid duplicates
 * @returns Array of missing keyword candidates
 */
export function detectMissingKeywords(
  nationalKeywords: Array<{ keyword: string; volume: number }>,
  existingKeywords: Set<string>
): MissingKeywordCandidate[] {
  const candidates: MissingKeywordCandidate[] = [];

  for (const nk of nationalKeywords) {
    const keywordLower = nk.keyword.toLowerCase();

    // Skip if already exists
    if (existingKeywords.has(keywordLower)) continue;

    // Check patterns (first match wins)
    for (const { pattern, type, minVolume, pageType } of KEYWORD_PATTERNS) {
      if (pattern.test(nk.keyword) && nk.volume >= minVolume) {
        candidates.push({
          keyword: nk.keyword,
          volume: nk.volume,
          patternType: type,
          suggestedPageType: pageType,
        });
        break; // Only match first pattern
      }
    }
  }

  return candidates;
}

