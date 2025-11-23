/**
 * POST /api/v5000/sites/[siteId]/generate-content
 * 
 * Generate content for pages using GPT.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { generatePageContent } from '@niche-hunter/core';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { siteId } = req.query;

  if (typeof siteId !== 'string') {
    return res.status(400).json({ error: 'Invalid site ID' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mode, pageId } = req.body;

    if (mode !== 'all' && mode !== 'page') {
      return res.status(400).json({ error: 'mode must be "all" or "page"' });
    }

    if (mode === 'page' && !pageId) {
      return res.status(400).json({ error: 'pageId required when mode is "page"' });
    }

    // Get site
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Get pages to generate
    const pages = await prisma.sitePage.findMany({
      where: {
        siteId,
        ...(mode === 'page' ? { id: pageId } : {}),
        contentStatus: { in: ['skeleton_ready', 'not_started'] },
      },
    });

    if (pages.length === 0) {
      return res.status(400).json({ error: 'No pages to generate content for' });
    }

    const results: Array<{ pageId: string; success: boolean; error?: string }> = [];

    // Generate content for each page
    for (const page of pages) {
      try {
        const content = await generatePageContent(siteId, page.id);

        // Save generated content
        await prisma.sitePage.update({
          where: { id: page.id },
          data: {
            generatedContent: content,
            contentStatus: 'draft_generated',
          },
        });

        results.push({ pageId: page.id, success: true });
      } catch (error: any) {
        console.error(`Error generating content for page ${page.id}:`, error);
        results.push({
          pageId: page.id,
          success: false,
          error: error.message || 'Unknown error',
        });

        // Update page status to error
        await prisma.sitePage.update({
          where: { id: page.id },
          data: {
            contentStatus: 'error',
          },
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return res.status(200).json({
      message: `Generated content for ${successCount} page(s), ${failCount} failed`,
      results,
    });
  } catch (error: any) {
    console.error('Error generating content:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate content',
    });
  }
}

