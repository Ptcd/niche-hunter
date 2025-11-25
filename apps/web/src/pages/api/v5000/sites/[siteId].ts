/**
 * GET /api/v5000/sites/[siteId]
 * 
 * Get site details with pages and skeletons.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { withAuth } from '../../../../lib/auth/withAuth';

async function handler(req: NextApiRequest & { auth: any }, res: NextApiResponse) {
  const { siteId } = req.query;

  if (typeof siteId !== 'string') {
    return res.status(400).json({ error: 'Invalid site ID' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate auth context
    if (!req.auth || !req.auth.currentAccountId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const site = await prisma.site.findFirst({
      where: { 
        id: siteId,
        accountId: req.auth.currentAccountId, // Filter by account
      },
      include: {
        niche: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        promptProfile: {
          select: {
            id: true,
            name: true,
          },
        },
        batch: {
          select: {
            id: true, // Need batchId for separate query
          },
        },
        pages: {
          orderBy: {
            orderIndex: 'asc',
          },
          select: {
            id: true,
            pageType: true,
            slug: true,
            titleTag: true,
            h1: true,
            focusKeyword: true,
            status: true,
            seoTitle: true,
            seoDescription: true,
            htmlDraft: true,
            htmlEdited: true,
            notesForGpt: true,
            wpPageId: true,
            wpPermalink: true,
            wpEditUrl: true,
            latestPublishedAt: true,
          },
        },
      },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Fetch keywords with metrics and aggregate by base keyword (sorted by volume)
    const keywords: string[] = [];
    if (site.batch?.id) {
      const batchKeywords = await prisma.keywordV5000.findMany({
        where: { 
          batchId: site.batch.id, 
          isSkipped: false 
        },
        include: {
          nicheKeyword: { 
            select: { keyword: true } 
          },
          metrics: { 
            select: { searchVolume: true } 
          },
        },
      });

      // Aggregate volume by base keyword
      const keywordVolumes = new Map<string, number>();
      for (const kw of batchKeywords) {
        const baseKeyword = kw.nicheKeyword?.keyword;
        if (!baseKeyword) continue;
        
        const volume = kw.metrics?.searchVolume || 0;
        keywordVolumes.set(baseKeyword, (keywordVolumes.get(baseKeyword) || 0) + volume);
      }

      // Sort by volume (descending), take top 3
      const topKeywords = [...keywordVolumes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([kw]) => kw);
      
      keywords.push(...topKeywords);
    }

    // Return site with keywords array
    return res.status(200).json({
      ...site,
      keywords,
    });
  } catch (error: any) {
    console.error('Error fetching site:', error);
    console.error('Error stack:', error?.stack);
    return res.status(500).json({
      error: error.message || 'Failed to fetch site',
    });
  }
}

export default withAuth(handler);

