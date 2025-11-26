import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid niche ID' });
  }

  if (req.method === 'POST') {
    try {
      const { keyword, intent, notes } = req.body;

      if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required' });
      }

      // Check if niche exists
      const niche = await prisma.niche.findUnique({
        where: { id },
      });

      if (!niche) {
        return res.status(404).json({ error: 'Niche not found' });
      }

      // Check if keyword already exists
      const existing = await prisma.nicheKeyword.findUnique({
        where: {
          nicheId_keyword: {
            nicheId: id,
            keyword: keyword.trim(),
          },
        },
      });

      if (existing) {
        return res.status(400).json({ error: 'Keyword already exists in this niche' });
      }

      const nicheKeyword = await prisma.nicheKeyword.create({
        data: {
          nicheId: id,
          keyword: keyword.trim(),
          intent: intent || 'transactional',
          notes: notes || null,
        },
      });

      return res.status(201).json(nicheKeyword);
    } catch (error: any) {
      console.error('Error adding keyword:', error);
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Keyword already exists in this niche' });
      }
      return res.status(500).json({ error: error.message || 'Failed to add keyword' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}




