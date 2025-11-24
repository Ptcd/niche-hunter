/**
 * Google Search Console Integration
 * 
 * Sync rankings, impressions, clicks, and position data.
 */

import { google } from 'googleapis';
import { prisma } from '@niche-hunter/db';

let searchConsoleClient: any = null;

/**
 * Initialize Search Console client
 */
function getSearchConsoleClient() {
  if (searchConsoleClient) {
    return searchConsoleClient;
  }

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.warn('[search-console] Missing GOOGLE_SERVICE_ACCOUNT_JSON');
    return null;
  }

  try {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    searchConsoleClient = google.searchconsole({ version: 'v1', auth });
    return searchConsoleClient;
  } catch (error: any) {
    console.error('[search-console] Failed to initialize client:', error);
    return null;
  }
}

export interface GSCMetrics {
  date: string;
  impressions: number;
  clicks: number;
  position: number;
}

/**
 * Get site metrics from Search Console
 */
export async function getSiteMetrics(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<GSCMetrics[]> {
  const client = getSearchConsoleClient();
  if (!client) {
    throw new Error('Search Console client not configured');
  }

  try {
    const response = await client.searchanalytics.query({
      siteUrl: propertyId,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date'],
        rowLimit: 1000,
      },
    });

    const rows = response.data.rows || [];
    return rows.map((row: any) => ({
      date: row.keys[0],
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      position: row.position || 0,
    }));
  } catch (error: any) {
    console.error(`[search-console] Error fetching metrics for ${propertyId}:`, error);
    throw new Error(`Failed to fetch Search Console metrics: ${error.message}`);
  }
}

/**
 * Sync GSC metrics to SiteMetrics table
 */
export async function syncGSCMetrics(siteId: string): Promise<void> {
  const client = getSearchConsoleClient();
  if (!client) {
    console.warn('[search-console] Client not configured, skipping sync');
    return;
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      searchConsolePropertyId: true,
      lastRankingCheckAt: true,
    },
  });

  if (!site || !site.searchConsolePropertyId) {
    return;
  }

  // Get metrics from last check (or last 30 days if first time)
  const endDate = new Date();
  const startDate = site.lastRankingCheckAt
    ? new Date(site.lastRankingCheckAt)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const metrics = await getSiteMetrics(site.searchConsolePropertyId, startDateStr, endDateStr);

  // Upsert to SiteMetrics
  for (const metric of metrics) {
    const date = new Date(metric.date);
    await prisma.siteMetrics.upsert({
      where: {
        siteId_date: {
          siteId,
          date,
        },
      },
      update: {
        impressions: metric.impressions,
        clicks: metric.clicks,
        avgPosition: metric.position,
        pageViews: metric.clicks, // Use clicks as page views proxy
      },
      create: {
        siteId,
        date,
        impressions: metric.impressions,
        clicks: metric.clicks,
        avgPosition: metric.position,
        pageViews: metric.clicks,
      },
    });
  }

  // Update last check timestamp
  await prisma.site.update({
    where: { id: siteId },
    data: {
      lastRankingCheckAt: endDate,
    },
  });

  console.log(`[search-console] Synced ${metrics.length} days of metrics for site ${siteId}`);
}

/**
 * Sync GSC metrics for all sites with Search Console configured
 */
export async function syncAllGSCMetrics(): Promise<any[]> {
  const sites = await prisma.site.findMany({
    where: {
      searchConsolePropertyId: { not: null },
    },
    select: { id: true },
  });

  const results = [];
  for (const site of sites) {
    try {
      await syncGSCMetrics(site.id);
      results.push({ siteId: site.id, status: 'success' });
    } catch (error: any) {
      console.error(`[search-console] Failed to sync site ${site.id}:`, error);
      results.push({ siteId: site.id, status: 'error', error: error.message });
    }
  }

  return results as any;
}

