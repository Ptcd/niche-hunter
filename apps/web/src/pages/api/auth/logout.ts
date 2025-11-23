/**
 * POST /api/auth/logout
 * 
 * Logout endpoint - clears Supabase session.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../../lib/supabase/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createRouteHandlerClient(req, res);
    
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Clear account cookie
    res.setHeader('Set-Cookie', 'currentAccountId=; Path=/; Max-Age=0');

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('[logout] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

