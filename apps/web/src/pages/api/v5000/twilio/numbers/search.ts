/**
 * GET /api/v5000/twilio/numbers/search
 * 
 * Search for available Twilio phone numbers.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { searchAvailableNumbers } from '@niche-hunter/core';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { areaCode, state, country = 'US' } = req.query;

    const numbers = await searchAvailableNumbers(
      areaCode as string | undefined,
      state as string | undefined,
      country as string
    );

    return res.status(200).json({ numbers });
  } catch (error: any) {
    console.error('Error searching phone numbers:', error);
    return res.status(500).json({
      error: error.message || 'Failed to search phone numbers',
    });
  }
}

