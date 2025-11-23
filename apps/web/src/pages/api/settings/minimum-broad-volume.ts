import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

const SETTING_KEY = 'MINIMUM_BROAD_VOLUME';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: SETTING_KEY },
      });

      // Default to 1000 if not set
      const value = setting?.value ? parseInt(setting.value, 10) : 1000;

      return res.status(200).json({
        threshold: isNaN(value) ? 1000 : value,
      });
    } catch (error: any) {
      console.error('Error fetching minimum volume threshold:', error);
      return res.status(500).json({ error: 'Failed to fetch threshold' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { threshold } = req.body;

      if (typeof threshold !== 'number' || threshold < 0) {
        return res.status(400).json({ error: 'Threshold must be a positive number' });
      }

      // Save or update the threshold
      await prisma.setting.upsert({
        where: { key: SETTING_KEY },
        update: {
          value: String(Math.floor(threshold)),
          updatedAt: new Date(),
        },
        create: {
          key: SETTING_KEY,
          value: String(Math.floor(threshold)),
        },
      });

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Error saving threshold:', error);
      return res.status(500).json({ error: 'Failed to save threshold' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}






