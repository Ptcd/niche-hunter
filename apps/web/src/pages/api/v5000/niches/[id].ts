import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid niche ID' });
  }

  if (req.method === 'GET') {
    try {
      const niche = await prisma.niche.findUnique({
        where: { id },
        include: {
          keywords: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });

      if (!niche) {
        return res.status(404).json({ error: 'Niche not found' });
      }

      return res.status(200).json(niche);
    } catch (error: any) {
      console.error('Error fetching niche:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch niche' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { name, description } = req.body;

      const updateData: any = {};
      if (name !== undefined) {
        updateData.name = name;
        updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
      if (description !== undefined) {
        updateData.description = description || null;
      }

      const niche = await prisma.niche.update({
        where: { id },
        data: updateData,
        include: {
          keywords: true,
        },
      });

      return res.status(200).json(niche);
    } catch (error: any) {
      console.error('Error updating niche:', error);
      return res.status(500).json({ error: error.message || 'Failed to update niche' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.niche.delete({
        where: { id },
      });

      return res.status(200).json({ message: 'Niche deleted' });
    } catch (error: any) {
      console.error('Error deleting niche:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete niche' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}



