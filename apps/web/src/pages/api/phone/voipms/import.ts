/**
 * GET /api/phone/voipms/import
 * 
 * Import all phone numbers from VoIP.ms account.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { listVoipmsNumbers } from '../../../../lib/voipmsClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const numbers = await listVoipmsNumbers();
    
    return res.status(200).json({
      numbers: numbers.map(n => ({
        phoneNumber: n.did,
        routing: n.routing,
        pop: n.pop,
      })),
    });
  } catch (error: any) {
    console.error('[voipms-import] error:', error);
    return res.status(500).json({ error: error.message });
  }
}

