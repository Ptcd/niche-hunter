/**
 * Health Check Module
 * 
 * Checks site uptime, SSL, and response times.
 */

import { prisma } from '@niche-hunter/db';

export async function checkSiteHealth(siteId: string): Promise<{
  isUp: boolean;
  hasSsl: boolean;
  sslExpiresAt: Date | null;
  responseTime: number;
  error?: string;
}> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { domain: true, wpBaseUrl: true },
  });

  if (!site || (!site.domain && !site.wpBaseUrl)) {
    return {
      isUp: false,
      hasSsl: false,
      sslExpiresAt: null,
      responseTime: 0,
      error: 'No domain configured',
    };
  }

  const url = site.wpBaseUrl || `https://${site.domain}`;
  
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    const isUp = response.status < 500;
    const hasSsl = url.startsWith('https://');

    // TODO: Get SSL cert expiry (requires certificate inspection)
    // For now, we'll leave it null
    const sslExpiresAt = null;

    return {
      isUp,
      hasSsl,
      sslExpiresAt,
      responseTime,
    };
  } catch (error: any) {
    return {
      isUp: false,
      hasSsl: false,
      sslExpiresAt: null,
      responseTime: 0,
      error: error.message || 'Connection failed',
    };
  }
}

export async function createHealthAlert(siteId: string, message: string): Promise<void> {
  // Check if alert already exists
  const existing = await prisma.alert.findFirst({
    where: {
      siteId,
      type: 'SITE_DOWN',
      dismissed: false,
    },
  });

  if (existing) {
    return; // Alert already exists
  }

  await prisma.alert.create({
    data: {
      siteId,
      type: 'SITE_DOWN',
      severity: 'HIGH',
      message,
    },
  });
}

