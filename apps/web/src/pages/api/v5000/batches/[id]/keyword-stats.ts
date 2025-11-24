import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { KeywordType } from '../../../../../lib/keyword-classifier';

/**
 * Get keyword statistics for a batch (local vs national, by type)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Batch ID is required' });
  }

  try {
    // Get batch
    const batch = await prisma.scanBatch.findUnique({
      where: { id },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Get all keywords for this niche
    const allKeywords = await prisma.nicheKeyword.findMany({
      where: {
        nicheId: batch.nicheId,
        isActive: true,
      },
    });

    // Count by scope and type
    const stats = {
      local: {
        total: 0,
        money: 0,
        supporting: 0,
        informational: 0,
        other: 0,
      },
      national: {
        total: 0,
        money: 0,
        supporting: 0,
        informational: 0,
        other: 0,
      },
    };

    for (const nk of allKeywords) {
      const scope = nk.scope || 'local'; // Default to local if not set
      const type = (nk.keywordType || 'other') as KeywordType;

      if (scope === 'local' || scope === null) {
        stats.local.total++;
        if (type === 'money') stats.local.money++;
        else if (type === 'supporting') stats.local.supporting++;
        else if (type === 'informational') stats.local.informational++;
        else stats.local.other++;
      } else if (scope === 'national') {
        stats.national.total++;
        if (type === 'money') stats.national.money++;
        else if (type === 'supporting') stats.national.supporting++;
        else if (type === 'informational') stats.national.informational++;
        else stats.national.other++;
      }
    }

    return res.status(200).json(stats);
  } catch (error: any) {
    console.error('❌ [KEYWORD-STATS] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch keyword stats',
    });
  }
}

