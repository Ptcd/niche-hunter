/**
 * Local SEO Page Audit Types
 * 
 * Type definitions for the 3-layer page audit system:
 * 1. Hard Gates (Pass/Warn/Fail)
 * 2. Quality Score (0-100)
 * 3. Competitive Edge Score (0-100)
 */

export type BusinessType = 'storefront' | 'service_area';

export type GateStatus = 'PASS' | 'WARN' | 'FAIL';

export type OverallStatus = 'BROKEN' | 'NEEDS_WORK' | 'STRONG' | 'ELITE';

export type IssueSeverity = 'high' | 'medium' | 'low';

export type IssueArea = 
  | 'hard_gate' 
  | 'content' 
  | 'local' 
  | 'ux' 
  | 'conversion' 
  | 'links' 
  | 'technical';

/**
 * Required inputs for page audit
 */
export interface PageAuditInput {
  url: string; // Full URL of page being scored
  html: string; // Raw HTML of the page
  businessType: BusinessType;
  businessName?: string; // Optional but ideal
  primaryPhone: string; // E.164 or local format
  targetCity: string; // e.g. "Milwaukee"
  targetState: string; // e.g. "WI"
  targetCountry: string; // e.g. "US"
  primaryService: string; // e.g. "Flooring installation"
  primaryKeyword: string; // e.g. "flooring installation Milwaukee"
  additionalKeywords?: string[];
  analyticsHints?: {
    bounceRate?: number;
    avgTimeOnPageSeconds?: number;
    conversionRate?: number;
  };
}

/**
 * SERP result from competitor analysis for audit
 */
export interface AuditSerpResult {
  position: number; // 1..10
  url: string;
  title: string;
  metaDescription?: string;
  wordCountEstimate?: number;
  hasReviewStars?: boolean;
  hasFAQSnippet?: boolean;
  hasVideoThumbnail?: boolean;
  domainAuthority?: number; // 0-100
  pageAuthority?: number; // 0-100
  referringDomains?: number;
  backlinks?: number;
}

/**
 * Competitive data inputs
 */
export interface CompetitiveInputs {
  serpResultsTop10: AuditSerpResult[];
  thisDomainAuthority?: number;
  thisPageAuthority?: number;
  thisReferringDomains?: number;
  thisBacklinks?: number;
}

/**
 * Site-wide location pages for duplicate detection
 */
export interface SiteWideLocationPage {
  url: string;
  html: string;
}

/**
 * Full audit context
 */
export interface AuditContext {
  page: PageAuditInput;
  competitive?: CompetitiveInputs;
  siteWideLocationPages?: SiteWideLocationPage[];
}

/**
 * Hard gate results
 */
export interface HardGatesResult {
  G1_indexability: GateStatus;
  G2_page_hygiene: GateStatus;
  G3_local_presence: GateStatus;
  G4_duplicate_content: GateStatus;
}

/**
 * Quality score components (Q1-Q7)
 */
export interface QualityScoreComponents {
  Q1_intent: number; // 0-100
  Q2_onpage: number; // 0-100
  Q3_local: number; // 0-100
  Q4_internal_links: number; // 0-100
  Q5_ux: number; // 0-100
  Q6_conversion: number; // 0-100
  Q7_technical: number; // 0-100
}

/**
 * Competitive edge components (C1-C4)
 */
export interface CompetitiveScoreComponents {
  C1_links: number; // 0-100
  C2_content_vs_comp: number; // 0-100
  C3_serp_features: number; // 0-100
  C4_brand_reviews: number; // 0-100
}

/**
 * Priority issue with recommendation
 */
export interface Issue {
  id: string; // e.g. "MISSING_CITY_IN_TITLE"
  severity: IssueSeverity;
  area: IssueArea;
  message: string; // Human readable
  suggestedAction: string; // One-sentence fix
}

/**
 * Complete audit result
 */
export interface AuditResult {
  url: string;
  overallStatus: OverallStatus;
  hardGates: HardGatesResult;
  scores: {
    quality: number; // 0-100
    competitiveEdge: number; // 0-100
    components: {
      quality: QualityScoreComponents;
      competitive: CompetitiveScoreComponents;
    };
  };
  issues: Issue[]; // Top 5-10 prioritized issues
  metadata?: {
    wordCount?: number;
    analyzedAt: Date;
    auditVersion?: string;
  };
}

