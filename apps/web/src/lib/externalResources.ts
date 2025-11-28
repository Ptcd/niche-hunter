/**
 * External Resources System
 * 
 * Curated list of authoritative external links by niche.
 * Provides 1-2 relevant external links per page for credibility and SEO.
 */

export interface ExternalResource {
  domain: string;
  name: string;
  description: string;
  url: string;
  relevance: string[]; // Keywords/topics this resource is relevant for
}

/**
 * External resources by niche
 */
const RESOURCES_BY_NICHE: { [niche: string]: ExternalResource[] } = {
  hvac: [
    {
      domain: 'energy.gov',
      name: 'Energy.gov',
      description: 'U.S. Department of Energy',
      url: 'https://www.energy.gov/energysaver/heat-and-cool',
      relevance: ['energy efficiency', 'heating', 'cooling', 'hvac', 'furnace', 'air conditioner', 'heat pump'],
    },
    {
      domain: 'energystar.gov',
      name: 'ENERGY STAR',
      description: 'ENERGY STAR certified products',
      url: 'https://www.energystar.gov/products/heating_cooling',
      relevance: ['energy efficient', 'hvac', 'air conditioner', 'furnace', 'heat pump', 'seer'],
    },
    {
      domain: 'acca.org',
      name: 'ACCA',
      description: 'Air Conditioning Contractors of America',
      url: 'https://www.acca.org/',
      relevance: ['hvac', 'air conditioning', 'contractor', 'professional'],
    },
    {
      domain: 'ashrae.org',
      name: 'ASHRAE',
      description: 'American Society of Heating, Refrigerating and Air-Conditioning Engineers',
      url: 'https://www.ashrae.org/',
      relevance: ['hvac', 'heating', 'cooling', 'refrigeration', 'technical'],
    },
    {
      domain: 'epa.gov',
      name: 'EPA',
      description: 'Environmental Protection Agency',
      url: 'https://www.epa.gov/indoor-air-quality-iaq',
      relevance: ['indoor air quality', 'air quality', 'ventilation', 'mold'],
    },
  ],
  
  plumbing: [
    {
      domain: 'epa.gov',
      name: 'EPA WaterSense',
      description: 'EPA WaterSense program',
      url: 'https://www.epa.gov/watersense',
      relevance: ['water efficiency', 'water conservation', 'plumbing', 'fixtures', 'toilets'],
    },
    {
      domain: 'iapmo.org',
      name: 'IAPMO',
      description: 'International Association of Plumbing and Mechanical Officials',
      url: 'https://www.iapmo.org/',
      relevance: ['plumbing', 'plumber', 'code', 'standards'],
    },
    {
      domain: 'cdc.gov',
      name: 'CDC',
      description: 'Centers for Disease Control and Prevention',
      url: 'https://www.cdc.gov/healthywater/drinking/',
      relevance: ['water quality', 'drinking water', 'health', 'safety'],
    },
    {
      domain: 'epa.gov',
      name: 'EPA',
      description: 'Environmental Protection Agency',
      url: 'https://www.epa.gov/ground-water-and-drinking-water',
      relevance: ['water quality', 'drinking water', 'contamination'],
    },
  ],
  
  roofing: [
    {
      domain: 'nrca.net',
      name: 'NRCA',
      description: 'National Roofing Contractors Association',
      url: 'https://www.nrca.net/',
      relevance: ['roofing', 'roof', 'contractor', 'professional'],
    },
    {
      domain: 'energy.gov',
      name: 'Energy.gov',
      description: 'U.S. Department of Energy',
      url: 'https://www.energy.gov/energysaver/roofing',
      relevance: ['roofing', 'energy efficiency', 'insulation', 'cool roof'],
    },
    {
      domain: 'fema.gov',
      name: 'FEMA',
      description: 'Federal Emergency Management Agency',
      url: 'https://www.fema.gov/',
      relevance: ['storm damage', 'hurricane', 'wind damage', 'disaster'],
    },
  ],
  
  electrical: [
    {
      domain: 'nema.org',
      name: 'NEMA',
      description: 'National Electrical Manufacturers Association',
      url: 'https://www.nema.org/',
      relevance: ['electrical', 'equipment', 'safety', 'standards'],
    },
    {
      domain: 'nfpa.org',
      name: 'NFPA',
      description: 'National Fire Protection Association',
      url: 'https://www.nfpa.org/',
      relevance: ['electrical safety', 'fire safety', 'code', 'standards'],
    },
    {
      domain: 'energy.gov',
      name: 'Energy.gov',
      description: 'U.S. Department of Energy',
      url: 'https://www.energy.gov/energysaver/lighting',
      relevance: ['lighting', 'energy efficiency', 'led'],
    },
  ],
  
  general: [
    {
      domain: 'bbb.org',
      name: 'Better Business Bureau',
      description: 'BBB Business Profiles',
      url: 'https://www.bbb.org/',
      relevance: ['business', 'reviews', 'reputation', 'trust'],
    },
    {
      domain: 'consumerreports.org',
      name: 'Consumer Reports',
      description: 'Consumer Reports product reviews',
      url: 'https://www.consumerreports.org/',
      relevance: ['product reviews', 'comparison', 'buying guide'],
    },
  ],
};

