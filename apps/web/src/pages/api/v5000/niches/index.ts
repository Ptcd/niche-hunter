import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const niches = await prisma.niche.findMany({
        include: {
          keywords: {
            where: { isActive: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json(niches);
    } catch (error: any) {
      console.error('Error fetching niches:', error);
      return res.status(500).json({
        error: error.message || 'Failed to fetch niches',
        details: error.toString(),
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Check if slug already exists
      let existing = null;
      try {
        existing = await prisma.niche.findUnique({
          where: { slug },
        });
      } catch (error: any) {
        if (
          error.message?.includes('does not exist') ||
          error.message?.includes('Tenant or user not found') ||
          (error.message?.includes('relation') && error.message?.includes('does not exist'))
        ) {
          return res.status(500).json({
            error: 'Database connection issue. Please check your DATABASE_URL and ensure the Niche table exists. Run: POST /api/v5000/setup-db',
          });
        }
        throw error;
      }

      if (existing) {
        return res.status(400).json({ error: `A niche with the name "${name}" already exists` });
      }

      const niche = await prisma.niche.create({
        data: {
          name,
          slug,
          description: description || null,
        },
        include: {
          keywords: true,
        },
      });

      return res.status(201).json(niche);
    } catch (error: any) {
      console.error('Error creating niche:', error);
      if (error.message?.includes('Tenant or user not found')) {
        return res.status(500).json({
          error: 'Database connection failed. Please check your DATABASE_URL in .env.local',
        });
      }
      if (error.message?.includes('does not exist')) {
        return res.status(500).json({
          error: 'Database table not found. Please run: POST /api/v5000/setup-db',
        });
      }
      return res.status(500).json({ error: error.message || 'Failed to create niche' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}



