/**
 * POST /api/v5000/sites/[siteId]/sync-content
 * 
 * Sync content from Google Sheet or DB to WordPress.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { createWPPage, updateWPPage, addJSONLD, generateLocalBusinessSchema } from '@niche-hunter/core';
import { readContentFromSheet } from '@niche-hunter/core';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { siteId } = req.query;

  if (typeof siteId !== 'string') {
    return res.status(400).json({ error: 'Invalid site ID' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pageIds, source = 'db' } = req.body; // source: 'db' | 'sheet'

    // Get site
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: {
        niche: true,
      },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    if (!site.wpBaseUrl) {
      return res.status(400).json({ error: 'WordPress URL not configured' });
    }

    // Get WordPress credentials (from env or site config)
    const wpUsername = process.env.WORDPRESS_USERNAME || 'admin';
    const wpPassword = process.env.WORDPRESS_APP_PASSWORD || '';

    if (!wpPassword) {
      return res.status(400).json({ error: 'WordPress credentials not configured' });
    }

    const wpConfig = {
      baseUrl: site.wpBaseUrl,
      username: wpUsername,
      password: wpPassword,
    };

    // Get pages to sync
    const pages = await prisma.sitePage.findMany({
      where: {
        siteId,
        ...(pageIds && Array.isArray(pageIds) ? { id: { in: pageIds } } : {}),
        contentStatus: { in: ['draft_generated', 'ready_to_publish'] },
      },
    });

    if (pages.length === 0) {
      return res.status(400).json({ error: 'No pages ready to sync' });
    }

    // Read content from sheet if source is 'sheet'
    const sheetContent = source === 'sheet' && site.sheetId
      ? await readContentFromSheet(site.sheetId)
      : new Map<string, string>();

    const results: Array<{ pageId: string; wpPageId?: string; success: boolean; error?: string }> = [];

    // Sync each page
    for (const page of pages) {
      try {
        // Get content
        let content = page.generatedContent || '';
        
        if (source === 'sheet' && sheetContent.has(page.id)) {
          content = sheetContent.get(page.id) || '';
        }

        if (!content) {
          results.push({
            pageId: page.id,
            success: false,
            error: 'No content available',
          });
          continue;
        }

        // Add JSON-LD schema
        const schema = generateLocalBusinessSchema(site);
        content = addJSONLD(content, schema);

        // Create or update WP page
        let wpPageId = page.wpPageId;

        if (wpPageId) {
          // Update existing page
          await updateWPPage(wpConfig, String(wpPageId), content, page.titleTag, page.slug);
        } else {
          // Create new page
          const newWpPageId = await createWPPage(wpConfig, page.slug, page.titleTag, content, 'publish');
          wpPageId = parseInt(newWpPageId, 10);
          
          // Save WP page ID
          await prisma.sitePage.update({
            where: { id: page.id },
            data: { wpPageId },
          });
        }

        // Update page status
        await prisma.sitePage.update({
          where: { id: page.id },
          data: {
            contentStatus: 'published',
          },
        });

        results.push({
          pageId: page.id,
          wpPageId,
          success: true,
        });
      } catch (error: any) {
        console.error(`Error syncing page ${page.id}:`, error);
        results.push({
          pageId: page.id,
          success: false,
          error: error.message || 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return res.status(200).json({
      message: `Synced ${successCount} page(s) to WordPress, ${failCount} failed`,
      results,
    });
  } catch (error: any) {
    console.error('Error syncing content:', error);
    return res.status(500).json({
      error: error.message || 'Failed to sync content',
    });
  }
}

