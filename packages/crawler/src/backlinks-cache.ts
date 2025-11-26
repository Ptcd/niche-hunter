/**
 * Cache layer for domain and page metrics from DataForSEO Backlinks API
 * 
 * Handles TTL-based caching:
 * - DomainMetrics: 30 days TTL
 * - PageMetrics: 7 days TTL
 */

import { prisma } from '@niche-hunter/db';
import type { PageMetricsData, DomainMetricsData } from './dataforseo-backlinks';

const DOMAIN_TTL_DAYS = 30;
const PAGE_TTL_DAYS = 7;

/**
 * Check if a timestamp is stale based on TTL
 */
function isStale(fetchedAt: Date, ttlDays: number): boolean {
  const now = new Date();
  const ageMs = now.getTime() - fetchedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays > ttlDays;
}

/**
 * Get cached domain metrics and return list of domains that need fetching
 */
export async function getCachedDomainMetrics(
  domains: string[]
): Promise<{
  cached: Map<string, DomainMetricsData>;
  toFetch: string[];
}> {
  const cached = new Map<string, DomainMetricsData>();
  const toFetch: string[] = [];

  if (domains.length === 0) {
    return { cached, toFetch };
  }

  // Normalize domains (lowercase, no www)
  const normalizedDomains = domains.map(d => d.toLowerCase().replace(/^www\./, ''));

  const records = await prisma.domainMetrics.findMany({
    where: {
      domain: {
        in: normalizedDomains,
      },
    },
  });

  for (const domain of normalizedDomains) {
    const record = records.find(r => r.domain === domain);
    
    if (record && !isStale(record.fetchedAt, DOMAIN_TTL_DAYS)) {
      cached.set(domain, {
        domain: record.domain,
        domainRank: record.domainRank,
      });
    } else {
      toFetch.push(domain);
    }
  }

  console.log(`[Backlinks Cache] Domain metrics: ${cached.size} cached, ${toFetch.length} need fetching`);

  return { cached, toFetch };
}

/**
 * Get cached page metrics and return list of URLs that need fetching
 */
export async function getCachedPageMetrics(
  urls: string[]
): Promise<{
  cached: Map<string, PageMetricsData>;
  toFetch: string[];
}> {
  const cached = new Map<string, PageMetricsData>();
  const toFetch: string[] = [];

  if (urls.length === 0) {
    return { cached, toFetch };
  }

  const records = await prisma.pageMetrics.findMany({
    where: {
      url: {
        in: urls,
      },
    },
  });

  for (const url of urls) {
    const record = records.find(r => r.url === url);
    
    if (record && !isStale(record.fetchedAt, PAGE_TTL_DAYS)) {
      cached.set(url, {
        url: record.url,
        domain: record.domain,
        pageRank: record.pageRank,
        backlinks: record.backlinks,
        referringDomains: record.referringDomains,
        domainRank: record.domainRank ?? 0,
      });
    } else {
      toFetch.push(url);
    }
  }

  console.log(`[Backlinks Cache] Page metrics: ${cached.size} cached, ${toFetch.length} need fetching`);

  return { cached, toFetch };
}

/**
 * Store domain metrics in cache
 */
export async function storeDomainMetrics(metrics: DomainMetricsData[]): Promise<void> {
  if (metrics.length === 0) return;

  for (const metric of metrics) {
    await prisma.domainMetrics.upsert({
      where: { domain: metric.domain },
      create: {
        domain: metric.domain,
        domainRank: metric.domainRank,
        fetchedAt: new Date(),
      },
      update: {
        domainRank: metric.domainRank,
        fetchedAt: new Date(),
      },
    });
  }

  console.log(`[Backlinks Cache] Stored ${metrics.length} domain metrics`);
}

/**
 * Store page metrics in cache
 */
export async function storePageMetrics(metrics: PageMetricsData[]): Promise<void> {
  if (metrics.length === 0) return;

  for (const metric of metrics) {
    await prisma.pageMetrics.upsert({
      where: { url: metric.url },
      create: {
        url: metric.url,
        domain: metric.domain,
        pageRank: metric.pageRank,
        backlinks: metric.backlinks,
        referringDomains: metric.referringDomains,
        domainRank: metric.domainRank,
        fetchedAt: new Date(),
      },
      update: {
        domain: metric.domain,
        pageRank: metric.pageRank,
        backlinks: metric.backlinks,
        referringDomains: metric.referringDomains,
        domainRank: metric.domainRank,
        fetchedAt: new Date(),
      },
    });
  }

  console.log(`[Backlinks Cache] Stored ${metrics.length} page metrics`);
}

