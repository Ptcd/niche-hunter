/**
 * V5000 Scoring Engine
 * 
 * Calculates difficulty and opportunity scores for rank-and-rent keyword analysis
 * using DataForSEO KD + local SERP heuristics
 */

import type { OrganicResult, LocalBusiness } from '../types/serp';

export interface DifficultyBreakdown {
  serpWeakness: number; // 0-100, higher = weaker SERP (easier)
  authorityProfile: number; // 0-100, higher = more authority (harder)
  localPackStrength: number; // 0-100, higher = stronger pack (harder)
  onpageCompetence: number; // 0-100, higher = more optimized (harder)
  serpDifficulty: number; // 100 - serpWeakness
  kdComponent: number; // kd * 0.6 (60% weight)
  serpComponent: number; // serpDifficulty * 0.25 (25% weight)
  packComponent: number; // packStrength * 0.15 (15% weight)
  onpageComponent: number; // onpage (not weighted when KD present)
  finalDifficulty: number; // 0-100, higher = harder
}

export interface OpportunityBreakdown {
  volume: number;
  cpc: number;
  leadValue: number;
  difficulty: number;
  cpcMultiplier: number; // 1.0 if missing, else min(1.3, max(0.9, cpc / 20))
  leadValueMultiplier: number; // leadValue / 50
  baseOpportunity: number; // volume * (100 - difficulty) / 100
  opportunity: number; // baseOpportunity * cpcMultiplier * leadValueMultiplier
}

/**
 * Calculate SERP weakness score
 * Weak SERP = easier to rank (0-100, higher = weaker/easier)
 */
export function calculateSerpWeakness(
  organic: OrganicResult[],
  service: string
): number {
  if (organic.length === 0) return 100; // No competition = easiest

  const directories = new Set([
    'yelp.com',
    'angi.com',
    'thumbtack.com',
    'homeadvisor.com',
    'bbb.org',
    'houzz.com',
    'angieslist.com',
    'porch.com',
    'taskrabbit.com',
    'nextdoor.com',
    'facebook.com',
    'linkedin.com',
  ]);

  // Subdomain patterns that indicate weak competition
  const subdomainPatterns = ['blog.', 'www.', 'm.', 'mobile.'];
  
  let homepages = 0;
  let directoryCount = 0;
  let offIntent = 0;
  let subdomainCount = 0;
  let thinContent = 0; // Short snippets indicate thin content

  const serviceWord = service.toLowerCase().split(' ')[0]; // First word of service
  const serviceWords = service.toLowerCase().split(' ');

  for (const result of organic.slice(0, 10)) {
    // Check if homepage or shallow page
    try {
      const url = new URL(result.url);
      const pathDepth = url.pathname.split('/').filter(Boolean).length;
      if (pathDepth <= 1) {
        homepages++;
      }
      
      // Check for subdomains (often easier to outrank)
      const hostname = url.hostname.toLowerCase();
      if (subdomainPatterns.some(pattern => hostname.startsWith(pattern))) {
        subdomainCount++;
      }
    } catch {
      // Invalid URL, skip
    }

    // Check if directory
    const domainLower = result.domain.toLowerCase();
    if (directories.has(domainLower)) {
      directoryCount++;
    }

    // Check if title contains service term
    const titleLower = (result.title || '').toLowerCase();
    const snippetLower = (result.snippet || '').toLowerCase();
    
    // Check for exact service match in title
    const hasServiceInTitle = serviceWords.some(sw => titleLower.includes(sw));
    if (!hasServiceInTitle) {
      offIntent++;
    }
    
    // Check for thin content (short snippets)
    if (snippetLower.length < 100) {
      thinContent++;
    }
  }

  const total = Math.min(organic.length, 10);
  const homepageRatio = homepages / total;
  const directoryRatio = directoryCount / total;
  const offIntentRatio = offIntent / total;
  const subdomainRatio = subdomainCount / total;
  const thinContentRatio = thinContent / total;

  // Weak SERP = many homepages, many directories, many off-intent pages, subdomains, thin content
  // Adjusted weights: homepages 30%, directories 25%, off-intent 20%, subdomains 15%, thin content 10%
  const weakness = 
    homepageRatio * 30 + 
    directoryRatio * 25 + 
    offIntentRatio * 20 + 
    subdomainRatio * 15 + 
    thinContentRatio * 10;

  return Math.min(100, Math.max(0, weakness));
}

/**
 * Calculate local pack strength score
 * Strong pack = harder to rank (0-100, higher = stronger/harder)
 */
