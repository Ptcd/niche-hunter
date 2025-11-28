/**
 * Page Strategy Module
 * 
 * Determines which pages to generate for a site based on existing Niche Hunter data.
 * Uses simple code-based logic (no AI needed - we already have the intelligence).
 */

import { prisma } from '@niche-hunter/db';
import { PageType } from '@prisma/client';

export interface PageSpec {
  type: PageType;
  keywords: string[];
  skeletonName?: string;
  priority: number;
}

/**
 * Get top keywords for a site from KeywordV5000
 * Returns keywords sorted by volume DESC (not opportunity score)
 */
async function getTopKeywordsForSite(siteId: string, limit: number = 10): Promise<Array<{ keyword: string; volume: number; isLocal: boolean }>> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      batch: {
        include: {
          keywords: {
            where: {
              isSkipped: false,
            },
            include: {
              difficultyScore: true,
              metrics: true,
              city: true,
            },
          },
        },
      },
    },
  });

  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }

  if (!site.batch?.keywords || site.batch.keywords.length === 0) {
    // Fallback: use niche keywords if batch keywords not available
    const niche = await prisma.niche.findUnique({
      where: { id: site.nicheId },
      include: {
        keywords: {
          where: { isActive: true },
          take: limit,
        },
      },
    });
    
    if (niche?.keywords) {
      return niche.keywords.map((kw) => ({
        keyword: kw.keyword,
        volume: kw.nationalVolume || 0,
        isLocal: false,
      }));
    }
    
    return [];
  }

  // Extract keywords with volume, sort by volume DESC (prioritize volume over opportunity)
  const keywordsWithVolume = site.batch.keywords
    .map((kw) => ({
      keyword: kw.localizedQuery || '',
      volume: kw.metrics?.searchVolume || 0,
      isLocal: kw.city?.city === site.city && kw.city?.state === site.state,
    }))
    .filter((kw) => kw.keyword && kw.volume > 0) // Only keywords with volume
    .sort((a, b) => b.volume - a.volume) // Sort by volume DESC
    .slice(0, limit);

  return keywordsWithVolume;
}

/**
 * Generate page strategy for a site
 * 
 * Returns array of page specs with type, keywords, and skeleton mapping.
 */
export async function generatePageStrategy(siteId: string): Promise<PageSpec[]> {
  const keywordsWithData = await getTopKeywordsForSite(siteId, 20);
  
  // For homepage: prioritize LOCAL keywords (highest volume local keyword)
  const localKeywords = keywordsWithData.filter(kw => kw.isLocal);
  const homepageKeywords = localKeywords.length > 0 
    ? localKeywords.slice(0, 3).map(kw => kw.keyword)
    : keywordsWithData.slice(0, 3).map(kw => kw.keyword); // Fallback to all if no local
  
  // For service pages: use all keywords sorted by volume (cluster by service type)
  const serviceKeywords = keywordsWithData
    .filter(kw => !homepageKeywords.includes(kw.keyword)) // Exclude homepage keywords
    .slice(0, 6);

  const pageSpecs: PageSpec[] = [
    // Home page - top 3 LOCAL keywords by volume (or top 3 overall if no local)
    {
      type: PageType.HOME,
      keywords: homepageKeywords,
      skeletonName: 'home-v1',
      priority: 1,
    },
    // Core service pages - next 3-6 keywords by volume
    ...serviceKeywords.slice(0, 3).map((kwData, idx) => ({
      type: PageType.CORE_SERVICE,
      keywords: [kwData.keyword],
      skeletonName: 'service-v1',
      priority: 2 + idx,
    })),
    // Support/FAQ pages - next 3 keywords
    ...serviceKeywords.slice(3, 6).map((kwData, idx) => ({
      type: PageType.SUPPORT,
      keywords: [kwData.keyword],
      skeletonName: 'faq-v1',
      priority: 5 + idx,
    })),
    // Standard pages
    {
      type: PageType.ABOUT,
      keywords: [],
      skeletonName: 'about-v1',
      priority: 11,
    },
    {
      type: PageType.CONTACT,
      keywords: [],
      skeletonName: 'contact-v1',
      priority: 12,
    },
    {
      type: PageType.LEGAL,
      keywords: [],
      skeletonName: 'legal-v1',
      priority: 13,
    },
  ];

  return pageSpecs;
}

