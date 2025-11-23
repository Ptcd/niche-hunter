/**
 * Auth Context Resolver
 * 
 * Resolves current user, account, and role from Supabase session.
 * Use in API routes to get authenticated user context.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createRouteHandlerClient } from '../supabase/server';
import { prisma } from '@niche-hunter/db';

export interface AuthContext {
  user: {
    id: string;
    email: string;
    name: string | null;
    sbUserId: string;
  };
  currentAccountId: string;
  role: string;
  session: any;
}

/**
 * Get auth context from API request (Next.js pages router)
 */
export async function getAuthContext(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthContext | null> {
  try {
    const supabase = createRouteHandlerClient(req, res);
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return null;
    }

    const sbUserId = session.user.id;

    // Find internal User record
    const user = await prisma.user.findUnique({
      where: { sbUserId },
      include: {
        memberships: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Get currentAccountId from cookie or default to first membership
    const currentAccountIdCookie = req.cookies.currentAccountId;
    
    const currentAccountId =
      currentAccountIdCookie ||
      user.memberships[0]?.accountId ||
      null;

    if (!currentAccountId) {
      return null;
    }

    // Find membership for current account
    const membership = user.memberships.find(
      (m) => m.accountId === currentAccountId
    );

    if (!membership) {
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        sbUserId: user.sbUserId,
      },
      currentAccountId,
      role: membership.role,
      session,
    };
  } catch (error) {
    console.error('[getAuthContext] Error:', error);
    return null;
  }
}

