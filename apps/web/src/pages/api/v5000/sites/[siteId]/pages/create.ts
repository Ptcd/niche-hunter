/**
 * POST /api/v5000/sites/[siteId]/pages/create
 * 
 * Create a new page for a site
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../../../../lib/auth/withAuth';
import { prisma } from '@niche-hunter/db';
import { PageType } from '@prisma/client';

async function handler(req: NextApiRequest & { auth: any }, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { siteId } = req.query;
  const { pageType, focusKeyword, slug } = req.body;

  if (!siteId || typeof siteId !== 'string') {
    return res.status(400).json({ error: 'Invalid siteId' });
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
  });

  if (!site) {
    return res.status(404).json({ error: 'Site not found' });
  }

  // Validate pageType
  if (!pageType || !Object.values(PageType).includes(pageType)) {
    return res.status(400).json({ error: 'Invalid pageType' });
  }

  // Generate slug if not provided
  let finalSlug = slug;
  if (!finalSlug) {
    if (pageType === PageType.HOME) {
      finalSlug = '';
    } else if (focusKeyword) {
      finalSlug = focusKeyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    } else {
      finalSlug = pageType.toLowerCase().replace(/_/g, '-');
    }
  }

  // Check if slug already exists
  const existingPage = await prisma.sitePage.findFirst({
    where: {
      siteId,
      slug: finalSlug,
    },
  });

  if (existingPage) {
    return res.status(400).json({ error: `Page with slug "${finalSlug}" already exists` });
  }

  // Create page
  try {
    const page = await prisma.sitePage.create({
      data: {
        siteId,
        pageType: pageType as PageType,
        slug: finalSlug,
        titleTag: focusKeyword || pageType,
        h1: focusKeyword || pageType,
        focusKeyword: focusKeyword || '',
        keyword: focusKeyword || '',
        status: 'DRAFT',
        contentStatus: 'not_started',
      },
    });

    return res.status(201).json({ page });
  } catch (error: any) {
    console.error('[create-page] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create page' });
  }
}

export default withAuth(handler);

