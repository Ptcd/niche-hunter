/**
 * Competitive Edge Score Components (C1-C4)
 * 
 * Evaluates how well the page stacks up against top 10 competitors
 * Weights: C1=40, C2=30, C3=15, C4=15
 */

import { CompetitiveInputs, CompetitiveScoreComponents, PageAuditInput } from './types';

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map a ratio to 0-100 score
 * 1.0 = 80, 0.5 = 40, 0.25 = 20, 1.5+ = 95+
 */
function mapRatioToScore(ratio: number): number {
  if (ratio >= 1.5) return 95;
  if (ratio >= 1.2) return 90;
  if (ratio >= 1.0) return 80;
  if (ratio >= 0.8) return 70;
  if (ratio >= 0.6) return 55;
  if (ratio >= 0.5) return 40;
  if (ratio >= 0.4) return 30;
  if (ratio >= 0.25) return 20;
  return Math.max(0, ratio * 80);
}

/**
 * C1 - Link Authority Gap (40 pts)
 * Compares DA/PA/RD vs top 3-5 competitors
 */
export function scoreC1Links(
  competitive: CompetitiveInputs
): number {
  if (!competitive.serpResultsTop10 || competitive.serpResultsTop10.length === 0) {
    return 50; // No competitive data, neutral score
  }

  // Get top 5 results for comparison
  const top5 = competitive.serpResultsTop10.slice(0, 5);

  // Calculate averages
  const validDA = top5
    .map(r => r.domainAuthority)
    .filter((da): da is number => da !== undefined && da !== null);
  const validPA = top5
    .map(r => r.pageAuthority)
    .filter((pa): pa is number => pa !== undefined && pa !== null);
  const validRD = top5
    .map(r => r.referringDomains)
    .filter((rd): rd is number => rd !== undefined && rd !== null);

  if (validDA.length === 0 && validPA.length === 0 && validRD.length === 0) {
    return 50; // No authority data available
  }

  const avgDA = validDA.length > 0 
    ? validDA.reduce((a, b) => a + b, 0) / validDA.length 
    : 0;
  const avgPA = validPA.length > 0 
    ? validPA.reduce((a, b) => a + b, 0) / validPA.length 
    : 0;
  const avgRD = validRD.length > 0 
    ? validRD.reduce((a, b) => a + b, 0) / validRD.length 
    : 0;

  // Get our metrics
  const ourDA = competitive.thisDomainAuthority || 0;
  const ourPA = competitive.thisPageAuthority || 0;
  const ourRD = competitive.thisReferringDomains || 0;

  // Calculate ratios
  const domainRatio = ourDA / Math.max(avgDA, 1);
  const pageRatio = ourPA / Math.max(avgPA, 1);
  const rdRatio = ourRD / Math.max(avgRD, 1);

  // Clamp ratios
  const clampedDomainRatio = clamp(domainRatio, 0, 2);
  const clampedPageRatio = clamp(pageRatio, 0, 2);
  const clampedRDRatio = clamp(rdRatio, 0, 2);

  // Weighted average: DA 40%, PA 30%, RD 30%
  const weightedRatio = 
    clampedDomainRatio * 0.4 +
    clampedPageRatio * 0.3 +
    clampedRDRatio * 0.3;

  return Math.round(mapRatioToScore(weightedRatio));
}

/**
 * C2 - Content Depth & Coverage vs Top 10 (30 pts)
 * Compares word count and topic coverage
 */
export function scoreC2Content(
  html: string,
  competitive: CompetitiveInputs
): number {
  if (!competitive.serpResultsTop10 || competitive.serpResultsTop10.length === 0) {
    return 50; // No competitive data
  }

  // Extract our word count
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyText = bodyMatch ? bodyMatch[1]
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() : '';
  
  const ourWordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  // Get competitor word counts
  const competitorWordCounts = competitive.serpResultsTop10
    .slice(0, 5) // Top 5
    .map(r => r.wordCountEstimate || 0)
    .filter(wc => wc > 0);

  if (competitorWordCounts.length === 0) {
    // Fallback: estimate from title/description
    return 50; // Can't compare without data
  }

  const avgCompetitorWords = competitorWordCounts.reduce((a, b) => a + b, 0) / competitorWordCounts.length;

  // Length ratio
  const lengthRatio = ourWordCount / Math.max(avgCompetitorWords, 1);
  const clampedLengthRatio = clamp(lengthRatio, 0.3, 2.0);
  const lengthScore = mapRatioToScore(clampedLengthRatio);

  // Topic coverage (simplified: check for common sections)
  const expectedTopics = [
    'service',
    'area',
    'quote',
    'contact',
    'about',
    'faq',
    'testimonial',
    'review',
  ];

  const htmlLower = html.toLowerCase();
  const topicsFound = expectedTopics.filter(topic => 
    htmlLower.includes(topic) || 
    htmlLower.includes(topic + 's') ||
    htmlLower.includes(topic + 'ing')
  ).length;

  const topicCoverage = topicsFound / expectedTopics.length;
  const topicScore = topicCoverage * 100;

  // Combine: 50% length, 50% topic coverage
  const combinedScore = (lengthScore * 0.5) + (topicScore * 0.5);

  return Math.round(combinedScore);
}

