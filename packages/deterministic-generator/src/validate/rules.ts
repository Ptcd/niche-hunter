/**
 * Validation rules (hard fails vs soft warnings)
 */

import { Blueprint, ValidationReport } from '../types';
import { hasPlaceholders, countInternalPlaceholders, countExternalPlaceholders } from '../linking/placeholders';
import { getInternalLinkRule, getExternalLinkRule, PageType } from '../generationRules';
import { planInternalLinks } from '../linking/internalLinkPlanner';

export interface ValidationError {
  page_slug: string;
  rule: string;
  message: string;
  severity: 'hard_failure' | 'warning';
}

/**
 * Check for remaining placeholders (HARD FAIL)
 */
export function validateNoPlaceholdersRemain(
  html: string,
  slug: string
): ValidationError | null {
  if (hasPlaceholders(html)) {
    return {
      page_slug: slug,
      rule: 'no_placeholders_remain',
      message: 'HTML contains unreplaced placeholders',
      severity: 'hard_failure',
    };
  }
  return null;
}

/**
 * Validate internal link counts (HARD FAIL)
 */
export function validateInternalLinkCounts(
  html: string,
  slug: string,
  pageType: PageType,
  blueprint: Blueprint
): ValidationError | null {
  const rule = getInternalLinkRule(pageType);
  const actualCount = countInternalPlaceholders(html);
  
  // If exact_count is specified, must match exactly
  if (rule.exact_count !== undefined) {
    if (actualCount !== rule.exact_count) {
      return {
        page_slug: slug,
        rule: 'internal_link_count',
        message: `Expected exactly ${rule.exact_count} internal links, found ${actualCount}`,
        severity: 'hard_failure',
      };
    }
  }
  
  // Check must_include requirements
  if (rule.must_include) {
    const linkPlans = planInternalLinks(blueprint);
    const pagePlan = linkPlans.find(p => p.from_slug === slug);
    
    if (pagePlan) {
      for (const requiredSlug of rule.must_include) {
        if (!pagePlan.to_slugs.includes(requiredSlug)) {
          return {
            page_slug: slug,
            rule: 'required_internal_links',
            message: `Missing required internal link to ${requiredSlug}`,
            severity: 'hard_failure',
          };
        }
      }
    }
  }
  
  // Special case: home page must link to ALL service pages + ALL city pages
  if (pageType === 'home') {
    const linkPlans = planInternalLinks(blueprint);
    const homePlan = linkPlans.find(p => p.from_slug === '/');
    
    if (homePlan) {
      const servicePages = blueprint.pages.filter(p => p.page_type === 'service');
      const cityPages = blueprint.pages.filter(p => p.page_type === 'city');
      
      const missingServices = servicePages.filter(p => !homePlan.to_slugs.includes(p.slug));
      const missingCities = cityPages.filter(p => !homePlan.to_slugs.includes(p.slug));
      
      if (missingServices.length > 0) {
        return {
          page_slug: slug,
          rule: 'home_missing_service_links',
          message: `Home page missing links to service pages: ${missingServices.map(p => p.slug).join(', ')}`,
          severity: 'hard_failure',
        };
      }
      
      if (missingCities.length > 0) {
        return {
          page_slug: slug,
          rule: 'home_missing_city_links',
          message: `Home page missing links to city pages: ${missingCities.map(p => p.slug).join(', ')}`,
          severity: 'hard_failure',
        };
      }
      
      // Check required pages
      const requiredPages = ['/about', '/contact', '/terms'];
      const missingRequired = requiredPages.filter(p => !homePlan.to_slugs.includes(p));
      
      if (missingRequired.length > 0) {
        return {
          page_slug: slug,
          rule: 'home_missing_required_links',
          message: `Home page missing links to required pages: ${missingRequired.join(', ')}`,
          severity: 'hard_failure',
        };
      }
    }
  }
  
  return null;
}

/**
 * Validate external link counts (HARD FAIL)
 */
export function validateExternalLinkCounts(
  html: string,
  slug: string,
  pageType: PageType
): ValidationError | null {
  const rule = getExternalLinkRule(pageType);
  
  if (!rule.required) {
    return null; // External links not required for this page type
  }
  
  const actualCount = countExternalPlaceholders(html);
  const expectedCount = rule.exact_count || 1;
  
  if (actualCount !== expectedCount) {
    return {
      page_slug: slug,
      rule: 'external_link_count',
      message: `Expected exactly ${expectedCount} external link(s), found ${actualCount}`,
      severity: 'hard_failure',
    };
  }
  
  return null;
}

