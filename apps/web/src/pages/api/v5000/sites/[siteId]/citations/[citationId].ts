/**
 * DELETE /api/v5000/sites/[siteId]/citations/[citationId]
 * 
 * Delete a specific citation.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { siteId, citationId } = req.query;

  if (typeof siteId !== 'string' || typeof citationId !== 'string') {
    return res.status(400).json({ error: 'Invalid site ID or citation ID' });
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify citation belongs to site
    const citation = await prisma.siteCitation.findUnique({
      where: { id: citationId },
      select: { siteId: true },
    });

    if (!citation) {
      return res.status(404).json({ error: 'Citation not found' });
    }

    if (citation.siteId !== siteId) {
      return res.status(403).json({ error: 'Citation does not belong to this site' });
    }

    await prisma.siteCitation.delete({
      where: { id: citationId },
    });

    return res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('[citations-delete] error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}

