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
 */
async function getTopKeywordsForSite(siteId: string, limit: number = 10): Promise<string[]> {
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
            },
            orderBy: [
              { difficultyScore: { opportunity: 'desc' } },
              { metrics: { searchVolume: 'desc' } },
            ],
            take: limit,
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
      return niche.keywords.map((kw) => kw.keyword).filter((q): q is string => !!q);
    }
    
    return [];
  }

  // Extract keywords, prioritizing by opportunity and volume
  return site.batch.keywords
    .map((kw) => kw.localizedQuery)
    .filter((q): q is string => !!q);
}

/**
 * Generate page strategy for a site
 * 
 * Returns array of page specs with type, keywords, and skeleton mapping.
 */
export async function generatePageStrategy(siteId: string): Promise<PageSpec[]> {
  const keywords = await getTopKeywordsForSite(siteId, 15);

  const pageSpecs: PageSpec[] = [
    // Home page - top 3 money keywords
    {
      type: PageType.HOME,
      keywords: keywords.slice(0, 3),
      skeletonName: 'home-v1',
      priority: 1,
    },
    // Core service pages - next 3-6 keywords
    ...keywords.slice(3, 6).map((keyword, idx) => ({
      type: PageType.CORE_SERVICE,
      keywords: [keyword],
      skeletonName: 'service-v1',
      priority: 2 + idx,
    })),
    // Support/FAQ pages - next 4 keywords
    ...keywords.slice(6, 10).map((keyword, idx) => ({
      type: PageType.SUPPORT,
      keywords: [keyword],
      skeletonName: 'faq-v1',
      priority: 6 + idx,
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

