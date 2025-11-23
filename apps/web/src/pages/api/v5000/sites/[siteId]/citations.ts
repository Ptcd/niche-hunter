/**
 * Citations API
 * 
 * GET    → List citations
 * POST   → Add citation
 * PATCH  → Update citation
 * DELETE → Remove citation
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { siteId } = req.query;

  if (typeof siteId !== 'string') {
    return res.status(400).json({ error: 'Invalid site ID' });
  }

  // Verify site exists
  const site = await prisma.site.findUnique({
    where: { id: siteId },
  });

  if (!site) {
    return res.status(404).json({ error: 'Site not found' });
  }

  if (req.method === 'GET') {
    const citations = await prisma.siteCitation.findMany({
      where: { siteId },
      orderBy: { updatedAt: 'desc' },
    });

    return res.status(200).json({ citations });
  }

  if (req.method === 'POST') {
    const { source, url, nap, listedName, listedAddress, listedPhone, priority } = req.body as {
      source: string;
      url: string;
      nap?: string;
      listedName?: string;
      listedAddress?: string;
      listedPhone?: string;
      priority?: number;
    };

    if (!source || !url) {
      return res.status(400).json({ error: 'Source and URL are required' });
    }

    const citation = await prisma.siteCitation.create({
      data: {
        siteId,
        source,
        url,
        nap: nap || null,
        listedName: listedName || null,
        listedAddress: listedAddress || null,
        listedPhone: listedPhone || null,
        priority: priority || 3,
      },
    });

    return res.status(201).json({ citation });
  }

  if (req.method === 'PATCH') {
    const citationId = req.body.id || req.query.id;
    if (!citationId || typeof citationId !== 'string') {
      return res.status(400).json({ error: 'Invalid citation ID' });
    }

    const { source, url, nap, verified } = req.body as {
      source?: string;
      url?: string;
      nap?: string;
      verified?: boolean;
    };

    const citation = await prisma.siteCitation.update({
      where: { id: citationId },
      data: {
        ...(source && { source }),
        ...(url && { url }),
        ...(nap !== undefined && { nap }),
        ...(verified !== undefined && { verified }),
      },
    });

    return res.status(200).json({ citation });
  }

  if (req.method === 'DELETE') {
    // For DELETE, citation ID should be in the URL path
    // Route should be: /api/v5000/sites/[siteId]/citations/[citationId]
    // For now, accept it in query or body
    const citationId = (req.query.citationId || req.body.id) as string;
    if (!citationId) {
      return res.status(400).json({ error: 'Citation ID required' });
    }

    await prisma.siteCitation.delete({
      where: { id: citationId },
    });

    return res.status(200).json({ status: 'ok' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

