/**
 * Permission Helpers
 * 
 * Role-based permission checks for multi-tenant system.
 */

import { Role } from '@prisma/client';

export function canManageSites(role: Role | undefined): boolean {
  if (!role) return false;
  return ['OWNER', 'ADMIN', 'MANAGER'].includes(role);
}

export function canEditContent(role: Role | undefined): boolean {
  if (!role) return false;
  return ['OWNER', 'ADMIN', 'MANAGER', 'VA'].includes(role);
}

export function canView(role: Role | undefined): boolean {
  return !!role; // Any logged-in user can view
}

export function canManageUsers(role: Role | undefined): boolean {
  if (!role) return false;
  return ['OWNER', 'ADMIN'].includes(role);
}

export function canManageBilling(role: Role | undefined): boolean {
  if (!role) return false;
  return role === 'OWNER';
}

