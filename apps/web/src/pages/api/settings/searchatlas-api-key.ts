import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

const SETTING_KEY = 'SEARCHATLAS_API_KEY';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: SETTING_KEY },
      });

      return res.status(200).json({
        apiKey: setting?.value || null,
      });
    } catch (error: any) {
      console.error('Error fetching API key:', error);
      return res.status(500).json({ error: 'Failed to fetch API key' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { apiKey } = req.body;

      if (typeof apiKey !== 'string') {
        return res.status(400).json({ error: 'API key must be a string' });
      }

      // Save or update the API key
      await prisma.setting.upsert({
        where: { key: SETTING_KEY },
        update: {
          value: apiKey.trim(),
          updatedAt: new Date(),
        },
        create: {
          key: SETTING_KEY,
          value: apiKey.trim(),
        },
      });

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Error saving API key:', error);
      return res.status(500).json({ error: 'Failed to save API key' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}






