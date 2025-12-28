/**
 * POST /api/v2/sites/[siteId]/build-deterministic
 * 
 * Build a complete site using deterministic generator (v2 pipeline)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { inngest } from '@/lib/inngest/client';
import { generateSiteDeterministic } from '@niche-hunter/deterministic-generator';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { siteId } = req.query;
  const { publishMode = 'skip', model = 'gpt-4o-mini', temperature = 0.7, batch = 'auto' } = req.body;

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

    // Determine which pages to build in this batch
    let pagesToBuild: string[] = [];
    
    if (batch === 'auto') {
      // Auto-detect next batch to build
      const existingPages = new Set<string>();
      try {
        const finalPagesDir = join(outputDirectory, 'pages_final');
        const files = await fs.readdir(finalPagesDir);
        for (const file of files) {
          if (file.endsWith('.html')) {
            const slug = '/' + file.replace('.html', '');
            existingPages.add(slug);
          }
        }
      } catch (error) {
        // Directory doesn't exist yet
      }

      const remainingPages = allPageSlugs.filter(slug => !existingPages.has(slug));
      
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
      // Build all remaining pages
      const existingPages = new Set<string>();
      try {
        const finalPagesDir = join(outputDirectory, 'pages_final');
        const files = await fs.readdir(finalPagesDir);
        for (const file of files) {
          if (file.endsWith('.html')) {
            const slug = '/' + file.replace('.html', '');
            existingPages.add(slug);
          }
        }
      } catch (error) {
        // Directory doesn't exist yet
      }
      pagesToBuild = allPageSlugs.filter(slug => !existingPages.has(slug));
    } else if (Array.isArray(batch)) {
      // Specific pages provided
      pagesToBuild = batch;
    }

    if (pagesToBuild.length === 0) {
      return res.status(200).json({
        status: 'complete',
        message: 'All pages have been built',
        totalPages: allPageSlugs.length,
        builtPages: allPageSlugs.length,
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

    // Count total built pages
    let totalBuilt = 0;
    try {
      const finalPagesDir = join(outputDirectory, 'pages_final');
      const files = await fs.readdir(finalPagesDir);
      totalBuilt = files.filter(f => f.endsWith('.html')).length;
    } catch (error) {
      totalBuilt = pagesToBuild.length;
    }

    return res.status(200).json({
      status: 'partial',
      message: `Built ${pagesToBuild.length} pages in this batch`,
      batch: pagesToBuild,
      totalPages: allPageSlugs.length,
      builtPages: totalBuilt,
      remainingPages: allPageSlugs.length - totalBuilt,
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

