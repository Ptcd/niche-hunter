/**
 * Single source of truth for all V1.3 generation rules
 */

export type PageType = 'home' | 'service' | 'city' | 'about' | 'contact' | 'terms' | 'blog_index' | 'blog_post';

export interface WordCountTarget {
  min: number;
  max: number;
}

export const WORD_COUNT_TARGETS: Record<PageType, WordCountTarget> = {
  home: { min: 1200, max: 1800 },
  service: { min: 1200, max: 1500 },
  city: { min: 900, max: 1200 },
  about: { min: 600, max: 900 },
  contact: { min: 400, max: 650 },
  terms: { min: 900, max: 1400 },
  blog_index: { min: 400, max: 800 },
  blog_post: { min: 900, max: 1500 },
};

export interface InternalLinkRule {
  exact_count?: number;
  must_include?: string[];
  allowed_sources?: string[];
}

export const INTERNAL_LINK_RULES: Record<PageType, InternalLinkRule> = {
  home: {
    // Home must link to ALL service pages + ALL city pages + about/contact/terms
    must_include: ['/about', '/contact', '/terms'],
    // Plus all service and city pages (enforced in validator)
  },
  service: {
    exact_count: 2,
    allowed_sources: ['/', '/contact'], // Plus up to 3 city pages
  },
  city: {
    exact_count: 2,
    allowed_sources: ['/', '/contact'], // Plus primary service page
  },
  about: {
    exact_count: 2,
    allowed_sources: ['/', '/contact'],
  },
  contact: {
    exact_count: 1,
    allowed_sources: ['/'],
  },
  terms: {
    exact_count: 2,
    allowed_sources: ['/', '/contact'],
  },
  blog_index: {
    // Must link to all blog posts
  },
  blog_post: {
    // Must include: service_slug + /contact + optional related_post
    must_include: ['/contact'],
  },
};

export interface ExternalLinkRule {
  required: boolean;
  exact_count?: number;
}

export const EXTERNAL_LINK_RULES: Record<PageType, ExternalLinkRule> = {
  home: { required: true, exact_count: 1 },
  service: { required: true, exact_count: 1 },
  city: { required: true, exact_count: 1 },
  about: { required: false },
  contact: { required: false },
  terms: { required: false },
  blog_index: { required: false },
  blog_post: { required: true, exact_count: 1 },
};

export interface KeywordPlacementRule {
  h1_count: number;
  first_100_words_count: number;
  body_min: number;
  body_max: number;
  service_city_phrase_min: number; // "{service} {city}" must appear at least N times in body
  semantic_keywords_min: number;
  semantic_keywords_max: number;
  city_mentions_min: number;
  city_mentions_max: number;
  state_mentions_min: number;
  state_mentions_max: number;
}

export const KEYWORD_PLACEMENT_RULES: Record<PageType, KeywordPlacementRule> = {
  home: {
    h1_count: 1,
    first_100_words_count: 1,
    body_min: 2,
    body_max: 5,
    service_city_phrase_min: 2,
    semantic_keywords_min: 3,
    semantic_keywords_max: 5,
    city_mentions_min: 3,
    city_mentions_max: 5,
    state_mentions_min: 1,
    state_mentions_max: 2,
  },
  service: {
    h1_count: 1,
    first_100_words_count: 1,
    body_min: 2,
    body_max: 5,
    service_city_phrase_min: 2,
    semantic_keywords_min: 3,
    semantic_keywords_max: 5,
    city_mentions_min: 3,
    city_mentions_max: 5,
    state_mentions_min: 1,
    state_mentions_max: 2,
  },
  city: {
    h1_count: 1,
    first_100_words_count: 1,
    body_min: 1,
    body_max: 4,
    service_city_phrase_min: 2,
    semantic_keywords_min: 3,
    semantic_keywords_max: 5,
    city_mentions_min: 3,
    city_mentions_max: 5,
    state_mentions_min: 1,
    state_mentions_max: 2,
  },
  about: {
    h1_count: 1,
    first_100_words_count: 0,
    body_min: 0,
    body_max: 2,
    service_city_phrase_min: 0,
    semantic_keywords_min: 0,
    semantic_keywords_max: 2,
    city_mentions_min: 1,
    city_mentions_max: 3,
    state_mentions_min: 0,
    state_mentions_max: 1,
  },
  contact: {
    h1_count: 1,
    first_100_words_count: 0,
    body_min: 0,
    body_max: 1,
    service_city_phrase_min: 0,
    semantic_keywords_min: 0,
    semantic_keywords_max: 1,
    city_mentions_min: 1,
    city_mentions_max: 2,
    state_mentions_min: 0,
    state_mentions_max: 1,
  },
  terms: {
    h1_count: 1,
    first_100_words_count: 0,
    body_min: 0,
    body_max: 1,
    service_city_phrase_min: 0,
    semantic_keywords_min: 0,
    semantic_keywords_max: 1,
    city_mentions_min: 0,
    city_mentions_max: 1,
    state_mentions_min: 0,
    state_mentions_max: 1,
  },
  blog_index: {
    h1_count: 1,
    first_100_words_count: 0,
    body_min: 0,
    body_max: 1,
    service_city_phrase_min: 0,
    semantic_keywords_min: 0,
    semantic_keywords_max: 2,
    city_mentions_min: 0,
    city_mentions_max: 2,
    state_mentions_min: 0,
    state_mentions_max: 1,
  },
  blog_post: {
    h1_count: 1,
    first_100_words_count: 1,
    body_min: 1,
    body_max: 4,
    service_city_phrase_min: 0,
    semantic_keywords_min: 2,
    semantic_keywords_max: 4,
    city_mentions_min: 1,
    city_mentions_max: 2,
    state_mentions_min: 0,
    state_mentions_max: 1,
  },
};

