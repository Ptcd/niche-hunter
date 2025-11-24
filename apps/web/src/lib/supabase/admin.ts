/**
 * Supabase Admin Client
 * 
 * Use this for admin operations that require service role key.
 * Only use in server-side code (API routes, never expose to client).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

// Create client with placeholder values during build if env vars are missing
// This prevents build-time errors. The client will fail at runtime if actually used without proper env vars.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

