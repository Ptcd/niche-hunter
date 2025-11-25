/**
 * POST /api/auth/login
 * 
 * Login endpoint - uses Supabase client-side auth.
 * This is mainly for setting cookies/session.
 * Actual login should be done client-side with Supabase client.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient, setSessionCookie } from '../../../lib/supabase/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const supabase = await createRouteHandlerClient(req, res);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    if (!data.session) {
      return res.status(401).json({ error: 'No session created' });
    }

    // Set session cookie using helper function (30-day lifetime)
    setSessionCookie(res, data.session);

    return res.status(200).json({
      ok: true,
      user: data.user,
      session: data.session,
    });
  } catch (error: any) {
    console.error('[login] Error:', error);
    console.error('[login] Error stack:', error?.stack);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error',
    });
  }
}

