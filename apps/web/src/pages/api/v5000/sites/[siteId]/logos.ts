/**
 * GET /api/v5000/sites/[siteId]/logos
 * 
 * Get all logos for a site
 * 
 * PUT /api/v5000/sites/[siteId]/logos
 * 
 * Set active logo
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../../lib/auth/withAuth';
import { prisma } from '@niche-hunter/db';

async function handler(req: NextApiRequest & { auth: any }, res: NextApiResponse) {
  const { siteId } = req.query;

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

  if (req.method === 'GET') {
    // Get all logos for this site
    const logos = await prisma.siteLogo.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ logos });
  }

  if (req.method === 'PUT') {
    // Set active logo
    const { logoId } = req.body;

    if (!logoId || typeof logoId !== 'string') {
      return res.status(400).json({ error: 'Invalid logoId' });
    }

    // Verify logo belongs to this site
    const logo = await prisma.siteLogo.findFirst({
      where: {
        id: logoId,
        siteId,
      },
    });

    if (!logo) {
      return res.status(404).json({ error: 'Logo not found' });
    }

    // Deactivate all logos
    await prisma.siteLogo.updateMany({
      where: { siteId },
      data: { isActive: false },
    });

    // Activate selected logo
    await prisma.siteLogo.update({
      where: { id: logoId },
      data: { isActive: true },
    });

    // Update site logoUrl for backwards compatibility
    await prisma.site.update({
      where: { id: siteId },
      data: { logoUrl: logo.logoUrl },
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);

