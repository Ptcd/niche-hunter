/**
 * POST /api/v2/sites/[siteId]/build-deterministic
 * 
 * Build a complete site using deterministic generator (v2 pipeline)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma, PageType, PageStatus } from '@niche-hunter/db';
import { inngest } from '@/lib/inngest/client';
import { generateSiteDeterministic } from '@niche-hunter/deterministic-generator';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

/**
 * Parse filename to slug (handles index.html -> /)
 */
function fileToSlug(filename: string): string {
  const fileBase = filename.replace('.html', '');
  return fileBase === 'index' ? '/' : '/' + fileBase;
}

/**
 * Map v2 page type to database PageType enum
 */
function mapPageType(v2Type: string): PageType {
  switch (v2Type) {
    case 'home': return PageType.HOME;
    case 'service': return PageType.CORE_SERVICE;
    case 'city': return PageType.CITY;
    case 'about': return PageType.ABOUT;
    case 'contact': return PageType.CONTACT;
    case 'terms': return PageType.LEGAL;
    case 'blog_index': return PageType.SUPPORT;
    case 'blog_post': return PageType.SUPPORT;
    default: return PageType.SUPPORT;
  }
}

/**
 * Save generated pages to the database
 */
async function savePagesToDB(
  siteId: string, 
  outputDirectory: string, 
  blueprint: any
): Promise<number> {
  let savedCount = 0;
  
  try {
    const finalPagesDir = join(outputDirectory, 'pages_final');
    const files = await fs.readdir(finalPagesDir);
    
    for (const file of files) {
      if (!file.endsWith('.html')) continue;
      
      // Get slug from filename (e.g., "hvac-wesley-chapel-fl.html" -> "/hvac-wesley-chapel-fl")
      const fileBase = file.replace('.html', '');
      let slug = fileBase === 'index' ? '/' : '/' + fileBase;
      
      // Find page info from blueprint
      const blueprintPage = blueprint.pages.find((p: any) => p.slug === slug);
      if (!blueprintPage) {
        console.warn(`[SaveToDB] Page ${slug} not found in blueprint, skipping`);
        continue;
      }
      
      // Read HTML content
      const htmlContent = await fs.readFile(join(finalPagesDir, file), 'utf-8');
      
      // Extract H1 from HTML (simple regex)
      const h1Match = htmlContent.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      const h1 = h1Match ? h1Match[1].trim() : blueprintPage.primary_keyword || slug;
      
      // Map page type
      const pageType = mapPageType(blueprintPage.page_type);
      
      // Upsert page record
      await prisma.sitePage.upsert({
        where: {
          siteId_slug: {
            siteId,
            slug,
          },
        },
        update: {
          htmlDraft: htmlContent,
          status: PageStatus.DRAFT,
          contentStatus: 'draft_generated',
          latestGenerationAt: new Date(),
          h1,
          focusKeyword: blueprintPage.primary_keyword || slug,
        },
        create: {
          siteId,
          slug,
          pageType,
          titleTag: h1,
          h1,
          focusKeyword: blueprintPage.primary_keyword || slug,
          supportingKeywords: blueprintPage.semantic_keywords || [],
          internalLinks: blueprintPage.can_link_to || [],
          htmlDraft: htmlContent,
          status: PageStatus.DRAFT,
          contentStatus: 'draft_generated',
          latestGenerationAt: new Date(),
        },
      });
      
      savedCount++;
      console.log(`[SaveToDB] Saved page: ${slug}`);
    }
  } catch (error: any) {
    console.error('[SaveToDB] Error saving pages:', error.message);
  }
  
  return savedCount;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { siteId } = req.query;
  const { publishMode = 'skip', model = 'gpt-4o-mini', temperature = 0.7, batch = 'auto', clearOldPages = false } = req.body;

  if (typeof siteId !== 'string') {
    return res.status(400).json({ error: 'Invalid site ID' });
  }

  try {
    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Determine output directory (use consistent path)
    const outputDirectory = join(os.tmpdir(), `niche-hunter-sites`, siteId);
    await fs.mkdir(outputDirectory, { recursive: true });

    // Load blueprint to determine which pages to build
    let blueprint: any = null;
    let allPageSlugs: string[] = [];
    try {
      const blueprintPath = join(outputDirectory, 'blueprint.json');
      const blueprintData = await fs.readFile(blueprintPath, 'utf-8');
      blueprint = JSON.parse(blueprintData);
      allPageSlugs = blueprint.pages.map((p: any) => p.slug);
    } catch (error) {
      // Blueprint doesn't exist yet, need to generate it first
      console.log(`[API] Blueprint not found, generating initial setup...`);
      
      // Generate blueprint and initial setup (but don't build pages yet)
      await generateSiteDeterministic(siteId, {
        model,
        temperature,
        seed: undefined,
        prompt_version: 'v1.3',
        strictness_level: 'strict',
        output_directory: outputDirectory,
      }, {
        pagesToBuild: [], // Don't build any pages, just setup
      });
      
      // Reload blueprint
      const blueprintPath = join(outputDirectory, 'blueprint.json');
      const blueprintData = await fs.readFile(blueprintPath, 'utf-8');
      blueprint = JSON.parse(blueprintData);
      allPageSlugs = blueprint.pages.map((p: any) => p.slug);
    }

    // Optionally delete old legacy pages that aren't in the v2 blueprint
    if (clearOldPages) {
      console.log(`[API] Clearing old pages not in v2 blueprint...`);
      console.log(`[API] V2 blueprint slugs: ${allPageSlugs.join(', ')}`);
      
      // Normalize slugs to handle both formats (with/without leading slash)
      const normalizedV2Slugs = new Set<string>();
      for (const slug of allPageSlugs) {
        normalizedV2Slugs.add(slug.startsWith('/') ? slug : '/' + slug);
        normalizedV2Slugs.add(slug.startsWith('/') ? slug.slice(1) : slug);
      }
      
      // Get all current pages and delete those not in v2 blueprint
      const allCurrentPages = await prisma.sitePage.findMany({
        where: { siteId },
        select: { id: true, slug: true },
      });
      
      const pagesToDelete = allCurrentPages.filter(p => {
        const withSlash = p.slug.startsWith('/') ? p.slug : '/' + p.slug;
        const withoutSlash = p.slug.startsWith('/') ? p.slug.slice(1) : p.slug;
        return !normalizedV2Slugs.has(withSlash) && !normalizedV2Slugs.has(withoutSlash);
      });
      
      console.log(`[API] Pages to delete: ${pagesToDelete.map(p => p.slug).join(', ')}`);
      
      if (pagesToDelete.length > 0) {
        const deleteResult = await prisma.sitePage.deleteMany({
          where: {
            id: { in: pagesToDelete.map(p => p.id) },
          },
        });
        console.log(`[API] Deleted ${deleteResult.count} old pages`);
      }
    }

    // Determine which pages to build in this batch
    let pagesToBuild: string[] = [];
    
    if (batch === 'auto') {
      // Check DATABASE for existing v2 pages (not temp files - they don't persist!)
      // Only count pages that are in the v2 blueprint
      const existingDbPages = await prisma.sitePage.findMany({
        where: {
          siteId,
          slug: { in: allPageSlugs },  // Only count v2 blueprint pages
        },
        select: { slug: true, htmlDraft: true },
      });
      // Count pages that have content generated
      const builtPages = existingDbPages.filter(p => p.htmlDraft !== null);
      const existingPages = new Set(builtPages.map(p => p.slug.startsWith('/') ? p.slug : '/' + p.slug));
      
      console.log(`[API] Found ${existingPages.size} built pages in database (out of ${existingDbPages.length} total v2 pages): ${Array.from(existingPages).join(', ')}`);

      const remainingPages = allPageSlugs.filter(slug => !existingPages.has(slug));
      console.log(`[API] Remaining pages to build: ${remainingPages.join(', ')}`);
      
      // Batch 1: Core pages (home, about, contact, terms) - 4 pages
      const corePages = remainingPages.filter(slug => 
        ['/', '/about', '/contact', '/terms'].includes(slug)
      );
      if (corePages.length > 0) {
        pagesToBuild = corePages.slice(0, 4);
      } else {
        // Batch 2: Service pages (identify by checking blueprint)
        const servicePageSlugs = blueprint.pages
          .filter((p: any) => p.page_type === 'service')
          .map((p: any) => p.slug);
        const servicePages = remainingPages.filter(slug => servicePageSlugs.includes(slug));
        if (servicePages.length > 0) {
          pagesToBuild = servicePages.slice(0, 2);
        } else {
          // Batch 3+: City pages (3 at a time)
          const cityPageSlugs = blueprint.pages
            .filter((p: any) => p.page_type === 'city')
            .map((p: any) => p.slug);
          const cityPages = remainingPages.filter(slug => cityPageSlugs.includes(slug));
          pagesToBuild = cityPages.slice(0, 3);
        }
      }
    } else if (batch === 'all') {
      // Build all remaining pages - check DATABASE
      const existingDbPages = await prisma.sitePage.findMany({
        where: {
          siteId,
          htmlDraft: { not: null },
        },
        select: { slug: true },
      });
      const existingPages = new Set(existingDbPages.map(p => p.slug.startsWith('/') ? p.slug : '/' + p.slug));
      pagesToBuild = allPageSlugs.filter(slug => !existingPages.has(slug));
    } else if (Array.isArray(batch)) {
      // Specific pages provided
      pagesToBuild = batch;
    }

    if (pagesToBuild.length === 0) {
      // All pages already built, but ensure they're in the database
      console.log(`[API] All pages built, syncing to database...`);
      const savedCount = await savePagesToDB(siteId, outputDirectory, blueprint);
      
      return res.status(200).json({
        status: 'complete',
        message: 'All pages have been built',
        totalPages: allPageSlugs.length,
        builtPages: allPageSlugs.length,
        savedToDb: savedCount,
      });
    }

    // Build the selected pages
    console.log(`[API] Building batch: ${pagesToBuild.join(', ')}`);
    const manifest = await generateSiteDeterministic(siteId, {
      model,
      temperature,
      seed: undefined,
      prompt_version: 'v1.3',
      strictness_level: 'strict',
      output_directory: outputDirectory,
    }, {
      pagesToBuild,
      skipExisting: true,
    });

    // Save generated pages to the database
    console.log(`[API] Saving pages to database...`);
    const savedCount = await savePagesToDB(siteId, outputDirectory, blueprint);
    console.log(`[API] Saved ${savedCount} pages to database`);

    // Count total built pages from DATABASE (not temp files)
    const builtDbPages = await prisma.sitePage.findMany({
      where: {
        siteId,
        htmlDraft: { not: null },
        slug: { in: allPageSlugs },
      },
      select: { slug: true },
    });
    const totalBuilt = builtDbPages.length;

    // Check if all v2 pages are built
    const isComplete = totalBuilt >= allPageSlugs.length;

    return res.status(200).json({
      status: isComplete ? 'complete' : 'partial',
      message: `Built ${pagesToBuild.length} pages in this batch`,
      batch: pagesToBuild,
      totalPages: allPageSlugs.length,
      builtPages: totalBuilt,
      remainingPages: allPageSlugs.length - totalBuilt,
      savedToDb: savedCount,
      manifest,
    });
  } catch (error: any) {
    console.error('[API] Failed to trigger site build:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