/**
 * C3 - SERP Feature Gap (15 pts)
 * Checks for review stars, FAQ snippets, video thumbnails
 */
export function scoreC3SerpFeatures(
  html: string,
  competitive: CompetitiveInputs
): number {
  if (!competitive.serpResultsTop10 || competitive.serpResultsTop10.length === 0) {
    return 70; // Baseline if no SERP data
  }

  // Count features in top 10
  const top10 = competitive.serpResultsTop10;
  const withReviews = top10.filter(r => r.hasReviewStars).length;
  const withFAQ = top10.filter(r => r.hasFAQSnippet).length;
  const withVideo = top10.filter(r => r.hasVideoThumbnail).length;

  const reviewPercent = withReviews / top10.length;
  const faqPercent = withFAQ / top10.length;
  const videoPercent = withVideo / top10.length;

  // Determine what's "important" (40%+ have it)
  const needReviews = reviewPercent >= 0.4;
  const needFAQ = faqPercent >= 0.4;
  const needVideo = videoPercent >= 0.4;

  // Check our page
  const htmlLower = html.toLowerCase();
  const hasReviewSchema = /"@type"\s*:\s*"Review"|"@type"\s*:\s*"AggregateRating"|rating|stars/i.test(html);
  const hasFAQSection = /faq|frequently.*asked|question.*answer/i.test(htmlLower);
  const hasFAQSchema = /"@type"\s*:\s*"FAQPage"/i.test(html);
  const hasVideo = /youtube|vimeo|<video|iframe.*video/i.test(htmlLower);

  let score = 100;
  let deductions = 0;

  if (needReviews && !hasReviewSchema) {
    score -= 30;
    deductions++;
  }
  if (needFAQ && !hasFAQSection && !hasFAQSchema) {
    score -= 30;
    deductions++;
  }
  if (needVideo && !hasVideo) {
    score -= 20;
    deductions++;
  }

  // If no dominant features, baseline score
  if (!needReviews && !needFAQ && !needVideo) {
    return 70;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * C4 - Brand/Review Presence (15 pts)
 * Compares review count and trust signals vs competitors
 */
export function scoreC4BrandReviews(
  html: string,
  competitive: CompetitiveInputs
): number {
  // This is simplified - in production you'd fetch actual review counts
  // For now, we'll use onsite trust signals from Q6 logic

  const htmlLower = html.toLowerCase();
  
  // Onsite trust score (0-100)
  let onsiteScore = 0;

  // Testimonials/reviews
  const hasTestimonials = /testimonial|review|customer.*says|client.*says/i.test(html);
  const hasStars = /★|⭐|rating|stars|4\.\d+\/5|5\s*star/i.test(html);
  const hasSchemaReview = /"@type"\s*:\s*"Review"|"@type"\s*:\s*"AggregateRating"/i.test(html);
  
  if (hasTestimonials && (hasStars || hasSchemaReview)) {
    onsiteScore += 50;
  } else if (hasTestimonials || hasStars) {
    onsiteScore += 30;
  }

  // Badges
  const hasBadges = /licensed|insured|bbb|accredited|certified|award/i.test(htmlLower);
  if (hasBadges) {
    onsiteScore += 30;
  }

  // Guarantees
  const hasGuarantee = /guarantee|warranty|satisfaction|money.*back/i.test(htmlLower);
  if (hasGuarantee) {
    onsiteScore += 20;
  }

  // If we had external review data, we'd compare here
  // For now, just use onsite score scaled to 0-100
  return Math.min(100, onsiteScore);
}

/**
 * Calculate overall competitive edge score
 */
export function calculateCompetitiveScore(
  html: string,
  input: PageAuditInput,
  competitive: CompetitiveInputs
): { score: number; components: CompetitiveScoreComponents } {
  const components: CompetitiveScoreComponents = {
    C1_links: scoreC1Links(competitive),
    C2_content_vs_comp: scoreC2Content(html, competitive),
    C3_serp_features: scoreC3SerpFeatures(html, competitive),
    C4_brand_reviews: scoreC4BrandReviews(html, competitive),
  };

  // Weighted average
  const weights = {
    C1_links: 40,
    C2_content_vs_comp: 30,
    C3_serp_features: 15,
    C4_brand_reviews: 15,
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const weightedSum = 
    components.C1_links * weights.C1_links +
    components.C2_content_vs_comp * weights.C2_content_vs_comp +
    components.C3_serp_features * weights.C3_serp_features +
    components.C4_brand_reviews * weights.C4_brand_reviews;

  const score = Math.round(weightedSum / totalWeight);

  return { score, components };
}

