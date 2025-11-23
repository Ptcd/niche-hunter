/**
 * Supabase Server Client (Route Handlers)
 * 
 * Use this in API routes (pages/api/*) for server-side operations.
 */

import { createClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';

export function createRouteHandlerClient(req: NextApiRequest, res: NextApiResponse) {
  return createClient({ req, res });
}

