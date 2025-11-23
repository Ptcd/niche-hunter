/**
 * POST /api/cron/alerts/check
 * 
 * Cron job to check for alerts on all sites.
 * Should be called daily (e.g., via Vercel Cron).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { checkAllAlerts } from '../../../../server/alerts/checkAlerts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const results = await checkAllAlerts();

    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error('[cron-alerts] Error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}

