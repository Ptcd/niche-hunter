/**
 * Issue Generator
 * 
 * Maps audit scores to prioritized, actionable issues and recommendations
 */

import {
  Issue,
  IssueSeverity,
  IssueArea,
  HardGatesResult,
  QualityScoreComponents,
  CompetitiveScoreComponents,
  PageAuditInput,
  OverallStatus,
} from './types';

/**
 * Generate issues from hard gates
 */
function generateHardGateIssues(
  hardGates: HardGatesResult,
  input: PageAuditInput
): Issue[] {
  const issues: Issue[] = [];

  if (hardGates.G1_indexability === 'FAIL') {
    issues.push({
      id: 'NOINDEX_OR_BLOCKED',
      severity: 'high',
      area: 'hard_gate',
      message: 'This page is blocked from indexing (noindex meta tag or robots.txt). Search engines cannot see this page.',
      suggestedAction: 'Remove noindex meta tag or robots.txt block. This page must be indexable to rank.',
    });
  } else if (hardGates.G1_indexability === 'WARN') {
    issues.push({
      id: 'MISSING_CANONICAL',
      severity: 'medium',
      area: 'hard_gate',
      message: 'This page is missing a canonical tag, which can cause duplicate content issues.',
      suggestedAction: 'Add a canonical tag pointing to this page\'s URL to prevent duplicate content penalties.',
    });
  }

  if (hardGates.G2_page_hygiene === 'FAIL') {
    issues.push({
      id: 'MISSING_TITLE_OR_PLACEHOLDER',
      severity: 'high',
      area: 'hard_gate',
      message: 'This page is missing a title tag or contains placeholder content (e.g., "Lorem ipsum").',
      suggestedAction: 'Add a proper title tag and replace all placeholder text with real content.',
    });
  } else if (hardGates.G2_page_hygiene === 'WARN') {
    issues.push({
      id: 'MISSING_H1_OR_META_DESC',
      severity: 'medium',
      area: 'hard_gate',
      message: 'This page is missing an H1 tag or meta description, or has insufficient content (less than 400 words).',
      suggestedAction: 'Add a single H1 tag, write a meta description (50-180 characters), and expand content to at least 400 words.',
    });
  }

  if (hardGates.G3_local_presence === 'FAIL') {
    issues.push({
      id: 'MISSING_PHONE',
      severity: 'high',
      area: 'hard_gate',
      message: `This page does not display a phone number, which is required for local SEO.`,
      suggestedAction: `Add your phone number (${input.primaryPhone}) prominently on the page, ideally in the header and as a clickable tel: link.`,
    });
  } else if (hardGates.G3_local_presence === 'WARN') {
    if (input.businessType === 'storefront') {
      issues.push({
        id: 'MISSING_ADDRESS_OR_MAP',
        severity: 'medium',
        area: 'local',
        message: 'This storefront page is missing a full address or embedded Google Map.',
        suggestedAction: 'Add your complete business address or embed a Google Map to help customers find your location.',
      });
    } else {
      issues.push({
        id: 'WEAK_CITY_MENTION',
        severity: 'medium',
        area: 'local',
        message: `This page doesn't clearly mention ${input.targetCity}, ${input.targetState} in the content.`,
        suggestedAction: `Add ${input.targetCity}, ${input.targetState} to headings and body content to strengthen local relevance.`,
      });
    }
  }

  if (hardGates.G4_duplicate_content === 'FAIL') {
    issues.push({
      id: 'DOORWAY_RISK',
      severity: 'high',
      area: 'content',
      message: 'This page is 95%+ identical to another city page on your site (doorway page risk).',
      suggestedAction: 'Rewrite major sections with city-specific details: local projects, neighborhoods served, city-specific regulations, or local testimonials.',
    });
  } else if (hardGates.G4_duplicate_content === 'WARN') {
    issues.push({
      id: 'HEAVY_BOILERPLATE',
      severity: 'medium',
      area: 'content',
      message: 'This page is 80-95% similar to other location pages, indicating heavy template reuse.',
      suggestedAction: `Add at least 2-3 unique sections specific to ${input.targetCity}: recent local projects, neighborhoods you serve, or local market insights.`,
    });
  }

  return issues;
}

