/**
 * Supabase Server Client (Route Handlers)
 * 
 * Use this in API routes (pages/api/*) for server-side operations.
 */

import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';
import type { Session } from '@supabase/supabase-js';

/**
 * Helper function to set/update session cookie with consistent settings
 */
export function setSessionCookie(res: NextApiResponse, session: Session) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'fpwayqwhdendrgtottwj';
  const cookieName = `sb-${projectRef}-auth-token`;
  
  // Create minimal session object for cookie (avoid cookie size limits)
  const sessionData = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: {
      id: session.user.id,
      email: session.user.email,
    },
  };

  // URL encode the JSON string to avoid issues with special characters
  const cookieValue = encodeURIComponent(JSON.stringify(sessionData));
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  
  // Set cookie with proper attributes
  const cookieOptions = [
    `${cookieName}=${cookieValue}`,
    'Path=/',
    'HttpOnly',
    'Secure', // Only send over HTTPS
    'SameSite=Lax', // CSRF protection while allowing same-site navigation
    `Max-Age=${maxAge}`,
  ].join('; ');
  
  res.setHeader('Set-Cookie', cookieOptions);
}

export async function createRouteHandlerClient(req: NextApiRequest, res: NextApiResponse) {
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

  // Check if token is expired or expiring soon, and refresh if needed
  if (initialSession?.expires_at && initialSession?.refresh_token) {
    const expiresAt = initialSession.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    // Refresh if token expires within 5 minutes
    if (now > expiresAt - fiveMinutes) {
      try {
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: initialSession.refresh_token,
        });
        
        if (error) {
          console.warn('[createRouteHandlerClient] Token refresh failed:', error.message);
        } else if (data.session) {
          // Update cookie with new tokens
          setSessionCookie(res, data.session);
          // Update initialSession with new tokens for immediate use
          initialSession = {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
            expires_in: data.session.expires_in,
            token_type: data.session.token_type,
            user: initialSession.user, // Keep existing user data
          };
        }
      } catch (err: any) {
        console.warn('[createRouteHandlerClient] Error refreshing token:', err?.message);
      }
    }
  }

  // Set session if we have one from cookies
  if (initialSession?.access_token) {
    // Set session synchronously now that we've potentially refreshed
    await supabase.auth.setSession({
      access_token: initialSession.access_token,
      refresh_token: initialSession.refresh_token,
    }).catch((err) => {
      console.warn('[createRouteHandlerClient] Failed to set session:', err?.message);
    });
  }

  // Validate env vars at runtime (not during build)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return supabase;
}