/**
 * Get relevant external resources for a page
 * 
 * @param niche - Niche slug (e.g., 'hvac', 'plumbing')
 * @param keywords - Array of keywords/topics on the page
 * @param count - Number of resources to return (default: 2)
 * @returns Array of external resources
 */
export function getExternalResources(
  niche: string,
  keywords: string[],
  count: number = 2
): ExternalResource[] {
  const nicheLower = niche.toLowerCase();
  
  // Get resources for this niche, or fall back to general
  const nicheResources = RESOURCES_BY_NICHE[nicheLower] || RESOURCES_BY_NICHE.general;
  const generalResources = RESOURCES_BY_NICHE.general || [];
  const allResources = [...nicheResources, ...generalResources];
  
  // Score resources by relevance to keywords
  const scoredResources = allResources.map(resource => {
    let score = 0;
    const keywordsLower = keywords.map(k => k.toLowerCase());
    
    for (const keyword of keywordsLower) {
      for (const relevantTerm of resource.relevance) {
        if (keyword.includes(relevantTerm) || relevantTerm.includes(keyword)) {
          score += 2;
        }
      }
    }
    
    // Boost score if resource is niche-specific (not general)
    if (nicheResources.includes(resource)) {
      score += 1;
    }
    
    return { resource, score };
  });
  
  // Sort by score DESC, remove duplicates, return top N
  const uniqueResources = new Map<string, ExternalResource>();
  scoredResources
    .sort((a, b) => b.score - a.score)
    .forEach(({ resource }) => {
      if (!uniqueResources.has(resource.domain)) {
        uniqueResources.set(resource.domain, resource);
      }
    });
  
  const selected = Array.from(uniqueResources.values()).slice(0, count);
  
  // If we don't have enough, fill with general resources
  if (selected.length < count && generalResources.length > 0) {
    for (const general of generalResources) {
      if (selected.length >= count) break;
      if (!selected.find(r => r.domain === general.domain)) {
        selected.push(general);
      }
    }
  }
  
  return selected;
}

/**
 * Format external link for HTML
 */
export function formatExternalLink(resource: ExternalResource, anchorText?: string): string {
  const text = anchorText || resource.name;
  return `<a href="${resource.url}" rel="nofollow noopener noreferrer" target="_blank">${text}</a>`;
}

/**
 * Get external links as HTML string for GPT prompts
 */
export function getExternalLinksForPrompt(
  niche: string,
  keywords: string[],
  count: number = 2
): string {
  const resources = getExternalResources(niche, keywords, count);
  
  if (resources.length === 0) {
    return '';
  }
  
  return resources
    .map(r => `- ${r.name} (${r.domain}): ${r.url} - ${r.description}`)
    .join('\n');
}

