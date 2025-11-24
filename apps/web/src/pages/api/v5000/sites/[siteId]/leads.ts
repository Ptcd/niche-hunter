/**
 * GET /api/v5000/sites/[siteId]/leads
 * 
 * Get leads for a site.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { withAuth } from '../../../../../lib/auth/withAuth';

async function handler(req: NextApiRequest & { auth: any }, res: NextApiResponse) {
  const { siteId } = req.query;

  if (typeof siteId !== 'string') {
    return res.status(400).json({ error: 'Invalid site ID' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify site belongs to account
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        accountId: req.auth.currentAccountId,
      },
      select: { id: true },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const leads = await prisma.lead.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.status(200).json({ leads });
  } catch (error: any) {
    console.error('[leads-api] error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default withAuth(handler);

