/**
 * POST /api/cron/health/check
 * 
 * Cron job to check health of all live sites.
 * Should be called hourly (e.g., via Vercel Cron).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma, SiteStatus } from '@niche-hunter/db';
import { checkSiteHealth, createHealthAlert } from '../../../../server/health/checkHealth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sites = await prisma.site.findMany({
    where: {
      status: SiteStatus.LIVE,
      domain: { not: null },
    },
    select: { id: true },
  });

  const results = [];
  for (const site of sites) {
    try {
      const health = await checkSiteHealth(site.id);
      
      await prisma.site.update({
        where: { id: site.id },
        data: {
          lastHealthCheckAt: new Date(),
          healthStatus: health.isUp ? 'healthy' : 'down',
        },
      });

      if (!health.isUp) {
        await createHealthAlert(site.id, `Site is down: ${health.error || 'Connection failed'}`);
      }

      results.push({ siteId: site.id, status: health.isUp ? 'up' : 'down', responseTime: health.responseTime });
    } catch (error: any) {
      results.push({ siteId: site.id, error: error.message });
    }
  }

  return res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    results 
  });
}

