/**
 * Local SEO Page Audit System
 * 
 * Main entry point for running page audits
 */

import {
  AuditContext,
  AuditResult,
  OverallStatus,
  HardGatesResult,
} from './types';
import { evaluateHardGates } from './hard-gates';
import { calculateQualityScore } from './quality-score';
import { calculateCompetitiveScore } from './competitive-score';
import { generateIssues } from './issue-generator';

/**
 * Determine overall status from scores and gates
 */
function determineOverallStatus(
  hardGates: HardGatesResult,
  qualityScore: number,
  competitiveScore: number
): OverallStatus {
  // Check for any FAIL in hard gates
  const hasFail = Object.values(hardGates).some(status => status === 'FAIL');
  if (hasFail) {
    return 'BROKEN';
  }

  // Determine status based on scores
  if (qualityScore < 60) {
    return 'NEEDS_WORK';
  }

  if (qualityScore >= 60 && competitiveScore < 50) {
    return 'NEEDS_WORK';
  }

  if (qualityScore >= 70 && qualityScore < 85 && competitiveScore >= 50 && competitiveScore < 80) {
    return 'STRONG';
  }

  if (qualityScore >= 85 && competitiveScore >= 80) {
    return 'ELITE';
  }

  // Default to STRONG if quality is good but competitive is moderate
  if (qualityScore >= 70) {
    return 'STRONG';
  }

  return 'NEEDS_WORK';
}

/**
 * Extract word count from HTML
 */
function extractWordCount(html: string): number {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return 0;
  
  const bodyText = bodyMatch[1]
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return bodyText.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Run a complete page audit
 */
export async function runPageAudit(
  context: AuditContext,
  httpStatus?: number
): Promise<AuditResult> {
  const { page, competitive, siteWideLocationPages } = context;

  // Evaluate hard gates
  const hardGates = evaluateHardGates(
    page,
    page.html,
    httpStatus,
    siteWideLocationPages
  );

  // Calculate quality score
  const qualityResult = calculateQualityScore(page.html, page);

  // Calculate competitive edge score (if competitive data available)
  let competitiveResult;
  if (competitive) {
    competitiveResult = calculateCompetitiveScore(
      page.html,
      page,
      competitive
    );
  } else {
    // Default scores if no competitive data
    competitiveResult = {
      score: 50,
      components: {
        C1_links: 50,
        C2_content_vs_comp: 50,
        C3_serp_features: 50,
        C4_brand_reviews: 50,
      },
    };
  }

  // Determine overall status
  const overallStatus = determineOverallStatus(
    hardGates,
    qualityResult.score,
    competitiveResult.score
  );

  // Generate issues
  const issues = generateIssues(
    hardGates,
    qualityResult.components,
    competitiveResult.components,
    page.html,
    page,
    overallStatus
  );

  // Extract word count
  const wordCount = extractWordCount(page.html);

  return {
    url: page.url,
    overallStatus,
    hardGates,
    scores: {
      quality: qualityResult.score,
      competitiveEdge: competitiveResult.score,
      components: {
        quality: qualityResult.components,
        competitive: competitiveResult.components,
      },
    },
    issues,
    metadata: {
      wordCount,
      analyzedAt: new Date(),
      auditVersion: '1.0.0',
    },
  };
}

// Export all types and functions
export * from './types';
export * from './hard-gates';
export * from './quality-score';
export * from './competitive-score';
export * from './issue-generator';

