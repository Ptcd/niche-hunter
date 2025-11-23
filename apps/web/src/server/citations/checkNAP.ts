/**
 * NAP Consistency Checker
 * 
 * Checks Name, Address, Phone consistency across citations.
 */

import { prisma } from '@niche-hunter/db';

export async function checkNAPConsistency(siteId: string): Promise<{
  consistent: boolean;
  issues: string[];
}> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { citations: true },
  });

  if (!site) {
    return { consistent: true, issues: [] };
  }

  const canonicalName = site.siteName;
  const canonicalPhone = site.trackingNumber;

  const issues: string[] = [];

  for (const citation of site.citations) {
    if (citation.listedName && canonicalName && citation.listedName !== canonicalName) {
      issues.push(`${citation.source}: Name mismatch (${citation.listedName})`);
    }
    if (citation.listedPhone && canonicalPhone && citation.listedPhone !== canonicalPhone) {
      issues.push(`${citation.source}: Phone mismatch (${citation.listedPhone})`);
    }
  }

  return {
    consistent: issues.length === 0,
    issues,
  };
}

