/**
 * POST /api/v5000/sites/[siteId]/pages/[pageId]/set-image
 * 
 * Set hero image for a page
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../../../../lib/auth/withAuth';
import { prisma } from '@niche-hunter/db';
import { generateAltText } from '../../../../../../../lib/altTextGenerator';

async function handler(req: NextApiRequest & { auth: any }, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { siteId, pageId } = req.query;
  const { imageUrl, altText } = req.body;

  if (!siteId || typeof siteId !== 'string' || !pageId || typeof pageId !== 'string') {
    return res.status(400).json({ error: 'Invalid siteId or pageId' });
  }

  if (!imageUrl) {
    return res.status(400).json({ error: 'imageUrl is required' });
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
      pages: {
        where: { id: pageId },
      },
      niche: true,
    },
  });

  if (!site || site.pages.length === 0) {
    return res.status(404).json({ error: 'Site or page not found' });
  }

  const page = site.pages[0];

  // Generate alt text if not provided
  let finalAltText = altText;
  if (!finalAltText) {
    finalAltText = generateAltText({
      focusKeyword: page.focusKeyword,
      city: site.city,
      state: site.state,
      context: 'hero image',
    });
  }

  try {
    await prisma.sitePage.update({
      where: { id: pageId },
      data: {
        heroImageUrl: imageUrl,
        heroImageAlt: finalAltText,
      },
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[set-image] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to set image' });
  }
}

export default withAuth(handler);

