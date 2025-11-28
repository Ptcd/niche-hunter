/**
 * Blueprint Registry
 * 
 * Resolves blueprints by niche and page type.
 * Falls back to generic blueprints if niche-specific not found.
 */

import { PageBlueprint } from './types';
import { hvacBlueprints } from './hvac';
import { genericBlueprints } from './generic';

const blueprintMap: Map<string, Map<string, PageBlueprint>> = new Map();

// Register HVAC blueprints
blueprintMap.set('hvac', new Map(Object.entries(hvacBlueprints)));

/**
 * Get blueprint for a niche and page type
 * Falls back to generic blueprints if niche-specific not found
 */
export function getBlueprint(
  nicheSlug: string,
  pageType: string
): PageBlueprint | null {
  const nicheLower = nicheSlug.toLowerCase();
  const nicheBlueprints = blueprintMap.get(nicheLower);
  
  // Try niche-specific first
  if (nicheBlueprints) {
    const blueprint = nicheBlueprints.get(pageType);
    if (blueprint) {
      return blueprint;
    }
  }
  
  // Fallback to generic blueprints
  return genericBlueprints[pageType] || null;
}

/**
 * Get all page types available for a niche
 */
export function getAvailablePageTypes(nicheSlug: string): string[] {
  const nicheBlueprints = blueprintMap.get(nicheSlug.toLowerCase());
  if (!nicheBlueprints) {
    return [];
  }
  
  return Array.from(nicheBlueprints.keys());
}

/**
 * Check if a niche has blueprints
 */
export function hasBlueprints(nicheSlug: string): boolean {
  return blueprintMap.has(nicheSlug.toLowerCase());
}