/**
 * Validate all internal hrefs exist in blueprint (HARD FAIL)
 */
export function validateInternalHrefsExist(
  html: string,
  slug: string,
  blueprint: Blueprint
): ValidationError | null {
  // Extract all hrefs from HTML
  const hrefRegex = /href=["']([^"']+)["']/g;
  const hrefs: string[] = [];
  let match;
  
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    // Only check internal links (not external)
    if (href.startsWith('/') && !href.startsWith('//')) {
      hrefs.push(href);
    }
  }
  
  const allSlugs = new Set(blueprint.pages.map(p => p.slug));
  const invalidHrefs: string[] = [];
  
  for (const href of hrefs) {
    // Remove query params and hash
    const cleanHref = href.split('?')[0].split('#')[0];
    
    if (!allSlugs.has(cleanHref)) {
      invalidHrefs.push(href);
    }
  }
  
  if (invalidHrefs.length > 0) {
    return {
      page_slug: slug,
      rule: 'invalid_internal_hrefs',
      message: `Internal links point to non-existent pages: ${invalidHrefs.join(', ')}`,
      severity: 'hard_failure',
    };
  }
  
  return null;
}

/**
 * Validate blog index links to all posts (HARD FAIL)
 */
export function validateBlogIndexLinks(
  html: string,
  slug: string,
  blueprint: Blueprint
): ValidationError | null {
  if (slug !== '/blog') {
    return null;
  }
  
  const blogPosts = blueprint.pages.filter(p => p.page_type === 'blog_post');
  if (blogPosts.length === 0) {
    return null; // No blog posts to validate
  }
  
  const hrefRegex = /href=["']([^"']+)["']/g;
  const hrefs: string[] = [];
  let match;
  
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith('/blog/')) {
      hrefs.push(href);
    }
  }
  
  const missingPosts = blogPosts.filter(p => !hrefs.includes(p.slug));
  
  if (missingPosts.length > 0) {
    return {
      page_slug: slug,
      rule: 'blog_index_missing_posts',
      message: `Blog index missing links to posts: ${missingPosts.map(p => p.slug).join(', ')}`,
      severity: 'hard_failure',
    };
  }
  
  return null;
}

/**
 * Validate blog post links (HARD FAIL)
 */
export function validateBlogPostLinks(
  html: string,
  slug: string,
  blueprint: Blueprint
): ValidationError | null {
  const page = blueprint.pages.find(p => p.slug === slug);
  if (!page || page.page_type !== 'blog_post') {
    return null;
  }
  
  const hrefRegex = /href=["']([^"']+)["']/g;
  const hrefs: string[] = [];
  let match;
  
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith('/')) {
      hrefs.push(href);
    }
  }
  
  // Must link to service_slug (from blog plan - will be handled separately)
  // Must link to /contact
  if (!hrefs.includes('/contact')) {
    return {
      page_slug: slug,
      rule: 'blog_post_missing_contact',
      message: 'Blog post must link to /contact',
      severity: 'hard_failure',
    };
  }
  
  return null;
}

/**
 * Soft warning: word count outside target range
 */
export function validateWordCount(
  html: string,
  slug: string,
  pageType: PageType
): ValidationError | null {
  // Extract text content
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
  
  const { min, max } = require('../generationRules').getWordCountTarget(pageType);
  
  if (wordCount < min || wordCount > max) {
    return {
      page_slug: slug,
      rule: 'word_count',
      message: `Word count ${wordCount} outside target range ${min}-${max}`,
      severity: 'warning',
    };
  }
  
  return null;
}

/**
 * Soft warning: primary keyword occurrences exceed max
 */
export function validateKeywordDensity(
  html: string,
  slug: string,
  pageType: PageType,
  primaryKeyword: string
): ValidationError | null {
  if (!primaryKeyword) {
    return null;
  }
  
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  
  const keywordLower = primaryKeyword.toLowerCase();
  const matches = (textContent.match(new RegExp(keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  
  const rule = require('../generationRules').getKeywordPlacementRule(pageType);
  const maxTotal = rule.h1_count + rule.first_100_words_count + rule.body_max;
  
  if (matches > maxTotal) {
    return {
      page_slug: slug,
      rule: 'keyword_density',
      message: `Primary keyword "${primaryKeyword}" appears ${matches} times (max ${maxTotal})`,
      severity: 'warning',
    };
  }
  
  return null;
}