/**
 * Generate issues from quality score components
 */
function generateQualityIssues(
  components: QualityScoreComponents,
  html: string,
  input: PageAuditInput
): Issue[] {
  const issues: Issue[] = [];

  // Q1 - Intent (lower threshold - pages with partial matches should pass)
  if (components.Q1_intent < 40) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : '';
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const h1 = h1Match ? h1Match[1] : '';

    if (!title.toLowerCase().includes(input.targetCity.toLowerCase())) {
      issues.push({
        id: 'MISSING_CITY_IN_TITLE',
        severity: 'high',
        area: 'content',
        message: `Your title tag doesn't include "${input.targetCity}", which makes it harder to rank for local searches.`,
        suggestedAction: `Update the title to include both your main service and city, e.g. "${input.primaryKeyword} | ${input.businessName || 'Your Business'}"`,
      });
    }

    if (!h1.toLowerCase().includes(input.primaryService.toLowerCase())) {
      issues.push({
        id: 'WEAK_H1_INTENT',
        severity: 'high',
        area: 'content',
        message: 'Your H1 doesn\'t clearly indicate the primary service being offered.',
        suggestedAction: `Update the H1 to include "${input.primaryService}" and "${input.targetCity}" for better intent matching.`,
      });
    }
  }

  // Q2 - On-page (lower threshold for partial HTML)
  if (components.Q2_onpage < 40) {
    issues.push({
      id: 'WEAK_KEYWORD_OPTIMIZATION',
      severity: 'medium',
      area: 'content',
      message: `The primary keyword "${input.primaryKeyword}" is not well-optimized on this page.`,
      suggestedAction: `Add "${input.primaryKeyword}" to the title, H1, first paragraph, and at least one subheading (H2/H3).`,
    });
  }

  // Q3 - Local signals (lower threshold)
  if (components.Q3_local < 40) {
    issues.push({
      id: 'WEAK_LOCAL_SIGNALS',
      severity: 'medium',
      area: 'local',
      message: `This page lacks strong local signals for ${input.targetCity}, ${input.targetState}.`,
      suggestedAction: `Add ${input.targetCity} mentions throughout the content, list neighborhoods you serve, include a Google Map, and add LocalBusiness schema markup.`,
    });
  }

  // Q4 - Internal links
  if (components.Q4_internal_links < 50) {
    issues.push({
      id: 'POOR_INTERNAL_LINKING',
      severity: 'low',
      area: 'links',
      message: 'This page has few or no internal links to other pages on your site.',
      suggestedAction: 'Add 3-5 contextual internal links to related service pages, your homepage, and contact page. Include them in the main content, not just navigation.',
    });
  }

  // Q5 - UX (lower threshold)
  if (components.Q5_ux < 40) {
    issues.push({
      id: 'UX_ISSUES',
      severity: 'medium',
      area: 'ux',
      message: 'This page has UX issues that may hurt user experience and rankings.',
      suggestedAction: 'Add viewport meta tag for mobile, reduce page size (optimize images), and improve readability with proper headings and lists.',
    });
  }

  // Q6 - Conversion
  // Only flag conversion issues if score is very low - pages with phone links and basic CTAs should pass
  if (components.Q6_conversion < 40) {
    issues.push({
      id: 'WEAK_CONVERSION_ELEMENTS',
      severity: 'high',
      area: 'conversion',
      message: 'This page lacks strong conversion elements (phone, CTA, testimonials).',
      suggestedAction: `Add a prominent phone number (${input.primaryPhone}) above the fold, include "Get Free Quote" buttons, and add customer testimonials with star ratings.`,
    });
  }

  // Q7 - Technical (lower threshold)
  if (components.Q7_technical < 40) {
    const hasSchema = /"@type"\s*:\s*"LocalBusiness"/i.test(html);
    if (!hasSchema) {
      issues.push({
        id: 'MISSING_LOCALBUSINESS_SCHEMA',
        severity: 'medium',
        area: 'technical',
        message: 'This page is missing LocalBusiness structured data, which helps search engines understand your business.',
        suggestedAction: 'Add LocalBusiness JSON-LD schema with your business name, phone, address, and service area.',
      });
    }
  }

  return issues;
}

