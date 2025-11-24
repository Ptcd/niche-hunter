/**
 * Keyword Classifier
 * 
 * Classifies keywords by their business intent and type:
 * - Money Keywords: High commercial intent, ready to buy
 * - Supporting Keywords: Research/comparison phase
 * - Informational Keywords: Educational, how-to content
 * - Brand Keywords: Brand-specific searches
 * - Local Keywords: Location-specific modifiers
 * - Other: Fallback category
 */

export type KeywordType = 'money' | 'supporting' | 'informational' | 'brand' | 'local' | 'other';

/**
 * Classify a keyword by analyzing its patterns and intent
 */
export function classifyKeyword(keyword: string): KeywordType {
  const lowerKeyword = keyword.toLowerCase().trim();
  
  // Money Keywords - High commercial intent, ready to buy
  const moneyPatterns = [
    /\b(near me|nearby|local)\b/i,
    /\b(repair|fix|service|services|install|installation|replacement|replace)\b/i,
    /\b(company|contractor|professional|pro|technician|specialist|expert)\b/i,
    /\b(emergency|urgent|24\/7|same day|today)\b/i,
    /\b(cost|price|quote|estimate|affordable|cheap|discount)\b/i,
    /\b(buy|purchase|order|book|schedule|appointment|call|contact)\b/i,
    /\b(licensed|insured|certified|bonded|guaranteed|warranty)\b/i,
  ];
  
  // Supporting Keywords - Research/comparison phase
  const supportingPatterns = [
    /\b(best|top|rated|review|reviews|compare|comparison|vs|versus)\b/i,
    /\b(how much|cost|price|pricing|affordable|expensive|cheap)\b/i,
    /\b(which|what|recommend|recommendation|suggest)\b/i,
    /\b(quality|reliable|trusted|trustworthy|reputable)\b/i,
  ];
  
  // Informational Keywords - Educational content
  const informationalPatterns = [
    /\b(how to|how do|how can|how does|how is)\b/i,
    /\b(what is|what are|what does|what do|what can)\b/i,
    /\b(why|when|where|who)\b/i,
    /\b(guide|tutorial|tips|advice|help|learn|explain|explanation)\b/i,
    /\b(diy|do it yourself|step by step|instructions)\b/i,
    /\b(signs|symptoms|problems|issues|causes|solutions)\b/i,
    // Enhanced patterns
    /\b(can|should|will|does|do)\b/i, // FAQ patterns
    /\b(troubleshoot|troubleshooting|fix|solve|diagnose)\b/i, // Problem/solution
    /\b(checklist|check list)\b/i,
  ];
  
  // Brand Keywords - Brand-specific searches
  const brandPatterns = [
    /\b(brand|manufacturer|model|make)\b/i,
    // Common brand names (add more as needed)
    /\b(lennox|carrier|trane|rheem|goodman|york|american standard|daikin)\b/i,
  ];
  
  // Local Keywords - Location-specific (but not "near me")
  const localPatterns = [
    /\b(in|at|for)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?\b/, // "in City" or "in City State"
  ];
  
  // Check for money keywords first (highest priority)
  for (const pattern of moneyPatterns) {
    if (pattern.test(lowerKeyword)) {
      return 'money';
    }
  }
  
  // Check for supporting keywords
  for (const pattern of supportingPatterns) {
    if (pattern.test(lowerKeyword)) {
      return 'supporting';
    }
  }
  
  // Check for informational keywords
  for (const pattern of informationalPatterns) {
    if (pattern.test(lowerKeyword)) {
      return 'informational';
    }
  }
  
  // Check for brand keywords
  for (const pattern of brandPatterns) {
    if (pattern.test(lowerKeyword)) {
      return 'brand';
    }
  }
  
  // Check for local keywords (but exclude if already matched money)
  for (const pattern of localPatterns) {
    if (pattern.test(keyword)) {
      return 'local';
    }
  }
  
  // Default to other
  return 'other';
}

/**
 * Get human-readable label for keyword type
 */
export function getKeywordTypeLabel(type: KeywordType | null | undefined): string {
  if (!type) return 'Other';
  
  const labels: Record<KeywordType, string> = {
    money: 'Money',
    supporting: 'Supporting',
    informational: 'Informational',
    brand: 'Brand',
    local: 'Local',
    other: 'Other',
  };
  
  return labels[type] || 'Other';
}

/**
 * Classify multiple keywords at once
 */
export function classifyKeywords(keywords: string[]): Map<string, KeywordType> {
  const classifications = new Map<string, KeywordType>();
  
  for (const keyword of keywords) {
    classifications.set(keyword, classifyKeyword(keyword));
  }
  
  return classifications;
}

export type KeywordScope = 'local' | 'national';
export type SuggestedPageType = 'homepage' | 'service' | 'blog' | 'faq' | 'location';

export interface KeywordClassification {
  type: KeywordType;
  scope: KeywordScope;
  suggestedPageType: SuggestedPageType;
}

/**
 * Classify keyword with scope detection and suggested page type
 */
export function classifyKeywordWithScope(keyword: string): KeywordClassification {
  const lowerKeyword = keyword.toLowerCase().trim();
  const type = classifyKeyword(keyword);
  
  // Detect scope: local vs national
  const hasLocationModifier = /\b(near me|nearby|local|in [a-z]+|near [a-z]+|around [a-z]+)\b/i.test(keyword);
  const hasCityName = /\b(in|at|for)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?\b/.test(keyword);
  const scope: KeywordScope = (hasLocationModifier || hasCityName) ? 'local' : 'national';
  
  // Determine suggested page type based on keyword type and patterns
  let suggestedPageType: SuggestedPageType = 'service';
  
  if (type === 'informational') {
    // FAQ patterns
    if (/\b(can|should|will|does|do|why|when|where)\b/i.test(lowerKeyword)) {
      suggestedPageType = 'faq';
    }
    // Blog patterns
    else if (/\b(how to|guide|tutorial|tips|checklist|signs|symptoms)\b/i.test(lowerKeyword)) {
      suggestedPageType = 'blog';
    }
    else {
      suggestedPageType = 'blog';
    }
  } else if (type === 'money') {
    // Location-specific money keywords -> location page
    if (scope === 'local') {
      suggestedPageType = 'location';
    } else {
      suggestedPageType = 'service';
    }
  } else if (type === 'supporting') {
    // Comparison/review keywords -> blog
    if (/\b(vs|versus|compare|comparison|review|reviews)\b/i.test(lowerKeyword)) {
      suggestedPageType = 'blog';
    } else {
      suggestedPageType = 'service';
    }
  } else if (lowerKeyword.split(/\s+/).length <= 2) {
    // Short, high-intent keywords -> homepage or service
    // (type is already narrowed to 'brand' | 'local' | 'other' at this point)
    suggestedPageType = scope === 'local' ? 'location' : 'homepage';
  }
  
  return {
    type,
    scope,
    suggestedPageType,
  };
}


