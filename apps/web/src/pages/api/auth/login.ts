/**
 * POST /api/auth/login
 * 
 * Login endpoint - uses Supabase client-side auth.
 * This is mainly for setting cookies/session.
 * Actual login should be done client-side with Supabase client.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../../../lib/supabase/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const supabase = createRouteHandlerClient(req, res);
    
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

    // Set session cookies manually
    // Supabase uses sb-<project-ref>-auth-token and sb-<project-ref>-auth-token.0, etc.
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'fpwayqwhdendrgtottwj';
    const accessToken = data.session.access_token;
    const refreshToken = data.session.refresh_token;

    // Set access token cookie
    res.setHeader('Set-Cookie', [
      `sb-${projectRef}-auth-token=${JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
        user: data.session.user,
      })}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${data.session.expires_in || 3600}`,
    ]);

    return res.status(200).json({
      ok: true,
      user: data.user,
      session: data.session,
    });
  } catch (error: any) {
    console.error('[login] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

