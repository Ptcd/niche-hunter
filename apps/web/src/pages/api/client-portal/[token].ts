/**
 * GET /api/client-portal/[token]
 * 
 * Public API for client portal access (no auth required).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query;

  if (typeof token !== 'string') {
    return res.status(400).json({ error: 'Invalid token' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const site = await prisma.site.findUnique({
      where: { publicToken: token },
      include: {
        metrics: {
          where: {
            date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
    });

    if (!site) {
      return res.status(404).json({ error: 'Portal not found' });
    }

    const calls30d = site.metrics.reduce((sum, m) => sum + m.calls, 0);
    const formLeads30d = site.metrics.reduce((sum, m) => sum + m.formLeads, 0);
    const gscClicks30d = site.metrics.reduce((sum, m) => sum + m.clicks, 0);
    const impressions30d = site.metrics.reduce((sum, m) => sum + m.impressions, 0);

    // Get average position
    const positions = site.metrics
      .filter((m) => m.avgPosition !== null)
      .map((m) => m.avgPosition!);
    const avgPosition30d = positions.length > 0
      ? positions.reduce((sum, p) => sum + p, 0) / positions.length
      : null;

    return res.status(200).json({
      site: {
        siteName: site.siteName,
        city: site.city,
        state: site.state,
        domain: site.domain,
      },
      metrics: {
        calls30d,
        formLeads30d,
        gscClicks30d,
        impressions30d,
        avgPosition30d,
      },
      keywords: [], // TODO: fetch from GSC or keyword tracking
    });
  } catch (error: any) {
    console.error('[client-portal] error:', error);
    return res.status(500).json({ error: error.message });
  }
}

