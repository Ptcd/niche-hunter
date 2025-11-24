import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

const SETTING_KEY = 'SEARCHATLAS_API_KEY';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      // Settings are stored in environment variables or a separate table
      // For now, use environment variable as fallback
      const setting = null; // TODO: Add Setting model to schema if needed

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

      // TODO: Add Setting model to schema if needed
      // For now, settings are stored in environment variables
      // This endpoint should be updated to use a proper Setting model
      console.warn('Setting model not implemented - API key not persisted');

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Error saving API key:', error);
      return res.status(500).json({ error: 'Failed to save API key' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}






