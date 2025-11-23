import { LeadEstimate, KeywordMetrics, IntentWeights } from '../types';

/**
 * CTR (Click-Through Rate) by position based on industry averages
 */
const CTR_BY_POSITION: Record<number, number> = {
  1: 0.30,  // 30% CTR for position #1
  2: 0.15,  // 15% CTR for position #2
  3: 0.10,  // 10% CTR for position #3
  4: 0.05,  // 5% CTR for position #4
  5: 0.04,  // 4% CTR for position #5
  6: 0.03,  // 3% CTR for position #6
  7: 0.025, // 2.5% CTR for position #7
  8: 0.02,  // 2% CTR for position #8
  9: 0.015, // 1.5% CTR for position #9
  10: 0.01, // 1% CTR for position #10
};

/**
 * Intent-based conversion rates (site to lead)
 * Calibrated for local service businesses where search intent is very high.
 * People searching for plumbers, electricians, etc. typically need help immediately.
 */
const INTENT_CONVERSION_RATES: Record<string, number> = {
  transactional: 0.10, // 10% for transactional keywords (e.g., "plumbing services", "licensed plumber")
  emergency: 0.15,      // 15% for emergency keywords (e.g., "emergency plumber", "burst pipe")
  core: 0.08,           // 8% for core keywords (e.g., "plumber", "electrician", "roofer")
  adjacency: 0.04,      // 4% for adjacency keywords (e.g., "drain cleaning", "water heater")
};

/**
 * Default conversion rate if intent is not specified
 */
const DEFAULT_CONVERSION_RATE = 0.08; // 8% (default to core rate for local services)

/**
 * Get CTR for a given position
 */
function getCTRForPosition(position: number): number {
  if (position <= 0) return 0;
  if (position > 10) return 0.01; // Very low CTR for positions beyond 10
  return CTR_BY_POSITION[position] || 0.01;
}

/**
 * Get conversion rate based on keyword intent
 */
function getConversionRate(intent?: string): number {
  if (!intent) return DEFAULT_CONVERSION_RATE;
  return INTENT_CONVERSION_RATES[intent] || DEFAULT_CONVERSION_RATE;
}

/**
 * Calculate estimated monthly clicks for a keyword at a given position
 */
export function estimateMonthlyClicks(
  volume: number,
  position: number
): number {
  const ctr = getCTRForPosition(position);
  return Math.round(volume * ctr);
}

/**
 * Calculate estimated monthly leads for a keyword at a given position
 */
export function estimateMonthlyLeads(
  volume: number,
  position: number,
  intent?: string
): number {
  const clicks = estimateMonthlyClicks(volume, position);
  const conversionRate = getConversionRate(intent);
  return Math.round(clicks * conversionRate);
}

/**
 * Calculate lead estimates for all three scenarios (conservative, realistic, optimistic)
 */
export function calculateLeadEstimates(
  volume: number,
  intent?: string,
  payout: number = 0
): LeadEstimate {
  // Conservative: Rank #5 (4% CTR)
  const conservativeClicks = estimateMonthlyClicks(volume, 5);
  const conservativeLeads = estimateMonthlyLeads(volume, 5, intent);
  const conservativeValue = conservativeLeads * payout;

  // Realistic: Rank #3 (10% CTR)
  const realisticClicks = estimateMonthlyClicks(volume, 3);
  const realisticLeads = estimateMonthlyLeads(volume, 3, intent);
  const realisticValue = realisticLeads * payout;

  // Optimistic: Rank #1 (30% CTR)
  const optimisticClicks = estimateMonthlyClicks(volume, 1);
  const optimisticLeads = estimateMonthlyLeads(volume, 1, intent);
  const optimisticValue = optimisticLeads * payout;

  return {
    conservative: conservativeLeads,
    realistic: realisticLeads,
    optimistic: optimisticLeads,
    monthlyValue: {
      conservative: conservativeValue,
      realistic: realisticValue,
      optimistic: optimisticValue,
    },
  };
}

/**
 * Calculate lead estimates for multiple keywords (aggregated)
 */
export function calculateAggregateLeadEstimates(
  keywords: KeywordMetrics[],
  payout: number = 0
): LeadEstimate {
  let conservativeTotal = 0;
  let realisticTotal = 0;
  let optimisticTotal = 0;
  let conservativeValueTotal = 0;
  let realisticValueTotal = 0;
  let optimisticValueTotal = 0;

  for (const kw of keywords) {
    const estimates = calculateLeadEstimates(kw.volume, kw.intent, payout);
    conservativeTotal += estimates.conservative;
    realisticTotal += estimates.realistic;
    optimisticTotal += estimates.optimistic;
    conservativeValueTotal += estimates.monthlyValue.conservative;
    realisticValueTotal += estimates.monthlyValue.realistic;
    optimisticValueTotal += estimates.monthlyValue.optimistic;
  }

  return {
    conservative: Math.round(conservativeTotal),
    realistic: Math.round(realisticTotal),
    optimistic: Math.round(optimisticTotal),
    monthlyValue: {
      conservative: Math.round(conservativeValueTotal * 100) / 100,
      realistic: Math.round(realisticValueTotal * 100) / 100,
      optimistic: Math.round(optimisticValueTotal * 100) / 100,
    },
  };
}

/**
 * Estimate time to rank based on difficulty and competition
 */
export function estimateTimeToRank(
  difficulty: number,
  competitionStrength: number = 0
): string {
  // Combine difficulty (0-1) and competition (0-10) into overall score
  const overallDifficulty = (difficulty * 100 + competitionStrength * 10) / 2;

  if (overallDifficulty <= 30) {
    return '2-4 months'; // Easy market
  } else if (overallDifficulty <= 60) {
    return '4-8 months'; // Medium market
  } else {
    return '8-16 months'; // Hard market
  }
}

