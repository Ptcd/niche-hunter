/**
 * GET /api/v5000/sites/[siteId]/pages/[pageId]/search-images
 * 
 * Search Unsplash for images based on page keywords
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../../../../../../lib/auth/withAuth';
import { prisma } from '@niche-hunter/db';
import { searchUnsplashPhotos } from '../../../../../../../../../lib/unsplashClient';

async function handler(req: NextApiRequest & { auth: any }, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { siteId, pageId } = req.query;
  const { query, perPage } = req.query;

  if (!siteId || typeof siteId !== 'string' || !pageId || typeof pageId !== 'string') {
    return res.status(400).json({ error: 'Invalid siteId or pageId' });
  }

  // Validate auth context
  if (!req.auth || !req.auth.currentAccountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify site belongs to account
  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      accountId: req.auth.currentAccountId,
    },
    include: {
      niche: true,
      pages: {
        where: { id: pageId },
      },
    },
  });

  if (!site || site.pages.length === 0) {
    return res.status(404).json({ error: 'Site or page not found' });
  }

  const page = site.pages[0];
  
  // Build search query from page keywords or use provided query
  const searchQuery = (query as string) || 
    `${page.focusKeyword} ${site.niche.name} ${site.city}` ||
    `${site.niche.name} professional`;

  try {
    const photos = await searchUnsplashPhotos(
      searchQuery,
      perPage ? parseInt(perPage as string) : 8
    );

    return res.status(200).json({ photos });
  } catch (error: any) {
    console.error('[search-images] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to search images' });
  }
}

export default withAuth(handler);

