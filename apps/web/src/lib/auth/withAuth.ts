/**
 * Auth Middleware Wrapper
 * 
 * Higher-order function to protect API routes with authentication.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getAuthContext, AuthContext } from './context';
import { Role } from '@prisma/client';

type ApiHandler = (
  req: NextApiRequest & { auth: AuthContext },
  res: NextApiResponse
) => Promise<void> | void;

type AuthOptions = {
  requireRole?: Role;
};

export function withAuth(
  handler: ApiHandler,
  options: AuthOptions = {}
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Get auth context
    const auth = await getAuthContext(req, res);

    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check role requirement if specified
    if (options.requireRole) {
      const requiredRoles: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'VA', 'VIEWER'];
      const userRoleIndex = requiredRoles.indexOf(auth.role as Role);
      const requiredRoleIndex = requiredRoles.indexOf(options.requireRole);

      // Role hierarchy: OWNER > ADMIN > MANAGER > VA > VIEWER
      if (userRoleIndex > requiredRoleIndex) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    // Attach auth to request
    (req as any).auth = auth;

    // Call handler
    return handler(req as NextApiRequest & { auth: AuthContext }, res);
  };
}

