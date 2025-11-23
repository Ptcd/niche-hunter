import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { processBatch } from '../../../../lib/v5000-processor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid batch ID' });
  }

  if (req.method === 'GET') {
    try {
      const batch = await prisma.scanBatch.findUnique({
        where: { id },
        include: {
          niche: {
            include: {
              keywords: true,
            },
          },
          keywords: {
            where: { isSkipped: false },
            include: {
              city: true,
              nicheKeyword: true,
              metrics: true,
              serpSnapshot: true,
              difficultyScore: true,
            },
          },
        },
      });

      if (!batch) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      // Add lead value from city (from CSV)
      const keywordsWithLeadValue = batch.keywords.map((kw) => {
        return {
          ...kw,
          leadValue: kw.city.payout,
        };
      });

      return res.status(200).json({
        ...batch,
        keywords: keywordsWithLeadValue,
      });
    } catch (error: any) {
      console.error('Error fetching batch:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch batch' });
    }
  }

  if (req.method === 'POST') {
    const { action } = req.body;

    if (action === 'cancel') {
      // Cancel a running batch
      try {
        const batch = await prisma.scanBatch.findUnique({
          where: { id },
        });

        if (!batch) {
          return res.status(404).json({ error: 'Batch not found' });
        }

        if (batch.status !== 'running' && batch.status !== 'queued') {
          return res.status(400).json({ error: `Cannot cancel batch with status: ${batch.status}` });
        }

        await prisma.scanBatch.update({
          where: { id },
          data: {
            cancelledAt: new Date(),
            status: 'cancelled',
          },
        });

        return res.status(200).json({ message: 'Batch cancelled', batchId: id });
      } catch (error: any) {
        console.error('Error cancelling batch:', error);
        return res.status(500).json({ error: error.message });
      }
    } else {
      // Manual trigger for processing stuck batches
      try {
        const batch = await prisma.scanBatch.findUnique({
          where: { id },
        });

        if (!batch) {
          return res.status(404).json({ error: 'Batch not found' });
        }

        if (batch.status === 'running') {
          return res.status(400).json({ error: 'Batch is already running' });
        }

        // Trigger processing
        processBatch(id).catch((error) => {
          console.error(`Manual processing trigger failed for batch ${id}:`, error);
        });

        return res.status(200).json({ message: 'Processing triggered', batchId: id });
      } catch (error: any) {
        console.error('Error triggering processing:', error);
        return res.status(500).json({ error: error.message });
      }
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


