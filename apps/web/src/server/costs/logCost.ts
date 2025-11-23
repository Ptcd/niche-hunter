/**
 * Cost Logging Helper
 * 
 * Logs costs to SiteCostLog and updates Site totals.
 */

import { prisma } from '@niche-hunter/db';

export async function logCost(params: {
  siteId: string;
  type: 'domain_registration' | 'phone_monthly' | 'hosting' | 'ai_generation';
  amountCents: number;
  provider?: string;
  description?: string;
}): Promise<void> {
  await prisma.siteCostLog.create({
    data: {
      siteId: params.siteId,
      type: params.type,
      amountCents: params.amountCents,
      provider: params.provider,
      description: params.description,
    },
  });

  // Update site based on cost type
  const updates: any = {};
  if (params.type === 'domain_registration') {
    updates.domainCostCents = params.amountCents;
  } else if (params.type === 'phone_monthly') {
    updates.phoneCostCents = params.amountCents;
  } else if (params.type === 'hosting') {
    updates.hostingCostCents = params.amountCents;
  } else if (params.type === 'ai_generation') {
    // For AI costs, increment existing total
    const site = await prisma.site.findUnique({
      where: { id: params.siteId },
      select: { aiCostCents: true },
    });
    updates.aiCostCents = (site?.aiCostCents || 0) + params.amountCents;
  }

  if (Object.keys(updates).length > 0) {
    await prisma.site.update({
      where: { id: params.siteId },
      data: updates,
    });
  }
}

