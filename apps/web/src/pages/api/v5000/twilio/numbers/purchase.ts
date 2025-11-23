/**
 * POST /api/v5000/twilio/numbers/purchase
 * 
 * Purchase a Twilio phone number.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { purchasePhoneNumber } from '@niche-hunter/core';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber is required' });
    }

    const result = await purchasePhoneNumber(phoneNumber);

    return res.status(200).json({
      message: 'Phone number purchased successfully',
      phoneNumber: result.phoneNumber,
      sid: result.sid,
    });
  } catch (error: any) {
    console.error('Error purchasing phone number:', error);
    return res.status(500).json({
      error: error.message || 'Failed to purchase phone number',
    });
  }
}

