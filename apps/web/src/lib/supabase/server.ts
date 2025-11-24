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

  // Create client with placeholder values if env vars are missing
  // This prevents build-time errors. The client will fail at runtime if actually used without proper env vars.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // Don't persist in API routes
    },
  });

  // Validate env vars at runtime (not during build)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return supabase;
}

