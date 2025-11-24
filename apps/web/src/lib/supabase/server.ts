/**
 * Supabase Server Client (Route Handlers)
 * 
 * Use this in API routes (pages/api/*) for server-side operations.
 */

import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

export function createRouteHandlerClient(req: NextApiRequest, res: NextApiResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

  // Extract project ref from URL
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'fpwayqwhdendrgtottwj';
  
  // Read session from cookies
  const cookieName = `sb-${projectRef}-auth-token`;
  const sessionCookie = req.cookies[cookieName];
  
  let initialSession = null;
  if (sessionCookie) {
    try {
      // Cookie value is URL encoded, so decode it first
      const decoded = typeof sessionCookie === 'string' ? decodeURIComponent(sessionCookie) : sessionCookie;
      initialSession = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
    } catch (e) {
      // Invalid cookie, ignore
      console.warn('[createRouteHandlerClient] Failed to parse session cookie:', e);
    }
  }

  // Create client with placeholder values if env vars are missing
  // This prevents build-time errors. The client will fail at runtime if actually used without proper env vars.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // Don't persist in API routes
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: initialSession?.access_token ? {
        Authorization: `Bearer ${initialSession.access_token}`,
      } : {},
    },
  });

  // Set session if we have one from cookies
  if (initialSession?.access_token) {
    supabase.auth.setSession({
      access_token: initialSession.access_token,
      refresh_token: initialSession.refresh_token,
    }).catch(() => {
      // Session might be expired, ignore
    });
  }

  // Validate env vars at runtime (not during build)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return supabase;
}

