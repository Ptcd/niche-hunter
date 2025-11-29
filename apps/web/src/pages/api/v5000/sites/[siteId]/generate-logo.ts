/**
 * POST /api/v5000/sites/[siteId]/generate-logo
 * 
 * Generate a logo for a site using DALL-E
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../../lib/auth/withAuth';
import { prisma } from '@niche-hunter/db';
import { generateLogo } from '../../../../../lib/logoGenerator';

async function handler(req: NextApiRequest & { auth: any }, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { siteId } = req.query;
  const { promptHint, rules } = req.body;

  if (!siteId || typeof siteId !== 'string') {
    return res.status(400).json({ error: 'Invalid siteId' });
  }

  // Validate auth context
  if (!req.auth || !req.auth.currentAccountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get site
  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      accountId: req.auth.currentAccountId,
    },
    include: {
      niche: true,
    },
  });

  if (!site) {
    return res.status(404).json({ error: 'Site not found' });
  }

  try {
    // Generate logo
    const logoUrl = await generateLogo({
      brandName: site.siteName || `${site.city} ${site.niche.name}`,
      niche: site.niche.name,
      city: site.city,
      state: site.state,
      promptHint: promptHint || undefined,
      rules: rules || undefined,
    });

    // Update site with logo URL and prompt hint
    await prisma.site.update({
      where: { id: siteId },
      data: {
        logoUrl,
        logoPromptHint: promptHint || null,
      },
    });

    // Log cost (DALL-E 3 standard 1024x1024 = ~$0.04)
    await prisma.siteCostLog.create({
      data: {
        siteId,
        type: 'ai_generation',
        amountCents: 4, // $0.04
        provider: 'openai',
        description: 'Logo generation (DALL-E 3)',
      },
    });

    return res.status(200).json({ logoUrl });
  } catch (error: any) {
    console.error('[generate-logo] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate logo' });
  }
}

export default withAuth(handler);