export interface ReviewRule {
  count: number;
  format: 'first_name_last_initial';
  keyword_injection_required: boolean;
  forbidden_content: string[];
}

export const REVIEW_RULES: Record<PageType, ReviewRule | null> = {
  home: {
    count: 1,
    format: 'first_name_last_initial',
    keyword_injection_required: true,
    forbidden_content: ['dates', 'addresses', 'licensing', 'credentials', 'pricing', 'superlatives'],
  },
  service: {
    count: 3, // 2-3, we'll use 3 as target
    format: 'first_name_last_initial',
    keyword_injection_required: true,
    forbidden_content: ['dates', 'addresses', 'licensing', 'credentials', 'pricing', 'superlatives'],
  },
  city: {
    count: 2,
    format: 'first_name_last_initial',
    keyword_injection_required: true,
    forbidden_content: ['dates', 'addresses', 'licensing', 'credentials', 'pricing', 'superlatives'],
  },
  about: null,
  contact: null,
  terms: null,
  blog_index: null,
  blog_post: null,
};

export interface LandmarkRule {
  count_min: number;
  count_max: number;
  safe_phrases: string[];
  forbidden_phrases: string[];
}

export const LANDMARK_RULES: Record<PageType, LandmarkRule | null> = {
  home: {
    count_min: 1,
    count_max: 2,
    safe_phrases: ['homes near', 'properties around', 'areas like'],
    forbidden_phrases: ['across from', 'next to', 'directions', 'office location'],
  },
  service: {
    count_min: 1,
    count_max: 2,
    safe_phrases: ['homes near', 'properties around', 'areas like'],
    forbidden_phrases: ['across from', 'next to', 'directions', 'office location'],
  },
  city: {
    count_min: 1,
    count_max: 1,
    safe_phrases: ['homes near', 'properties around', 'areas like'],
    forbidden_phrases: ['across from', 'next to', 'directions', 'office location'],
  },
  about: null,
  contact: null,
  terms: null,
  blog_index: null,
  blog_post: null,
};

/**
 * Get word count target for a page type
 */
export function getWordCountTarget(pageType: PageType): WordCountTarget {
  return WORD_COUNT_TARGETS[pageType];
}

/**
 * Get internal link rule for a page type
 */
export function getInternalLinkRule(pageType: PageType): InternalLinkRule {
  return INTERNAL_LINK_RULES[pageType];
}

/**
 * Get external link rule for a page type
 */
export function getExternalLinkRule(pageType: PageType): ExternalLinkRule {
  return EXTERNAL_LINK_RULES[pageType];
}

/**
 * Get keyword placement rule for a page type
 */
export function getKeywordPlacementRule(pageType: PageType): KeywordPlacementRule {
  return KEYWORD_PLACEMENT_RULES[pageType];
}

/**
 * Get review rule for a page type (null if no reviews required)
 */
export function getReviewRule(pageType: PageType): ReviewRule | null {
  return REVIEW_RULES[pageType];
}

/**
 * Get landmark rule for a page type (null if no landmarks required)
 */
export function getLandmarkRule(pageType: PageType): LandmarkRule | null {
  return LANDMARK_RULES[pageType];
}

