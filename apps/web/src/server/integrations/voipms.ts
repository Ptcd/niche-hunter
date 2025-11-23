/**
 * VoIP.ms Integration
 * 
 * Call tracking and metrics sync for VoIP.ms phone numbers.
 */

import { prisma } from '@niche-hunter/db';
import { PhoneSource } from '@prisma/client';
import { getVoipmsCalls } from '../../lib/voipmsClient';

export async function syncVoipmsCallMetrics(siteId: string): Promise<void> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      trackingNumber: true,
      phoneSource: true,
      lastCallCountCheckAt: true,
    },
  });

  if (!site || site.phoneSource !== PhoneSource.VOIPMS || !site.trackingNumber) {
    return;
  }

  const startDate = site.lastCallCountCheckAt
    ? new Date(site.lastCallCountCheckAt)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = new Date();

  const dateFrom = startDate.toISOString().split('T')[0];
  const dateTo = endDate.toISOString().split('T')[0];

  const calls = await getVoipmsCalls(site.trackingNumber, dateFrom, dateTo);

  // Group by date
  const callsByDate = new Map<string, { count: number; minutes: number }>();
  for (const call of calls) {
    const dateKey = call.date.split(' ')[0]; // extract YYYY-MM-DD
    const existing = callsByDate.get(dateKey) || { count: 0, minutes: 0 };
    callsByDate.set(dateKey, {
      count: existing.count + 1,
      minutes: existing.minutes + Math.ceil(call.duration / 60),
    });
  }

  // Upsert to SiteMetrics
  for (const [dateStr, data] of callsByDate.entries()) {
    const date = new Date(dateStr);
    await prisma.siteMetrics.upsert({
      where: { siteId_date: { siteId, date } },
      update: {
        calls: data.count,
        callMinutes: data.minutes,
      },
      create: {
        siteId,
        date,
        calls: data.count,
        callMinutes: data.minutes,
      },
    });
  }

  await prisma.site.update({
    where: { id: siteId },
    data: { lastCallCountCheckAt: endDate },
  });

  console.log(`[voipms-integration] Synced ${calls.length} calls for site ${siteId}`);
}

export async function syncAllVoipmsMetrics(): Promise<any[]> {
  const sites = await prisma.site.findMany({
    where: {
      phoneSource: PhoneSource.VOIPMS,
      trackingNumber: { not: null },
    },
    select: { id: true },
  });

  const results = [];
  for (const site of sites) {
    try {
      await syncVoipmsCallMetrics(site.id);
      results.push({ siteId: site.id, status: 'success' });
    } catch (error: any) {
      console.error(`[voipms-integration] Failed to sync site ${site.id}:`, error);
      results.push({ siteId: site.id, status: 'error', error: error.message });
    }
  }

  return results;
}

