/**
 * Twilio Integration
 * 
 * Call tracking and metrics sync for Twilio phone numbers.
 */

import twilio from 'twilio';
import { prisma } from '@niche-hunter/db';
import { PhoneSource } from '@prisma/client';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.warn('[twilio-integration] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export interface Call {
  sid: string;
  to: string;
  from: string;
  startTime: Date;
  duration: number;
  status: string;
}

/**
 * Get call logs for a site's tracking number
 */
export async function getCallLogs(
  siteId: string,
  startDate: Date,
  endDate: Date
): Promise<Call[]> {
  if (!client) {
    throw new Error('Twilio client not configured');
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { trackingNumber: true, phoneSource: true },
  });

  if (!site || site.phoneSource !== PhoneSource.TWILIO || !site.trackingNumber) {
    return [];
  }

  try {
    const calls = await client.calls.list({
      to: site.trackingNumber,
      startTimeAfter: startDate,
      startTimeBefore: endDate,
      limit: 1000, // Adjust as needed
    });

    return calls.map((call) => ({
      sid: call.sid,
      to: call.to,
      from: call.from || '',
      startTime: call.startTime || new Date(),
      duration: parseInt(call.duration || '0'),
      status: call.status || 'unknown',
    }));
  } catch (error: any) {
    console.error(`[twilio-integration] Error fetching calls for site ${siteId}:`, error);
    throw new Error(`Failed to fetch Twilio calls: ${error.message}`);
  }
}

/**
 * Sync call metrics to SiteMetrics table
 */
export async function syncCallMetrics(siteId: string): Promise<void> {
  if (!client) {
    console.warn('[twilio-integration] Twilio client not configured, skipping sync');
    return;
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      trackingNumber: true,
      phoneSource: true,
      lastCallCountCheckAt: true,
    },
  });

  if (!site || site.phoneSource !== PhoneSource.TWILIO || !site.trackingNumber) {
    return;
  }

  // Get calls from last check (or last 30 days if first time)
  const startDate = site.lastCallCountCheckAt
    ? new Date(site.lastCallCountCheckAt)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = new Date();

  const calls = await getCallLogs(siteId, startDate, endDate);

  // Group calls by date
  const callsByDate = new Map<string, number>();
  for (const call of calls) {
    const dateKey = call.startTime.toISOString().split('T')[0]; // YYYY-MM-DD
    callsByDate.set(dateKey, (callsByDate.get(dateKey) || 0) + 1);
  }

  // Upsert to SiteMetrics
  for (const [dateStr, callCount] of callsByDate.entries()) {
    const date = new Date(dateStr);
    await prisma.siteMetrics.upsert({
      where: {
        siteId_date: {
          siteId,
          date,
        },
      },
      update: {
        calls: callCount,
      },
      create: {
        siteId,
        date,
        calls: callCount,
      },
    });
  }

  // Update last check timestamp
  await prisma.site.update({
    where: { id: siteId },
    data: {
      lastCallCountCheckAt: endDate,
    },
  });

  console.log(`[twilio-integration] Synced ${calls.length} calls for site ${siteId}`);
}

/**
 * Sync call metrics for all sites with Twilio numbers
 */
export async function syncAllCallMetrics(): Promise<any[]> {
  const sites = await prisma.site.findMany({
    where: {
      phoneSource: PhoneSource.TWILIO,
      trackingNumber: { not: null },
    },
    select: { id: true },
  });

  const results = [];
  for (const site of sites) {
    try {
      await syncCallMetrics(site.id);
      results.push({ siteId: site.id, status: 'success' });
    } catch (error: any) {
      console.error(`[twilio-integration] Failed to sync site ${site.id}:`, error);
      results.push({ siteId: site.id, status: 'error', error: error.message });
    }
  }

  return results as any;
}

