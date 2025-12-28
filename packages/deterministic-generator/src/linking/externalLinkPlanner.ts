/**
 * Deterministic external link planning
 * 
 * Selects external resources based on state and service type
 */

import { Blueprint } from '../types';

/**
 * State resource whitelist (government/authority sites by state)
 */
const STATE_RESOURCES: Record<string, { url: string; name: string; anchorText?: string }> = {
  WI: {
    url: 'https://dsps.wi.gov/Pages/Home.aspx',
    name: 'Wisconsin Department of Safety and Professional Services',
    anchorText: 'Wisconsin licensing information',
  },
  FL: {
    url: 'https://www.myfloridalicense.com/',
    name: 'Florida Department of Business and Professional Regulation',
    anchorText: 'Florida licensing information',
  },
  TX: {
    url: 'https://www.tdlr.texas.gov/',
    name: 'Texas Department of Licensing and Regulation',
    anchorText: 'Texas licensing information',
  },
  CA: {
    url: 'https://www.dca.ca.gov/',
    name: 'California Department of Consumer Affairs',
    anchorText: 'California licensing information',
  },
  // Add more states as needed
};

/**
 * Wiki service resources (generic Wikipedia pages by service type)
 */
const WIKI_SERVICE_RESOURCES: Record<string, { url: string; name: string; anchorText?: string }> = {
  'tree removal': {
    url: 'https://en.wikipedia.org/wiki/Tree_removal',
    name: 'Wikipedia - Tree Removal',
    anchorText: 'Tree removal information',
  },
  'tree trimming': {
    url: 'https://en.wikipedia.org/wiki/Tree_care',
    name: 'Wikipedia - Tree Care',
    anchorText: 'Tree care information',
  },
  'hvac': {
    url: 'https://en.wikipedia.org/wiki/HVAC',
    name: 'Wikipedia - HVAC',
    anchorText: 'HVAC information',
  },
  'plumbing': {
    url: 'https://en.wikipedia.org/wiki/Plumbing',
    name: 'Wikipedia - Plumbing',
    anchorText: 'Plumbing information',
  },
  'roofing': {
    url: 'https://en.wikipedia.org/wiki/Roofing',
    name: 'Wikipedia - Roofing',
    anchorText: 'Roofing information',
  },
  'electrical': {
    url: 'https://en.wikipedia.org/wiki/Electrical_wiring',
    name: 'Wikipedia - Electrical Wiring',
    anchorText: 'Electrical wiring information',
  },
  // Add more services as needed
};

/**
 * Get state resource for a given state
 */
export function getStateResource(state: string): { url: string; name: string; anchorText: string } | null {
  const stateUpper = state.toUpperCase();
  const resource = STATE_RESOURCES[stateUpper];
  
  if (!resource) {
    return null;
  }
  
  return {
    url: resource.url,
    name: resource.name,
    anchorText: resource.anchorText || resource.name,
  };
}

/**
 * Get wiki service resource for a given service
 */
export function getWikiServiceResource(service: string): { url: string; name: string; anchorText: string } | null {
  const serviceLower = service.toLowerCase();
  
  // Try exact match first
  let resource = WIKI_SERVICE_RESOURCES[serviceLower];
  
  // Try partial match
  if (!resource) {
    for (const [key, value] of Object.entries(WIKI_SERVICE_RESOURCES)) {
      if (serviceLower.includes(key) || key.includes(serviceLower)) {
        resource = value;
        break;
      }
    }
  }
  
  if (!resource) {
    // Fallback: generic service Wikipedia search
    const searchTerm = encodeURIComponent(service);
    return {
      url: `https://en.wikipedia.org/wiki/Special:Search/${searchTerm}`,
      name: `Wikipedia - ${service}`,
      anchorText: `${service} information`,
    };
  }
  
  return {
    url: resource.url,
    name: resource.name,
    anchorText: resource.anchorText || resource.name,
  };
}

/**
 * Plan external links for a page
 */
export function planExternalLink(
  blueprint: Blueprint,
  pageSlug: string,
  placeholderType: 'STATE_RESOURCE' | 'WIKI_SERVICE'
): { url: string; anchorText: string; html: string } | null {
  if (placeholderType === 'STATE_RESOURCE') {
    const resource = getStateResource(blueprint.site_meta.state);
    if (!resource) {
      return null;
    }
    
    return {
      url: resource.url,
      anchorText: resource.anchorText,
      html: `<a href="${resource.url}" target="_blank" rel="noopener noreferrer">${resource.anchorText}</a>`,
    };
  }
  
  if (placeholderType === 'WIKI_SERVICE') {
    const resource = getWikiServiceResource(blueprint.site_meta.primary_service);
    if (!resource) {
      return null;
    }
    
    return {
      url: resource.url,
      anchorText: resource.anchorText,
      html: `<a href="${resource.url}" target="_blank" rel="noopener noreferrer">${resource.anchorText}</a>`,
    };
  }
  
  return null;
}

/**
 * Determine which external placeholder to use for a page
 * Deterministic: if STATE_RESOURCE exists for state, use it; otherwise use WIKI_SERVICE
 */
export function selectExternalPlaceholder(blueprint: Blueprint): 'STATE_RESOURCE' | 'WIKI_SERVICE' {
  const stateResource = getStateResource(blueprint.site_meta.state);
  return stateResource ? 'STATE_RESOURCE' : 'WIKI_SERVICE';
}

