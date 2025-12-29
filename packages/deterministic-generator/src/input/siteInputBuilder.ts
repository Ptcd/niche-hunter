/**
 * Build site_input.json from database records
 */

import { prisma } from '@niche-hunter/db';
import { SiteInput, validateSiteInput } from './siteInputSchema';

/**
 * Build semantic keywords map from NicheKeyword records
 */
async function buildSemanticKeywordsMap(
  nicheId: string,
  primaryService: string,
  supportingServices: string[]
): Promise<Record<string, string[]>> {
  const nicheKeywords = await prisma.nicheKeyword.findMany({
    where: {
      nicheId,
      isActive: true,
    },
    include: {
      keywords: {
        where: {
          isSkipped: false,
        },
        include: {
          metrics: true,
        },
      },
    },
  });

  const map: Record<string, string[]> = {};

  // Build map for primary service
  const primaryKeywords = nicheKeywords
    .filter((nk: any) => {
      const keywordLower = nk.keyword.toLowerCase();
      return primaryService.toLowerCase().split(' ').some(word => keywordLower.includes(word));
    })
    .map((nk: any) => nk.keyword)
    .slice(0, 10); // Limit to top 10

  if (primaryKeywords.length > 0) {
    map[primaryService] = primaryKeywords;
  }

  // Build map for supporting services
  for (const service of supportingServices) {
    const serviceKeywords = nicheKeywords
      .filter((nk: any) => {
        const keywordLower = nk.keyword.toLowerCase();
        return service.toLowerCase().split(' ').some(word => keywordLower.includes(word));
      })
      .map((nk: any) => nk.keyword)
      .slice(0, 10);

    if (serviceKeywords.length > 0) {
      map[service] = serviceKeywords;
    }
  }

  return map;
}

/**
 * Build site_input.json from a Site record
 */
export async function buildSiteInputFromDb(siteId: string): Promise<SiteInput> {
  // First fetch the site with niche and batch
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      niche: true,
      batch: {
        include: {
          keywords: {
            where: {
              isSkipped: false,
            },
            take: 50, // Sample for semantic keywords
            include: {
              nicheKeyword: true,
            },
          },
        },
      },
    },
  });

  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }

  if (!site.niche) {
    throw new Error(`Site ${siteId} has no niche`);
  }

  // Find the CityV5000 record for this site's city/state
  const cityRecord = await prisma.cityV5000.findUnique({
    where: {
      city_state_countryCode: {
        city: site.city,
        state: site.state,
        countryCode: 'US',
      },
    },
  });

  // Fetch batch keywords sorted by search volume (highest first)
  // Use the site's batch keywords filtered by city and ordered by volume
  let topKeywords: Array<{ keyword: string; volume: number }> = [];
  let primaryService = site.niche.name.toLowerCase(); // Fallback to niche name

  if (site.batchId && cityRecord) {
    const batchKeywords = await prisma.keywordV5000.findMany({
      where: {
        batchId: site.batchId,
        cityId: cityRecord.id,
        isSkipped: false,
      },
      include: {
        nicheKeyword: true,
        metrics: true,
      },
    });

    // Extract keywords with volumes and sort by volume (descending)
    topKeywords = batchKeywords
      .filter((k: any) => k.nicheKeyword && k.metrics?.searchVolume)
      .map((k: any) => ({
        keyword: k.nicheKeyword.keyword,
        volume: k.metrics!.searchVolume!,
      }))
      .sort((a: any, b: any) => b.volume - a.volume)
      .slice(0, 20);

    // Use highest-volume keyword as primary service (not niche name!)
    if (topKeywords.length > 0) {
      primaryService = topKeywords[0].keyword.toLowerCase();
    }
  }

  // If no batch keywords, fall back to niche keywords sorted by national volume
  if (topKeywords.length === 0) {
    const nicheKeywords = await prisma.nicheKeyword.findMany({
      where: {
        nicheId: site.nicheId,
        isActive: true,
        nationalVolume: { not: null },
      },
      orderBy: {
        nationalVolume: 'desc',
      },
      take: 20,
    });

    topKeywords = nicheKeywords
      .filter((nk: any) => nk.nationalVolume)
      .map((nk: any) => ({
        keyword: nk.keyword,
        volume: nk.nationalVolume!,
      }));

    if (topKeywords.length > 0) {
      primaryService = topKeywords[0].keyword.toLowerCase();
    }
  }

  // Extract supporting services from next best keywords
  const supportingServices: string[] = topKeywords
    .slice(1, 6)
    .map(k => k.keyword.toLowerCase())
    .filter((keyword, index, self) => self.indexOf(keyword) === index); // Deduplicate

  // Build semantic keywords map
  const semanticKeywordsMap = await buildSemanticKeywordsMap(
    site.nicheId,
    primaryService,
    supportingServices
  );

  // Normalize state to uppercase
  const state = site.state.toUpperCase();

  const siteInput: SiteInput = {
    business_name: site.siteName || `${site.city} ${site.niche.name}`,
    cta_phone: site.trackingNumber || site.phoneNumber || '',
    primary_service: primaryService,
    supporting_services: supportingServices,
    target_city: site.city,
    state,
    business_type: 'lead_gen',
    semantic_keywords_map: semanticKeywordsMap,
    top_keywords: topKeywords.length > 0 ? topKeywords : undefined,
    blog: {
      enabled: false, // Default to disabled, can be enabled later
      num_posts: 6,
      publish_mode: 'draft',
      avoid_topics: ['licensing claims', 'exact pricing', 'medical/legal advice'],
    },
    external_links_policy: 'default_us',
  };

  // Validate before returning
  return validateSiteInput(siteInput);
}

/**
 * Build site_input.json from literal data (for testing or manual input)
 */
export function buildSiteInputFromLiteral(data: Partial<SiteInput>): SiteInput {
  return validateSiteInput(data);
}