export function calculateLocalPackStrength(
  locals: LocalBusiness[],
  service: string
): number {
  if (locals.length === 0) return 0; // No local pack = easiest

  const reviews = locals.map(b => b.reviewsCount || 0);
  const ratings = locals.map(b => b.rating || 0).filter(r => r > 0);

  const avgReviews = reviews.reduce((a, b) => a + b, 0) / reviews.length;
  const maxReviews = Math.max(...reviews, 0);
  const avgRating = ratings.length > 0
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : 3.0;

  // Category match heuristic
  const serviceWords = service.toLowerCase().split(' ');
  let matchCount = 0;
  for (const business of locals) {
    const cat = (business.category || '').toLowerCase();
    if (serviceWords.some(sw => cat.includes(sw))) {
      matchCount++;
    }
  }
  const categoryMatchFraction = matchCount / locals.length;

  // Calculate strength score
  let score =
    (Math.min(avgReviews, 400) / 400) * 40 + // avg reviews 0-40
    (Math.min(maxReviews, 800) / 800) * 30 + // max reviews 0-30
    ((Math.max(avgRating, 3.0) - 3.0) / 2.0) * 30; // rating 3.0-5.0 → 0-30

  // Reduce score if categories don't match (off-topic businesses = easier)
  if (categoryMatchFraction < 0.5) {
    score *= 0.6;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate on-page competence score
 * High competence = harder to rank (0-100, higher = more optimized/harder)
 */
export function calculateOnpageCompetence(
  organic: OrganicResult[],
  service: string,
  city: string
): number {
  if (organic.length === 0) return 0;

  const serviceLower = service.toLowerCase();
  const cityLower = city.toLowerCase();

  let exactMatch = 0;
  let cityHit = 0;

  for (const result of organic.slice(0, 10)) {
    const title = (result.title || '').toLowerCase();
    if (title.includes(serviceLower) && title.includes(cityLower)) {
      exactMatch++;
    }
    if (title.includes(cityLower)) {
      cityHit++;
    }
  }

  const total = Math.min(organic.length, 10);
  const exactRatio = exactMatch / total;
  const cityRatio = cityHit / total;

  // Everyone dialed in = high competence (harder)
  return exactRatio * 70 + cityRatio * 30;
}

/**
 * Calculate final difficulty score
 * Combines DataForSEO KD with local SERP heuristics
 */
export function calculateFinalDifficulty(
  kd: number | null, // DataForSEO KD (0-100), null if not available
  serpWeakness: number,
  packStrength: number,
  onpage: number
): DifficultyBreakdown {
  // Convert serpWeakness to serpDifficulty (higher = harder)
  const serpDifficulty = 100 - serpWeakness;

  // If KD is not available, use SERP data only
  // Weight SERP more heavily when KD is missing
  let finalDifficulty: number;
  let kdComponent: number;
  let serpComponent: number;
  let packComponent: number;
  let onpageComponent: number;

  if (kd !== null && kd !== undefined) {
    // Full calculation with KD
    // Weights: KD 65%, SERP 20%, Local Pack 5%, On-page 10%
    // Reduced pack weight (pack != organic difficulty), added on-page (title optimization matters)
    kdComponent = kd * 0.65;
    serpComponent = serpDifficulty * 0.20;
    packComponent = packStrength * 0.05; // Reduced - pack doesn't directly affect organic rankings
    onpageComponent = onpage * 0.10; // Added - title optimization matters for local SEO
    finalDifficulty = kdComponent + serpComponent + packComponent + onpageComponent;
  } else {
    // No KD - use SERP data only with adjusted weights
    kdComponent = 0;
    serpComponent = serpDifficulty * 0.55; // SERP becomes primary when KD missing
    packComponent = packStrength * 0.15; // Reduced
    onpageComponent = onpage * 0.30; // Increased when no KD - on-page is more important
    finalDifficulty = serpComponent + packComponent + onpageComponent;
  }

  return {
    serpWeakness,
    authorityProfile: 0, // Not used in V5000 (replaced by KD)
    localPackStrength: packStrength,
    onpageCompetence: onpage,
    serpDifficulty,
    kdComponent,
    serpComponent,
    packComponent,
    onpageComponent,
    finalDifficulty: Math.min(100, Math.max(0, finalDifficulty)),
  };
}

/**
 * Get CTR (Click-Through Rate) based on difficulty score
 * Difficulty determines expected ranking position after 6 months
 */
export function getCTRFromDifficulty(diff: number): number {
  if (diff < 20) return 0.22;   // Rank 1–2
  if (diff < 35) return 0.12;   // Rank 2–3
  if (diff < 50) return 0.07;   // Rank 3–5
  if (diff < 60) return 0.045;  // Rank 5–7
  if (diff < 75) return 0.025;  // Rank 7–12
  return 0.005;                 // Page 2+
}

/**
 * Calculate projected monthly revenue
 * Returns revenue, visitors, and calls for display
 */
export interface RevenueResult {
  monthlyRevenue: number;
  visitors: number;
  calls: number;
}

export interface RevenueInputs {
  totalVolume: number;
  avgDifficulty: number;
  leadValue: number;
  conversionRate: number; // No default - caller must pass
}

export function calculateProjectedRevenue({
  totalVolume,
  avgDifficulty,
  leadValue,
  conversionRate,
}: RevenueInputs): RevenueResult {
  const ctr = getCTRFromDifficulty(avgDifficulty);
  const visitors = totalVolume * ctr;
  const calls = visitors * conversionRate;
  const monthlyRevenue = calls * leadValue;

  return {
    monthlyRevenue: Math.round(monthlyRevenue),
    visitors: Math.round(visitors),
    calls: Math.round(calls),
  };
}

/**
 * Calculate ROI metrics
 * Returns net monthly profit, break-even time, and 6-month profit
 */
export interface ROIResult {
  netMonthly: number;
  breakEven: number | null; // null = never profitable
  profit6: number;
}

export function calculateROI(monthlyRevenue: number): ROIResult {
  const buildCost = 300;
  const monthlyCost = 50;
  const netMonthly = monthlyRevenue - monthlyCost;

  let breakEven: number | null;
  if (netMonthly <= 0) {
    breakEven = null; // never breaks even
  } else {
    breakEven = Math.round((buildCost / netMonthly) * 10) / 10; // 0.1 months precision
  }

  const profit6 = (netMonthly * 6) - buildCost;

  return {
    netMonthly: Math.round(netMonthly),
    breakEven,
    profit6: Math.round(profit6),
  };
}

/**
 * Get recommendation based on projected revenue and difficulty
 */
export type Recommendation = "build" | "consider" | "maybe" | "skip";

export function getRecommendation({
  monthlyRevenue,
  avgDifficulty,
  easyKeywordCount,
  totalVolume,
}: {
  monthlyRevenue: number;
  avgDifficulty: number;
  easyKeywordCount: number;
  totalVolume: number;
}): Recommendation {
  // Skip trivial markets
  if (monthlyRevenue < 200 || totalVolume < 20) {
    return "skip";
  }

  // Build: strong revenue + rankable keywords
  if (monthlyRevenue >= 800 && easyKeywordCount >= 2) {
    return "build";
  }

  // Consider: moderate revenue + moderate difficulty
  if (monthlyRevenue >= 400 && avgDifficulty <= 55) {
    return "consider";
  }

  // Maybe: at least mildly profitable
  if (monthlyRevenue >= 200) {
    return "maybe";
  }

  return "skip";
}

/**
 * Calculate confidence level for revenue projection
 */
export type Confidence = "high" | "medium" | "low";

export function calculateConfidence(
  keywords: Array<{ difficulty: number; volume: number; kdAvailable?: boolean }>,
  avgDifficulty: number,
  totalVolume: number,
): Confidence {
  const keywordCount = keywords.length || 1;
  const kdAvailableCount = keywords.filter(k => k.kdAvailable !== false).length;
  const kdCoverage = kdAvailableCount / keywordCount;

  if (kdCoverage > 0.7 && totalVolume >= 100 && avgDifficulty <= 60) {
    return "high";
  }
  if (kdCoverage > 0.4 && totalVolume >= 50) {
    return "medium";
  }
  return "low";
}

/**
 * @deprecated Use calculateProjectedRevenue instead
 * Old opportunity score calculation (kept for backward compatibility during migration)
 */
export function calculateOpportunity(
  volume: number,
  cpc: number,
  leadValue: number,
  difficulty: number
): OpportunityBreakdown {
  // CPC multiplier: light tiebreaker only (±30% range, not ±300%)
  // Missing CPC = neutral 1.0x (no penalty)
  // $20 CPC = neutral 1.0x
  // $40+ CPC = max boost 1.3x
  // $18 CPC = min 0.9x
  let cpcMultiplier: number;
  if (!cpc || cpc <= 0) {
    cpcMultiplier = 1.0; // neutral when missing - no penalty
  } else {
    cpcMultiplier = Math.min(1.3, Math.max(0.9, cpc / 20));
  }

  // Lead value multiplier: normalize to $50 baseline
  const leadValueMultiplier = leadValue / 50;

  // Base opportunity: volume adjusted by difficulty
  const baseOpportunity = volume * (100 - difficulty) / 100;

  // Final opportunity with multipliers
  const opportunity = baseOpportunity * cpcMultiplier * leadValueMultiplier;

  return {
    volume,
    cpc,
    leadValue,
    difficulty,
    cpcMultiplier,
    leadValueMultiplier,
    baseOpportunity,
    opportunity,
  };
}


