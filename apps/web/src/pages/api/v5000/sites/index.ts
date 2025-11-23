/**
 * GET /api/v5000/sites
 * 
 * List all sites with filtering and sorting.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { status, nicheId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const where: any = {};
    
    if (status && typeof status === 'string') {
      where.status = status;
    }
    
    if (nicheId && typeof nicheId === 'string') {
      where.nicheId = nicheId;
    }

    const orderBy: any = {};
    if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'status') {
      orderBy[sortBy as string] = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const sites = await prisma.site.findMany({
      where,
      include: {
        niche: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            pages: true,
          },
        },
      },
      orderBy,
    });

    return res.status(200).json(sites);
  } catch (error: any) {
    console.error('Error fetching sites:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch sites',
    });
  }
}

