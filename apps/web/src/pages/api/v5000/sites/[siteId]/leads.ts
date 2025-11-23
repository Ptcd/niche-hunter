/**
 * GET /api/v5000/sites/[siteId]/leads
 * 
 * Get leads for a site.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { siteId } = req.query;

  if (typeof siteId !== 'string') {
    return res.status(400).json({ error: 'Invalid site ID' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

