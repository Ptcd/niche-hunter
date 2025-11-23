/**
 * POST /api/v5000/sites/build
 * 
 * Creates a new site from a batch + city combination.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { SiteStatus } from '@prisma/client';
import { withAuth } from '../../../../lib/auth/withAuth';

async function handler(req: NextApiRequest & { auth: any }, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { batchId, niche, city, state, leadValue } = req.body;

    // Validate inputs
    if (!batchId || !niche || !city || !state || leadValue === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: batchId, niche, city, state, leadValue',
      });
    }

    // Verify batch exists, belongs to account, and has keywords
    const batch = await prisma.scanBatch.findFirst({
      where: {
        id: batchId,
        accountId: req.auth.currentAccountId,
      },
      include: {
        niche: true,
        keywords: {
          where: {
            isSkipped: false,
            city: {
              city,
              state,
            },
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    if (batch.keywords.length === 0) {
      return res.status(400).json({
        error: `No keywords found for ${city}, ${state} in this batch`,
      });
    }

    // Check if site already exists for this batch+city+account
    const existingSite = await prisma.site.findFirst({
      where: {
        batchId,
        accountId: req.auth.currentAccountId,
        city,
        state,
      },
    });

    if (existingSite) {
      // Return the existing site ID so frontend can navigate to it
      return res.status(200).json({
        siteId: existingSite.id,
        message: 'Site already exists',
        existing: true,
      });
    }

    // Create site with accountId
    const site = await prisma.site.create({
      data: {
        batchId,
        accountId: req.auth.currentAccountId,
        nicheId: batch.nicheId,
        city,
        state,
        leadValue: parseFloat(leadValue),
        status: SiteStatus.SETUP,
      },
    });

    return res.status(201).json({
      siteId: site.id,
      message: 'Site created successfully',
    });
  } catch (error: any) {
    console.error('Error creating site:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create site',
    });
  }
}

export default withAuth(handler);

