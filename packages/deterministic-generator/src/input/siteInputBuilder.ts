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
    .filter(nk => {
      const keywordLower = nk.keyword.toLowerCase();
      return primaryService.toLowerCase().split(' ').some(word => keywordLower.includes(word));
    })
    .map(nk => nk.keyword)
    .slice(0, 10); // Limit to top 10

  if (primaryKeywords.length > 0) {
    map[primaryService] = primaryKeywords;
  }

  // Build map for supporting services
  for (const service of supportingServices) {
    const serviceKeywords = nicheKeywords
      .filter(nk => {
        const keywordLower = nk.keyword.toLowerCase();
        return service.toLowerCase().split(' ').some(word => keywordLower.includes(word));
      })
      .map(nk => nk.keyword)
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
  // First fetch the site with niche
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      niche: true,
    },
  });

  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }

  if (!site.niche) {
    throw new Error(`Site ${siteId} has no niche`);
  }

  // Extract primary service from niche name or first keyword
  const primaryService = site.niche.name.toLowerCase();
  
  // Extract supporting services from niche keywords
  const nicheKeywords = await prisma.nicheKeyword.findMany({
    where: {
      nicheId: site.nicheId,
      isActive: true,
    },
    take: 10,
  });

  const supportingServices: string[] = [];
  // Simple heuristic: if niche is "hvac", supporting might be "ac repair", "heating repair", etc.
  // For now, we'll derive from keywords or leave empty
  // This can be enhanced later with better service extraction

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

