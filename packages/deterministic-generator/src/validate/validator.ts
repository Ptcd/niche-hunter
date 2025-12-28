/**
 * Validator orchestrator
 * 
 * Runs all validation rules and generates validation report
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { Blueprint, ValidationReport } from '../types';
import {
  validateNoPlaceholdersRemain,
  validateInternalLinkCounts,
  validateExternalLinkCounts,
  validateInternalHrefsExist,
  validateBlogIndexLinks,
  validateBlogPostLinks,
  validateWordCount,
  validateKeywordDensity,
} from './rules';

export interface PageValidationInput {
  slug: string;
  html: string;
  pageType: string;
  primaryKeyword?: string;
}

/**
 * Validate a single page
 */
export function validatePage(
  input: PageValidationInput,
  blueprint: Blueprint
): ValidationReport {
  const errors: ValidationReport['hard_failures'] = [];
  const warnings: ValidationReport['warnings'] = [];
  
  const pageType = input.pageType as any;
  const page = blueprint.pages.find(p => p.slug === input.slug);
  
  // Hard failures
  const placeholderError = validateNoPlaceholdersRemain(input.html, input.slug);
  if (placeholderError) errors.push(placeholderError);
  
  const internalLinkError = validateInternalLinkCounts(input.html, input.slug, pageType, blueprint);
  if (internalLinkError) errors.push(internalLinkError);
  
  const externalLinkError = validateExternalLinkCounts(input.html, input.slug, pageType);
  if (externalLinkError) errors.push(externalLinkError);
  
  const hrefError = validateInternalHrefsExist(input.html, input.slug, blueprint);
  if (hrefError) errors.push(hrefError);
  
  const blogIndexError = validateBlogIndexLinks(input.html, input.slug, blueprint);
  if (blogIndexError) errors.push(blogIndexError);
  
  const blogPostError = validateBlogPostLinks(input.html, input.slug, blueprint);
  if (blogPostError) errors.push(blogPostError);
  
  // Soft warnings
  const wordCountWarning = validateWordCount(input.html, input.slug, pageType);
  if (wordCountWarning) warnings.push(wordCountWarning);
  
  if (input.primaryKeyword) {
    const keywordWarning = validateKeywordDensity(input.html, input.slug, pageType, input.primaryKeyword);
    if (keywordWarning) warnings.push(keywordWarning);
  }
  
  return {
    hard_failures: errors,
    warnings,
    needs_regen_pages: errors.length > 0 ? [input.slug] : [],
    pass: errors.length === 0,
  };
}

/**
 * Validate all pages
 */
export function validateAllPages(
  pages: Array<PageValidationInput>,
  blueprint: Blueprint
): ValidationReport {
  const allErrors: ValidationReport['hard_failures'] = [];
  const allWarnings: ValidationReport['warnings'] = [];
  const needsRegen: string[] = [];
  
  for (const page of pages) {
    const report = validatePage(page, blueprint);
    
    allErrors.push(...report.hard_failures);
    allWarnings.push(...report.warnings);
    
    if (report.hard_failures.length > 0) {
      needsRegen.push(page.slug);
    }
  }
  
  return {
    hard_failures: allErrors,
    warnings: allWarnings,
    needs_regen_pages: needsRegen,
    pass: allErrors.length === 0,
  };
}

/**
 * Validate pages from files on disk
 */
export async function validatePagesFromFiles(
  outputDirectory: string,
  blueprint: Blueprint
): Promise<ValidationReport> {
  const pagesFinalDir = join(outputDirectory, 'pages_final');
  const files = await fs.readdir(pagesFinalDir);
  
  const pages: Array<PageValidationInput> = [];
  
  for (const file of files) {
    if (!file.endsWith('.html')) continue;
    
    const html = await fs.readFile(join(pagesFinalDir, file), 'utf-8');
    
    // Find matching page by reconstructing slug from filename
    const page = blueprint.pages.find(p => {
      const expectedFilename = p.slug === '/' 
        ? 'index.html' 
        : `${p.slug.replace(/^\//, '').replace(/\//g, '-')}.html`;
      return expectedFilename === file;
    });
    
    if (!page) {
      console.warn(`Warning: No blueprint page found for file ${file}`);
      continue;
    }
    
    pages.push({
      slug: page.slug,
      html,
      pageType: page.page_type,
      primaryKeyword: page.primary_keyword,
    });
  }
  
  return validateAllPages(pages, blueprint);
}

