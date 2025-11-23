/**
 * Alerts System
 * 
 * Check sites for issues and create alerts.
 */

import { prisma } from '@niche-hunter/db';
import { SiteStatus } from '@prisma/client';
import { checkNAPConsistency } from '../citations/checkNAP';

/**
 * Calculate days since a date
 */
function daysSince(date: Date): number {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Create an alert if it doesn't already exist
 */
async function createAlert(data: {
  siteId: string;
  type: string;
  severity: string;
  message: string;
}): Promise<void> {
  // Check if alert already exists
  const existing = await prisma.alert.findFirst({
    where: {
      siteId: data.siteId,
      type: data.type,
      dismissed: false,
    },
  });

  if (existing) {
    return; // Alert already exists
  }

  await prisma.alert.create({
    data,
  });
}

/**
 * Check for "no leads" alert
 */
export async function checkNoLeadsAlert(siteId: string): Promise<void> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      status: true,
      createdAt: true,
    },
  });

  if (!site || site.status !== SiteStatus.LIVE) {
    return;
  }

  const ageInDays = daysSince(site.createdAt);
  if (ageInDays < 30) {
    return; // Too new to alert
  }

  // Check metrics for last 7 days
  const metrics = await prisma.siteMetrics.aggregate({
    where: {
      siteId,
      date: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    _sum: {
      calls: true,
      formLeads: true,
    },
  });

  if (metrics._sum.calls === 0 && metrics._sum.formLeads === 0) {
    await createAlert({
      siteId,
      type: 'NO_LEADS',
      severity: 'HIGH',
      message: `No leads in 7 days (site live for ${ageInDays} days)`,
    });
  }
}

/**
 * Check for stale citations
 */
export async function checkCitationsStale(siteId: string): Promise<void> {
  const lastCitation = await prisma.siteCitation.findFirst({
    where: { siteId },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });

  if (!lastCitation) {
    // No citations at all - might want to alert, but for now we'll skip
    return;
  }

  const daysSinceUpdate = daysSince(lastCitation.updatedAt);
  if (daysSinceUpdate > 60) {
    await createAlert({
      siteId,
      type: 'CITATIONS_STALE',
      severity: 'MEDIUM',
      message: `No citation updates in ${daysSinceUpdate} days`,
    });
  }
}

/**
 * Check for ranking drops
 */
export async function checkRankingsDrop(siteId: string): Promise<void> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { status: true },
  });

  if (!site || site.status !== SiteStatus.LIVE) {
    return;
  }

  // Get average position for last 7 days vs previous 7 days
  const now = new Date();
  const last7Days = await prisma.siteMetrics.findMany({
    where: {
      siteId,
      date: {
        gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
      avgPosition: { not: null },
    },
    select: { avgPosition: true },
  });

  const prev7Days = await prisma.siteMetrics.findMany({
    where: {
      siteId,
      date: {
        gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
      avgPosition: { not: null },
    },
    select: { avgPosition: true },
  });

  if (last7Days.length === 0 || prev7Days.length === 0) {
    return; // Not enough data
  }

  const avgLast7 = last7Days.reduce((sum, m) => sum + (m.avgPosition || 0), 0) / last7Days.length;
  const avgPrev7 = prev7Days.reduce((sum, m) => sum + (m.avgPosition || 0), 0) / prev7Days.length;

  // If position dropped by more than 5 positions
  if (avgLast7 - avgPrev7 > 5) {
    await createAlert({
      siteId,
      type: 'RANKINGS_DROP',
      severity: 'HIGH',
      message: `Average position dropped from ${avgPrev7.toFixed(1)} to ${avgLast7.toFixed(1)}`,
    });
  }
}

/**
 * Check for NAP inconsistency alert
 */
export async function checkNAPAlert(siteId: string): Promise<void> {
  const result = await checkNAPConsistency(siteId);
  
  if (!result.consistent) {
    await createAlert({
      siteId,
      type: 'NAP_INCONSISTENT',
      severity: 'MEDIUM',
      message: `NAP inconsistency: ${result.issues.join(', ')}`,
    });
  }
}

/**
 * Check all alerts for a site
 */
export async function checkAllAlertsForSite(siteId: string): Promise<void> {
  await Promise.all([
    checkNoLeadsAlert(siteId),
    checkCitationsStale(siteId),
    checkRankingsDrop(siteId),
    checkNAPAlert(siteId),
  ]);
}

/**
 * Check alerts for all live sites
 */
export async function checkAllAlerts(): Promise<void> {
  const sites = await prisma.site.findMany({
    where: {
      status: SiteStatus.LIVE,
    },
    select: { id: true },
  });

  const results = [];
  for (const site of sites) {
    try {
      await checkAllAlertsForSite(site.id);
      results.push({ siteId: site.id, status: 'success' });
    } catch (error: any) {
      console.error(`[alerts] Failed to check alerts for site ${site.id}:`, error);
      results.push({ siteId: site.id, status: 'error', error: error.message });
    }
  }

  return results as any;
}

