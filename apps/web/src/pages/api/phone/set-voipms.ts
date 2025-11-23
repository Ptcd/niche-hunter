/**
 * POST /api/phone/set-voipms
 * 
 * Assign an existing VoIP.ms number to a site.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma, PhoneSource } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { siteId, phoneNumber } = req.body;

    if (!siteId || !phoneNumber) {
      return res.status(400).json({ error: 'Missing siteId or phoneNumber' });
    }

    await prisma.site.update({
      where: { id: siteId },
      data: {
        phoneSource: PhoneSource.VOIPMS,
        trackingNumber: phoneNumber,
        hasPhone: true,
      },
    });

    return res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('[set-voipms] error:', error);
    return res.status(500).json({ error: error.message });
  }
}

