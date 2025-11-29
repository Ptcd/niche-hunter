/**
 * Quality Score Components (Q1-Q7)
 * 
 * Evaluates page quality in isolation (0-100)
 * Weights: Q1=20, Q2=15, Q3=15, Q4=10, Q5=15, Q6=15, Q7=10
 */

import { PageAuditInput, QualityScoreComponents } from './types';

/**
 * Extract visible text from HTML
 */
function extractVisibleText(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return '';
  
  return bodyMatch[1]
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract text from first N words
 */
function getFirstNWords(text: string, n: number): string {
  return text.split(/\s+/).slice(0, n).join(' ');
}

/**
 * Q1 - Intent & Topic Relevance (20 pts)
 * Checks: Title intent, H1 intent, above-fold confirmation, query fulfilment
 */
export function scoreQ1Intent(
  html: string,
  input: PageAuditInput
): number {
  let score = 0;

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : '';

  // Extract H1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const h1 = h1Match ? h1Match[1] : '';

  // Extract visible text
  const visibleText = extractVisibleText(html);
  const first150Words = getFirstNWords(visibleText, 150);

  const serviceLower = input.primaryService.toLowerCase();
  const cityLower = input.targetCity.toLowerCase();
  const keywordLower = input.primaryKeyword.toLowerCase();

  // Title intent match (0-40)
  const titleLower = title.toLowerCase();
  if (titleLower.includes(keywordLower) || 
      (titleLower.includes(serviceLower) && titleLower.includes(cityLower))) {
    score += 40;
  } else if (titleLower.includes(serviceLower) || titleLower.includes(cityLower)) {
    score += 15;
  }

  // H1 intent match (0-25)
  const h1Lower = h1.toLowerCase();
  if (h1Lower.includes(keywordLower) || 
      (h1Lower.includes(serviceLower) && h1Lower.includes(cityLower))) {
    score += 25;
  } else if (h1Lower.includes(serviceLower) || h1Lower.includes(cityLower)) {
    score += 12;
  }

  // Above-the-fold confirmation (0-20)
  const first150Lower = first150Words.toLowerCase();
  if (first150Lower.includes(serviceLower) && first150Lower.includes(cityLower)) {
    score += 20;
  } else if (first150Lower.includes(serviceLower) || first150Lower.includes(cityLower)) {
    score += 10;
  }

  // Query fulfilment (0-15)
  // Check for key sections
  const hasServices = /services|what we do|our services/i.test(html);
  const hasServiceArea = /service area|areas we serve|where we work|locations/i.test(html);
  const hasCTA = /get.*quote|contact|call.*today|free.*estimate|request.*quote/i.test(html);

  if (hasServices && hasServiceArea && hasCTA) {
    score += 15;
  } else if ((hasServices && hasServiceArea) || (hasServices && hasCTA)) {
    score += 10;
  } else if (hasServices || hasServiceArea || hasCTA) {
    score += 5;
  }

  return Math.min(100, score);
}

/**
 * Q2 - Keyword & On-Page Optimization (15 pts)
 * Checks: Keyword placement, variations, density
 */
export function scoreQ2OnPage(
  html: string,
  input: PageAuditInput
): number {
  const visibleText = extractVisibleText(html);
  const wordCount = visibleText.split(/\s+/).filter(w => w.length > 0).length;

  if (wordCount === 0) return 0;

  let placementScore = 0;
  let variationScore = 0;

  const keywordLower = input.primaryKeyword.toLowerCase();
  const serviceLower = input.primaryService.toLowerCase();
  const cityLower = input.targetCity.toLowerCase();

  // Extract elements (allow nested content)
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].toLowerCase() : '';
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').toLowerCase() : '';
  const urlLower = input.url.toLowerCase();
  const h2h3Matches = html.match(/<h[23][^>]*>[\s\S]*?<\/h[23]>/gi) || [];
  const h2h3Text = h2h3Matches.map(m => m.replace(/<[^>]+>/g, '').toLowerCase()).join(' ');

  // Placement scoring (0-70)
  if (title.includes(keywordLower)) placementScore += 20;
  if (h1.includes(keywordLower)) placementScore += 20;
  if (urlLower.includes(serviceLower.replace(/\s+/g, '-')) || urlLower.includes(cityLower.replace(/\s+/g, '-'))) {
    placementScore += 15;
  }
  
  // First 10% of content
  const first10Percent = getFirstNWords(visibleText, Math.floor(wordCount * 0.1));
  if (first10Percent.toLowerCase().includes(keywordLower)) {
    placementScore += 10;
  }

  // Subheadings
  if (h2h3Text.includes(keywordLower) || h2h3Text.includes(serviceLower)) {
    placementScore += 5;
  }

  // Variation scoring (0-30)
  // Check for service synonyms and location variations
  const serviceVariations = [
    serviceLower,
    serviceLower.replace(/\s+/g, ''),
    serviceLower + 's', // plural
  ];
  
  const cityVariations = [
    cityLower,
    input.targetState.toLowerCase(),
  ];

  let variationCount = 0;
  for (const variation of [...serviceVariations, ...cityVariations]) {
    if (visibleText.toLowerCase().includes(variation)) {
      variationCount++;
    }
  }
  variationScore = Math.min(30, (variationCount / (serviceVariations.length + cityVariations.length)) * 30);

  // Density check
  const keywordOccurrences = (visibleText.toLowerCase().match(new RegExp(keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  const density = (keywordOccurrences / wordCount) * 100;

  let coverageScore = (placementScore * 0.7 + variationScore * 0.3);
  
  // Density sanity check
  if (density > 3) {
    coverageScore = Math.min(70, coverageScore); // Penalty for stuffing
  } else if (density < 0.1) {
    coverageScore = Math.min(70, coverageScore); // Too weak
  }

  return Math.min(100, Math.round(coverageScore));
}

/**
 * Q3 - Local Signals (15 pts)
 * Checks: City/state mentions, neighborhoods, local projects, map, schema
 */
export function scoreQ3Local(
  html: string,
  input: PageAuditInput
): number {
  let score = 0;
  const visibleText = extractVisibleText(html).toLowerCase();
  const cityLower = input.targetCity.toLowerCase();
  const stateLower = input.targetState.toLowerCase();

  // City & state mentions (0-25)
  const cityMentions = (visibleText.match(new RegExp(cityLower, 'g')) || []).length;
  const stateMentions = (visibleText.match(new RegExp(stateLower, 'g')) || []).length;
  
  if (cityMentions >= 5 && stateMentions >= 2) {
    score += 25;
  } else if (cityMentions >= 3 || stateMentions >= 1) {
    score += 15;
  } else if (cityMentions >= 1) {
    score += 8;
  }

  // Neighborhoods / nearby cities (0-20)
  // Simple heuristic: look for common patterns
  const hasNeighborhoods = /neighborhood|area|community|serving|nearby|surrounding/i.test(html);
  if (hasNeighborhoods) {
    score += 10;
  }

  // Local project / case study (0-20)
  const hasLocalProject = /(project|job|case study|customer|client).*in.*(city|neighborhood|area)/i.test(html) ||
                         new RegExp(`(project|job|case study).*${cityLower}`, 'i').test(html);
  if (hasLocalProject) {
    score += 20;
  } else {
    // Check for testimonials with location
    const hasLocalTestimonial = /testimonial|review.*customer|client.*says/i.test(html);
    if (hasLocalTestimonial) {
      score += 10;
    }
  }

  // Embedded map (0-20)
  const hasMap = /maps\.google|google.*maps|iframe.*maps|embed.*map/i.test(html);
  if (hasMap) {
    score += 20;
  } else if (input.businessType === 'service_area') {
    score += 5; // Optional for SAB
  }

  // LocalBusiness schema (0-15)
  const hasLocalBusinessSchema = /"@type"\s*:\s*"LocalBusiness"|"@type"\s*:\s*"Service"/i.test(html);
  if (hasLocalBusinessSchema) {
    // Check if it has NAP
    const hasNAP = /"name"|"telephone"|"address"/i.test(html);
    if (hasNAP) {
      score += 15;
    } else {
      score += 8;
    }
  }

  return Math.min(100, score);
}

/**
 * Q4 - Internal Linking & Site Structure (10 pts)
 * Checks: Incoming/outgoing internal links, nav presence
 */
export function scoreQ4InternalLinks(
  html: string,
  input: PageAuditInput
): number {
  let score = 0;

  // Extract all links
  const linkMatches = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi) || [];
  const links = linkMatches.map(m => {
    const hrefMatch = m.match(/href=["']([^"']+)["']/i);
    return hrefMatch ? hrefMatch[1] : '';
  });

  const currentDomain = new URL(input.url).hostname;
  const internalLinks = links.filter(href => {
    if (!href) return false;
    try {
      const linkUrl = new URL(href, input.url);
      return linkUrl.hostname === currentDomain || linkUrl.hostname === '';
    } catch {
      return href.startsWith('/') || href.startsWith('#');
    }
  });

  // Outgoing internal links (0-50)
  if (internalLinks.length >= 3) {
    score += 50;
  } else if (internalLinks.length >= 1) {
    score += 30;
  }

  // Check for nav/footer links
  const hasNavLinks = /<nav[^>]*>[\s\S]*?<\/nav>/i.test(html);
  const hasFooterLinks = /<footer[^>]*>[\s\S]*?<\/footer>/i.test(html);
  
  if (hasNavLinks || hasFooterLinks) {
    score += 30;
  }

  // Anchor text quality (simple check)
  const anchorTexts = linkMatches.map(m => {
    const textMatch = m.match(/>([^<]+)</);
    return textMatch ? textMatch[1].toLowerCase() : '';
  });
  
  const hasServiceInAnchors = anchorTexts.some(text => 
    text.includes(input.primaryService.toLowerCase()) || 
    text.includes(input.targetCity.toLowerCase())
  );
  
  if (hasServiceInAnchors) {
    score += 20;
  }

  return Math.min(100, score);
}

/**
 * Q5 - UX & Mobile (15 pts)
 * Checks: Viewport, page size, readability
 */
export function scoreQ5UX(
  html: string
): number {
  let score = 100;

  // Viewport check
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  if (!hasViewport) {
    score -= 30;
  }

  // Page size heuristics
  const htmlSize = html.length;
  const htmlSizeMB = htmlSize / (1024 * 1024);
  
  if (htmlSizeMB > 1.5) {
    score -= 20;
  } else if (htmlSizeMB > 1.0) {
    score -= 10;
  }

  // Image size estimate (count img tags)
  const imageCount = (html.match(/<img[^>]+>/gi) || []).length;
  if (imageCount > 20) {
    score -= 15; // Likely heavy
  }

  // Script count
  const scriptCount = (html.match(/<script[^>]*>/gi) || []).length;
  if (scriptCount > 40) {
    score -= 15;
  } else if (scriptCount > 20) {
    score -= 8;
  }

  // Readability: check for headings and lists
  const headingCount = (html.match(/<h[1-6][^>]*>/gi) || []).length;
  const listCount = (html.match(/<[uo]l[^>]*>/gi) || []).length;
  
  if (headingCount < 3) {
    score -= 10;
  }
  if (listCount === 0) {
    score -= 5;
  }

  // Check for annoying patterns
  const hasMultiplePopups = (html.match(/popup|modal|overlay/i) || []).length > 3;
  if (hasMultiplePopups) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Q6 - Conversion & Trust (15 pts)
 * Checks: CTA, phone, testimonials, badges, guarantees
 */
export function scoreQ6Conversion(
  html: string,
  input: PageAuditInput
): number {
  let score = 0;
  const visibleText = extractVisibleText(html).toLowerCase();

  // Primary CTA presence (0-30)
  const hasPhoneLink = /<a[^>]+href=["']tel:/i.test(html);
  const hasContactForm = /<form[^>]*>|contact.*form|get.*quote.*button/i.test(html);
  const hasQuoteButton = /get.*quote|free.*estimate|request.*quote|call.*now/i.test(visibleText);

  if (hasPhoneLink && (hasContactForm || hasQuoteButton)) {
    score += 30;
  } else if (hasPhoneLink || hasContactForm || hasQuoteButton) {
    score += 15;
  }

  // CTA repetition
  const ctaCount = (visibleText.match(/(call|contact|quote|estimate|get started)/gi) || []).length;
  if (ctaCount >= 3) {
    score += 5;
  }

  // Trust elements (0-40)
  const hasTestimonials = /testimonial|review|customer.*says|client.*says/i.test(html);
  const hasStars = /★|⭐|rating|stars|4\.\d+\/5|5\s*star/i.test(html);
  const hasSchemaReview = /"@type"\s*:\s*"Review"|"@type"\s*:\s*"AggregateRating"/i.test(html);
  
  if (hasTestimonials && (hasStars || hasSchemaReview)) {
    score += 25;
  } else if (hasTestimonials || hasStars) {
    score += 15;
  }

  const hasBadges = /licensed|insured|bbb|accredited|certified|award/i.test(visibleText);
  if (hasBadges) {
    score += 15;
  }

  // Risk reducers (0-20)
  const hasGuarantee = /guarantee|warranty|satisfaction|money.*back/i.test(visibleText);
  const hasFreeEstimate = /free.*estimate|free.*quote|no.*obligation/i.test(visibleText);
  
  if (hasGuarantee && hasFreeEstimate) {
    score += 20;
  } else if (hasGuarantee || hasFreeEstimate) {
    score += 10;
  }

  // Contact clarity (0-10)
  const hasHours = /hours|open|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(visibleText);
  if (hasHours) {
    score += 10;
  }

  return Math.min(100, score);
}

/**
 * Q7 - Technical Enhancements (10 pts)
 * Checks: Schema, clean URL, HTTPS, meta hygiene
 */
export function scoreQ7Technical(
  html: string,
  input: PageAuditInput
): number {
  let score = 0;

  // Structured data (0-50)
  const hasLocalBusinessSchema = /"@type"\s*:\s*"LocalBusiness"/i.test(html);
  const hasServiceSchema = /"@type"\s*:\s*"Service"/i.test(html);
  const hasReviewSchema = /"@type"\s*:\s*"Review"/i.test(html);
  const hasFAQSchema = /"@type"\s*:\s*"FAQPage"/i.test(html);

  if (hasLocalBusinessSchema || hasServiceSchema) {
    score += 30;
  }
  if (hasReviewSchema || hasFAQSchema) {
    score += 20;
  }

  // Clean URL (0-20)
  const urlPath = new URL(input.url).pathname;
  const urlSlug = urlPath.split('/').filter(p => p).pop() || '';
  
  // Check for stuffing (repeated keywords)
  const slugWords = urlSlug.split('-');
  const uniqueWords = new Set(slugWords);
  const stuffingRatio = slugWords.length / Math.max(uniqueWords.size, 1);
  
  if (urlSlug.length < 100 && stuffingRatio < 1.5) {
    score += 20;
  } else if (urlSlug.length < 150) {
    score += 10;
  }

  // HTTPS (0-30)
  if (input.url.startsWith('https://')) {
    score += 30;
  }

  return Math.min(100, score);
}

/**
 * Calculate overall quality score
 */
export function calculateQualityScore(
  html: string,
  input: PageAuditInput
): { score: number; components: QualityScoreComponents } {
  const components: QualityScoreComponents = {
    Q1_intent: scoreQ1Intent(html, input),
    Q2_onpage: scoreQ2OnPage(html, input),
    Q3_local: scoreQ3Local(html, input),
    Q4_internal_links: scoreQ4InternalLinks(html, input),
    Q5_ux: scoreQ5UX(html),
    Q6_conversion: scoreQ6Conversion(html, input),
    Q7_technical: scoreQ7Technical(html, input),
  };

  // Weighted average
  const weights = {
    Q1_intent: 20,
    Q2_onpage: 15,
    Q3_local: 15,
    Q4_internal_links: 10,
    Q5_ux: 15,
    Q6_conversion: 15,
    Q7_technical: 10,
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const weightedSum = 
    components.Q1_intent * weights.Q1_intent +
    components.Q2_onpage * weights.Q2_onpage +
    components.Q3_local * weights.Q3_local +
    components.Q4_internal_links * weights.Q4_internal_links +
    components.Q5_ux * weights.Q5_ux +
    components.Q6_conversion * weights.Q6_conversion +
    components.Q7_technical * weights.Q7_technical;

  const score = Math.round(weightedSum / totalWeight);

  return { score, components };
}

