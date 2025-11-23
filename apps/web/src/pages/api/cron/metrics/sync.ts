/**
 * POST /api/cron/metrics/sync
 * 
 * Cron job to sync metrics for all sites.
 * Should be called daily (e.g., via Vercel Cron).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { syncAllCallMetrics } from '../../../../server/integrations/twilio';
import { syncAllGSCMetrics } from '../../../../server/integrations/searchConsole';
import { syncAllVoipmsMetrics } from '../../../../server/integrations/voipms';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const results = {
      calls: [] as any[],
      gsc: [] as any[],
    };

    // Sync Twilio calls
    try {
      const callResults = await syncAllCallMetrics();
      results.calls = callResults;
    } catch (error: any) {
      console.error('[cron-metrics] Error syncing calls:', error);
      results.calls = [{ error: error.message }];
    }

    // Sync Search Console
    try {
      const gscResults = await syncAllGSCMetrics();
      results.gsc = gscResults;
    } catch (error: any) {
      console.error('[cron-metrics] Error syncing GSC:', error);
      results.gsc = [{ error: error.message }];
    }

    // Sync VoIP.ms calls
    try {
      const voipmsResults = await syncAllVoipmsMetrics();
      results.voipms = voipmsResults;
    } catch (error: any) {
      console.error('[cron-metrics] Error syncing VoIP.ms:', error);
      results.voipms = [{ error: error.message }];
    }

    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error('[cron-metrics] Error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}

