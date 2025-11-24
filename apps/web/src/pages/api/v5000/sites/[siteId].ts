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
    const site = await prisma.site.findFirst({
      where: { 
        id: siteId,
        accountId: req.auth.currentAccountId, // Filter by account
      },
      include: {
        niche: true,
        promptProfile: true, // Add promptProfile for frontend
        pages: {
          include: {
            skeletons: {
              orderBy: {
                orderIndex: 'asc',
              },
            },
          },
          orderBy: {
            orderIndex: 'asc',
          },
          select: {
            id: true,
            pageType: true,
            slug: true,
            titleTag: true,
            focusKeyword: true,
            status: true,
            wpPageId: true,
            wpPermalink: true,
            wpEditUrl: true,
            latestPublishedAt: true,
            skeletons: {
              orderBy: {
                orderIndex: 'asc',
              },
            },
          },
        },
      },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    return res.status(200).json(site);
  } catch (error: any) {
    console.error('Error fetching site:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch site',
    });
  }
}

export default withAuth(handler);

