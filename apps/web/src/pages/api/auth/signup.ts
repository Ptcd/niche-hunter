/**
 * POST /api/auth/signup
 * 
 * Signup with access code validation.
 * Creates Supabase auth user, internal User, Account, and Membership.
 * Migrates existing data (Sites/Batches/Niches) to new account.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase/admin';
import { prisma } from '@niche-hunter/db';
import { Role } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, name, accessCode } = req.body;

  // Validate required fields
  if (!email || !password || !name || !accessCode) {
    return res.status(400).json({ error: 'Missing required fields: email, password, name, accessCode' });
  }

  // Validate access code
  const requiredAccessCode = process.env.SIGNUP_ACCESS_CODE || 'o0fw8j';
  if (accessCode !== requiredAccessCode) {
    return res.status(403).json({ error: 'Invalid access code' });
  }

  try {
    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('[signup] Supabase auth error:', authError);
      return res.status(400).json({ error: `Failed to create user: ${authError.message}` });
    }

    if (!authData.user) {
      return res.status(500).json({ error: 'User creation failed - no user returned' });
    }

    const sbUserId = authData.user.id;

    // 2. Create internal User record
    const user = await prisma.user.create({
      data: {
        sbUserId,
        email,
        name,
      },
    });

    // 3. Create Account automatically
    const account = await prisma.account.create({
      data: {
        name: `${name}'s Account`,
        ownerId: user.id,
      },
    });

    // 4. Create Membership as OWNER
    await prisma.membership.create({
      data: {
        userId: user.id,
        accountId: account.id,
        role: Role.OWNER,
      },
    });

    // 5. Migration: Assign all existing data to this account
    // Check if there's any existing data without accountId
    const [existingSites, existingBatches, existingNiches] = await Promise.all([
      prisma.site.count({ where: { accountId: null } }),
      prisma.scanBatch.count({ where: { accountId: null } }),
      prisma.niche.count({ where: { accountId: null } }),
    ]);

    if (existingSites > 0 || existingBatches > 0 || existingNiches > 0) {
      console.log(`[signup] Migrating existing data to account ${account.id}: ${existingSites} sites, ${existingBatches} batches, ${existingNiches} niches`);

      await Promise.all([
        prisma.site.updateMany({
          where: { accountId: null },
          data: { accountId: account.id },
        }),
        prisma.scanBatch.updateMany({
          where: { accountId: null },
          data: { accountId: account.id },
        }),
        prisma.niche.updateMany({
          where: { accountId: null },
          data: { accountId: account.id },
        }),
      ]);
    }

    // Return success - frontend will handle login
    return res.status(200).json({
      ok: true,
      userId: user.id,
      accountId: account.id,
      message: 'Account created successfully',
    });
  } catch (error: any) {
    console.error('[signup] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

