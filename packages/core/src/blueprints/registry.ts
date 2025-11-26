/**
 * Blueprint Registry
 * 
 * Resolves blueprints by niche and page type.
 */

import { PageBlueprint } from './types';
import { hvacBlueprints } from './hvac';

const blueprintMap: Map<string, Map<string, PageBlueprint>> = new Map();

// Register HVAC blueprints
blueprintMap.set('hvac', new Map(Object.entries(hvacBlueprints)));

/**
 * Get blueprint for a niche and page type
 */
export function getBlueprint(
  nicheSlug: string,
  pageType: string
): PageBlueprint | null {
  const nicheBlueprints = blueprintMap.get(nicheSlug.toLowerCase());
  if (!nicheBlueprints) {
    return null;
  }
  
  return nicheBlueprints.get(pageType) || null;
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


