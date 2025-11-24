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
    
    // Try getSession first, but if that fails, try getUser with the token from cookies
    let session = null;
    let supabaseUser = null;
    
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (!sessionError && sessionData?.session) {
      session = sessionData.session;
      supabaseUser = sessionData.session.user;
    } else {
      // Fallback: try getUser (works with Authorization header)
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!userError && userData?.user) {
        supabaseUser = userData.user;
        // Construct minimal session from user
        // Note: This won't have refresh token, but should work for auth checks
        session = {
          user: supabaseUser,
          access_token: '', // Will be in Authorization header
        } as any;
      }
    }

    if (!session || !supabaseUser) {
      return null;
    }

    const sbUserId = supabaseUser.id;

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

