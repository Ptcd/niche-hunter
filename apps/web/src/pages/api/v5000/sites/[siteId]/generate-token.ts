/**
 * POST /api/v5000/sites/[siteId]/generate-token
 * 
 * Generate a public token for client portal access.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { randomBytes } from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { siteId } = req.query;

  if (typeof siteId !== 'string') {
    return res.status(400).json({ error: 'Invalid site ID' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const publicToken = randomBytes(32).toString('hex');

    await prisma.site.update({
      where: { id: siteId },
      data: { publicToken },
    });

    return res.status(200).json({ publicToken });
  } catch (error: any) {
    console.error('[generate-token] error:', error);
    return res.status(500).json({ error: error.message });
  }
}

