/**
 * GET /api/v5000/account/current
 * 
 * Returns current user and account information.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../lib/auth/withAuth';
import { prisma } from '@niche-hunter/db';

async function handler(req: NextApiRequest & { auth: any }, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const account = await prisma.account.findUnique({
      where: { id: req.auth.currentAccountId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      user: req.auth.user,
      account,
      role: req.auth.role,
    });
  } catch (error: any) {
    console.error('[account/current] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export default withAuth(handler);

