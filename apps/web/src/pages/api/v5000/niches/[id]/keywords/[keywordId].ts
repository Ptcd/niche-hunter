import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, keywordId } = req.query;

  if (typeof id !== 'string' || typeof keywordId !== 'string') {
    return res.status(400).json({ error: 'Invalid niche ID or keyword ID' });
  }

  if (req.method === 'PATCH') {
    try {
      const { keyword, intent, isActive, notes, sortOrder } = req.body;

      const updateData: any = {};
      if (keyword !== undefined) updateData.keyword = keyword.trim();
      if (intent !== undefined) updateData.intent = intent;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (notes !== undefined) updateData.notes = notes || null;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

      const nicheKeyword = await prisma.nicheKeyword.update({
        where: { id: keywordId },
        data: updateData,
      });

      return res.status(200).json(nicheKeyword);
    } catch (error: any) {
      console.error('Error updating keyword:', error);
      return res.status(500).json({ error: error.message || 'Failed to update keyword' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.nicheKeyword.delete({
        where: { id: keywordId },
      });

      return res.status(200).json({ message: 'Keyword deleted' });
    } catch (error: any) {
      console.error('Error deleting keyword:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete keyword' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}