/**
 * Generate issues from competitive score components
 */
function generateCompetitiveIssues(
  components: CompetitiveScoreComponents,
  input: PageAuditInput
): Issue[] {
  const issues: Issue[] = [];

  // C1 - Links (lowered threshold - competitive metrics are hard to influence directly)
  if (components.C1_links < 30) {
    issues.push({
      id: 'LINK_GAP_LARGE',
      severity: 'high',
      area: 'links',
      message: 'Top competitors have significantly more domain authority and backlinks than your site.',
      suggestedAction: 'Plan a local link campaign: sponsor local organizations, join local business directories, get listed on industry association sites, and earn citations from local news sites.',
    });
  } else if (components.C1_links < 40) {
    issues.push({
      id: 'LINK_GAP_MEDIUM',
      severity: 'medium',
      area: 'links',
      message: 'Competitors have about 2x your referring domains.',
      suggestedAction: 'Earn 5-10 quality local links through sponsorships, directory listings, and industry partnerships.',
    });
  }

  // C2 - Content depth (lowered threshold)
  if (components.C2_content_vs_comp < 30) {
    issues.push({
      id: 'CONTENT_DEPTH_GAP',
      severity: 'medium',
      area: 'content',
      message: 'Your content is shorter or less comprehensive than top competitors.',
      suggestedAction: 'Expand content to match or exceed competitor depth. Add sections on pricing, service areas, FAQs, case studies, and guarantees.',
    });
  }

  // C3 - SERP features (lowered threshold)
  if (components.C3_serp_features < 30) {
    issues.push({
      id: 'MISSING_SERP_FEATURES',
      severity: 'medium',
      area: 'technical',
      message: 'Several top results show rich snippets (review stars, FAQ), but your page does not.',
      suggestedAction: 'Add an FAQ section with FAQPage schema, and include review schema markup to increase SERP visibility.',
    });
  }

  // C4 - Brand/reviews (lowered threshold)
  if (components.C4_brand_reviews < 30) {
    issues.push({
      id: 'WEAK_BRAND_PRESENCE',
      severity: 'medium',
      area: 'conversion',
      message: 'Your page lacks trust signals compared to competitors.',
      suggestedAction: 'Add customer testimonials, display review ratings, show licensing badges, and include guarantees or warranties.',
    });
  }

  return issues;
}

/**
 * Generate all issues and prioritize them
 */
export function generateIssues(
  hardGates: HardGatesResult,
  qualityComponents: QualityScoreComponents,
  competitiveComponents: CompetitiveScoreComponents,
  html: string,
  input: PageAuditInput,
  overallStatus: OverallStatus
): Issue[] {
  const allIssues: Issue[] = [];

  // Hard gate issues (always high priority)
  allIssues.push(...generateHardGateIssues(hardGates, input));

  // Quality issues
  allIssues.push(...generateQualityIssues(qualityComponents, html, input));

  // Competitive issues (only if not BROKEN)
  if (overallStatus !== 'BROKEN') {
    allIssues.push(...generateCompetitiveIssues(competitiveComponents, input));
  }

  // Prioritize: severity + impact
  const priorityOrder: IssueSeverity[] = ['high', 'medium', 'low'];
  allIssues.sort((a, b) => {
    const severityDiff = priorityOrder.indexOf(a.severity) - priorityOrder.indexOf(b.severity);
    if (severityDiff !== 0) return severityDiff;
    
    // If same severity, hard_gate issues come first
    if (a.area === 'hard_gate' && b.area !== 'hard_gate') return -1;
    if (b.area === 'hard_gate' && a.area !== 'hard_gate') return 1;
    
    return 0;
  });

  // Return top 10 issues
  return allIssues.slice(0, 10);
}

