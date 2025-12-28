/**
 * Replace placeholders in HTML with actual links
 */

import { PLACEHOLDER_PATTERNS } from './placeholders';
import { getSlugToTitle } from './internalLinkPlanner';
import { planExternalLink, selectExternalPlaceholder } from './externalLinkPlanner';
import { Blueprint } from '../types';

export interface ReplacementResult {
  html: string;
  replacements: Array<{
    placeholder: string;
    replacement: string;
    type: 'internal' | 'external';
  }>;
}

/**
 * Replace all placeholders in HTML
 */
export function replacePlaceholders(
  html: string,
  slug: string,
  blueprint: Blueprint
): ReplacementResult {
  let result = html;
  const replacements: ReplacementResult['replacements'] = [];
  
  // Replace internal links
  result = result.replace(PLACEHOLDER_PATTERNS.INTERNAL, (match, linkSlug) => {
    const title = getSlugToTitle(linkSlug, blueprint);
    const replacement = `<a href="${linkSlug}">${title}</a>`;
    
    replacements.push({
      placeholder: match,
      replacement,
      type: 'internal',
    });
    
    return replacement;
  });
  
  // Replace external STATE_RESOURCE
  result = result.replace(PLACEHOLDER_PATTERNS.EXTERNAL_STATE, (match) => {
    const externalLink = planExternalLink(blueprint, slug, 'STATE_RESOURCE');
    
    if (!externalLink) {
      // If no state resource available, fall back to WIKI_SERVICE
      const wikiLink = planExternalLink(blueprint, slug, 'WIKI_SERVICE');
      if (wikiLink) {
        replacements.push({
          placeholder: match,
          replacement: wikiLink.html,
          type: 'external',
        });
        return wikiLink.html;
      }
      // If no external link available, return placeholder (will fail validation)
      return match;
    }
    
    replacements.push({
      placeholder: match,
      replacement: externalLink.html,
      type: 'external',
    });
    
    return externalLink.html;
  });
  
  // Replace external WIKI_SERVICE
  result = result.replace(PLACEHOLDER_PATTERNS.EXTERNAL_WIKI, (match) => {
    const externalLink = planExternalLink(blueprint, slug, 'WIKI_SERVICE');
    
    if (!externalLink) {
      // If no wiki link available, return placeholder (will fail validation)
      return match;
    }
    
    replacements.push({
      placeholder: match,
      replacement: externalLink.html,
      type: 'external',
    });
    
    return externalLink.html;
  });
  
  // Replace custom external placeholders
  result = result.replace(PLACEHOLDER_PATTERNS.EXTERNAL_CUSTOM, (match, key) => {
    if (key === 'STATE_RESOURCE' || key === 'WIKI_SERVICE') {
      // Already handled above
      return match;
    }
    
    // For custom placeholders, we'd need a custom resource map
    // For now, return placeholder (will fail validation)
    return match;
  });
  
  return {
    html: result,
    replacements,
  };
}

/**
 * Check if all placeholders were replaced
 */
export function allPlaceholdersReplaced(html: string): boolean {
  return !(
    PLACEHOLDER_PATTERNS.INTERNAL.test(html) ||
    PLACEHOLDER_PATTERNS.EXTERNAL_STATE.test(html) ||
    PLACEHOLDER_PATTERNS.EXTERNAL_WIKI.test(html) ||
    PLACEHOLDER_PATTERNS.EXTERNAL_CUSTOM.test(html)
  );
}

