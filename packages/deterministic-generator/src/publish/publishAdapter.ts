/**
 * Publisher Adapter
 * 
 * Adapts pages_final/ artifacts to WordPress publish pipeline
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { Blueprint } from '../types';
import type { PageSpec } from '../../../apps/web/src/lib/wpFactoryTypes';

/**
 * Extract title from HTML (first H1 or fallback)
 */
function extractTitleFromHtml(html: string, fallback: string): string {
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }
  return fallback;
}

/**
 * Extract meta description from HTML or generate fallback
 */
function extractMetaDescription(html: string, fallback: string): string {
  const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (metaMatch) {
    return metaMatch[1].trim();
  }
  
  // Fallback: extract first paragraph
  const pMatch = html.match(/<p[^>]*>([^<]+)<\/p>/i);
  if (pMatch) {
    const text = pMatch[1].trim().replace(/\s+/g, ' ');
    return text.length > 160 ? text.substring(0, 157) + '...' : text;
  }
  
  return fallback;
}

/**
 * Map blueprint page type to WordPress PageSpec type
 */
function mapPageTypeToWordPress(pageType: string): string {
  const mapping: Record<string, string> = {
    'home': 'home',
    'service': 'service',
    'city': 'city',
    'about': 'about',
    'contact': 'contact',
    'terms': 'terms',
    'blog_index': 'blog',
    'blog_post': 'blog',
  };
  
  return mapping[pageType] || pageType;
}

/**
 * Convert HTML file to PageSpec
 */
function htmlToPageSpec(
  html: string,
  blueprintPage: Blueprint['pages'][0],
  businessName: string
): PageSpec {
  const slug = blueprintPage.slug;
  const pageType = mapPageTypeToWordPress(blueprintPage.page_type);
  
  // Generate title
  let title = '';
  if (blueprintPage.page_type === 'home') {
    title = `${businessName} | ${blueprintPage.primary_keyword || 'Local Services'}`;
  } else if (blueprintPage.page_type === 'service' && blueprintPage.service) {
    title = `${blueprintPage.service} in ${blueprintPage.city || 'Your Area'} | ${businessName}`;
  } else if (blueprintPage.page_type === 'city' && blueprintPage.city) {
    title = `${blueprintPage.service || 'Services'} in ${blueprintPage.city} | ${businessName}`;
  } else {
    title = extractTitleFromHtml(html, `${businessName} - ${slug}`);
  }
  
  // Extract or generate meta description
  const metaDescription = extractMetaDescription(
    html,
    `${businessName} provides ${blueprintPage.primary_keyword || 'professional services'} in your area.`
  );
  
  return {
    type: pageType,
    slug: slug === '/' ? '' : slug.replace(/^\//, ''),
    title,
    content: html,
    seoTitle: title,
    seoDescription: metaDescription,
    focusKeyword: blueprintPage.primary_keyword || '',
  };
}

/**
 * Load pages from pages_final/ directory
 */
export async function loadPagesFromArtifacts(
  outputDirectory: string,
  blueprint: Blueprint,
  businessName: string
): Promise<PageSpec[]> {
  const pagesFinalDir = join(outputDirectory, 'pages_final');
  const files = await fs.readdir(pagesFinalDir);
  
  const pageSpecs: PageSpec[] = [];
  
  for (const file of files) {
    if (!file.endsWith('.html')) continue;
    
    // Find matching blueprint page
    const blueprintPage = blueprint.pages.find(p => {
      const expectedFilename = p.slug === '/' 
        ? 'index.html' 
        : `${p.slug.replace(/^\//, '').replace(/\//g, '-')}.html`;
      return expectedFilename === file;
    });
    
    if (!blueprintPage) {
      console.warn(`Warning: No blueprint page found for file ${file}, skipping`);
      continue;
    }
    
    // Read HTML
    const html = await fs.readFile(join(pagesFinalDir, file), 'utf-8');
    
    // Convert to PageSpec
    const pageSpec = htmlToPageSpec(html, blueprintPage, businessName);
    pageSpecs.push(pageSpec);
  }
  
  return pageSpecs;
}

/**
 * Publish pages from artifacts to WordPress
 * 
 * This is a thin adapter that loads pages_final/ and calls the existing publish pipeline
 */
export async function publishFromArtifacts(
  siteId: string,
  outputDirectory: string,
  blueprint: Blueprint,
  publishStatus: 'draft' | 'publish' = 'draft'
): Promise<Array<{ pageId: string; success: boolean; error?: string; wpPageId?: number }>> {
  // Import the publish pipeline (dynamic import to avoid circular deps)
  const { publishSitePages } = await import('../../../apps/web/src/server/wp/publishPipeline');
  
  // Load site input for business name
  const siteInputPath = join(outputDirectory, 'site_input.json');
  let businessName = blueprint.site_meta.primary_service;
  
  try {
    const siteInputJson = await fs.readFile(siteInputPath, 'utf-8');
    const siteInput = JSON.parse(siteInputJson);
    businessName = siteInput.business_name || businessName;
  } catch (error) {
    console.warn('Could not load site_input.json, using fallback business name');
  }
  
  // Load pages from artifacts
  const pageSpecs = await loadPagesFromArtifacts(outputDirectory, blueprint, businessName);
  
  if (pageSpecs.length === 0) {
    throw new Error('No pages found in pages_final/ directory');
  }
  
  // Get site to build BrandSpec
  const { prisma } = await import('@niche-hunter/db');
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      niche: true,
    },
  });
  
  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }
  
  // Use WordPress client directly
  const { publishPages } = await import('../../../apps/web/src/lib/wpFactoryClient');
  
  if (!site.wpApiBase || !site.wpUser || !site.wpAppPassword) {
    throw new Error('Site missing WordPress configuration (wpApiBase, wpUser, wpAppPassword)');
  }
  
  // Publish pages with status and externalId
  const pageSpecsWithStatus = pageSpecs.map(spec => ({
    ...spec,
    externalId: spec.slug || 'home', // Use slug as externalId
    status: publishStatus,
  }));
  
  const results = await publishPages(
    pageSpecsWithStatus as any, // Type assertion needed due to externalId requirement
    site.wpApiBase,
    site.wpUser,
    site.wpAppPassword
  );
  
  return results.results.map((r: any) => ({
    pageId: r.externalId || r.slug || 'unknown',
    success: !!r.wpPageId,
    error: r.error,
    wpPageId: r.wpPageId ? (typeof r.wpPageId === 'number' ? r.wpPageId : parseInt(r.wpPageId)) : undefined,
  }));
}

