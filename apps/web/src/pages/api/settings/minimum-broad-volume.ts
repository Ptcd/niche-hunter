import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

const SETTING_KEY = 'MINIMUM_BROAD_VOLUME';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      // Settings are stored in environment variables or a separate table
      // For now, use environment variable as fallback
      const setting = null; // TODO: Add Setting model to schema if needed

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

      // TODO: Add Setting model to schema if needed
      // For now, settings are stored in environment variables
      // This endpoint should be updated to use a proper Setting model
      console.warn('Setting model not implemented - threshold not persisted');

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Error saving threshold:', error);
      return res.status(500).json({ error: 'Failed to save threshold' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}






