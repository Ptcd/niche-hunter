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

    // Set session cookies manually using Supabase's expected format
    // Supabase expects cookies in format: sb-<project-ref>-auth-token
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'fpwayqwhdendrgtottwj';
    const cookieName = `sb-${projectRef}-auth-token`;
    
    // Create minimal session object for cookie (avoid cookie size limits)
    const sessionData = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      user: {
        id: data.session.user.id,
        email: data.session.user.email,
      },
    };

    // URL encode the JSON string to avoid issues with special characters
    const cookieValue = encodeURIComponent(JSON.stringify(sessionData));
    const maxAge = data.session.expires_in || 3600;
    
    // Set cookie with proper attributes
    // Note: Cookies have a 4KB limit, so we store minimal data
    res.setHeader('Set-Cookie', [
      `${cookieName}=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
    ]);

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

