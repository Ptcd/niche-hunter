/**
 * Blueprint Builder
 * 
 * Applies blueprints to pages, generating content skeletons with
 * token replacement and keyword role assignment.
 */

import { PageBlueprint, BlueprintContext, AppliedSkeleton, KeywordRole } from './types';
import { getBlueprint } from './registry';

/**
 * Replace tokens in template strings
 */
function replaceTokens(
  template: string,
  context: BlueprintContext
): string {
  let result = template;
  
  // Get keyword values from roles
  // Extract service name from focus keyword if it contains " in " (e.g., "ac repair in Wesley Chapel" -> "ac repair")
  const focusKeywordService = context.focusKeyword?.split(' in ')[0]?.trim() || '';
  
  const primaryService = context.keywordRoles.get('primary_service')?.[0] || 
                         focusKeywordService || 
                         context.focusKeyword || 
                         context.niche;
  const primaryServiceCity = context.keywordRoles.get('primary_service_city')?.[0] || 
                             (focusKeywordService ? `${focusKeywordService} ${context.city}` : `${primaryService} ${context.city}`);
  const serviceCategory = context.keywordRoles.get('service_category')?.[0] || 
                          focusKeywordService || 
                          context.focusKeyword || 
                          context.niche;
  const brandName = context.brandName || context.niche;
  
  // Replace tokens
  result = result.replace(/\{\{PRIMARY_SERVICE_CITY\}\}/g, primaryServiceCity);
  result = result.replace(/\{\{PRIMARY_SERVICE\}\}/g, primaryService);
  result = result.replace(/\{\{SERVICE_CATEGORY\}\}/g, serviceCategory);
  result = result.replace(/\{\{CITY\}\}/g, context.city);
  result = result.replace(/\{\{STATE\}\}/g, context.state);
  result = result.replace(/\{\{BRAND_NAME\}\}/g, brandName);
  result = result.replace(/\{\{SERVICE_SHORT\}\}/g, primaryService.split(' ')[0] || primaryService);
  
  return result;
}

/**
 * Get local hints based on state/climate
 */
function getLocalHints(state: string): string[] {
  const hints: string[] = [];
  const stateUpper = state.toUpperCase();
  
  // Climate-based hints
  if (['FL', 'TX', 'AZ', 'CA', 'NV', 'NM'].includes(stateUpper)) {
    hints.push('mention hot summers and high humidity');
    hints.push('reference energy efficiency in hot climates');
  }
  
  if (['MN', 'WI', 'MI', 'ND', 'SD', 'MT', 'WY', 'ME', 'NH', 'VT'].includes(stateUpper)) {
    hints.push('mention cold winters and heating needs');
    hints.push('reference furnace efficiency and insulation');
  }
  
  if (['CA', 'OR', 'WA'].includes(stateUpper)) {
    hints.push('mention moderate climate and year-round comfort');
  }
  
  // Regional building types
  if (['FL', 'TX', 'CA'].includes(stateUpper)) {
    hints.push('reference common building types in the region');
  }
  
  return hints;
}

/**
 * Select variant based on keyword roles
 */
function selectVariant(
  blueprint: PageBlueprint,
  context: BlueprintContext
): string {
  // If variant specified, use it
  if (context.variantId) {
    const variant = blueprint.variants.find(v => v.variantId === context.variantId);
    if (variant) return variant.variantId;
  }
  
  // Auto-select based on keyword roles
  const problemCount = context.keywordRoles.get('problem_symptom')?.length || 0;
  const urgencyCount = context.keywordRoles.get('modifier_urgency')?.length || 0;
  
  // Problem-first if we have many problem keywords
  if (problemCount >= 5 && blueprint.variants.some(v => v.variantId.includes('problem'))) {
    return blueprint.variants.find(v => v.variantId.includes('problem'))?.variantId || blueprint.variants[0].variantId;
  }
  
  // Urgency-first if we have urgency keywords
  if (urgencyCount >= 3 && blueprint.variants.some(v => v.variantId.includes('emergency'))) {
    return blueprint.variants.find(v => v.variantId.includes('emergency'))?.variantId || blueprint.variants[0].variantId;
  }
  
  // Default: first variant
  return blueprint.variants[0].variantId;
}

/**
 * Apply blueprint to a page, generating content skeletons
 */
export function applyBlueprintToPage(
  nicheSlug: string,
  pageType: string,
  context: BlueprintContext
): AppliedSkeleton[] {
  const blueprint = getBlueprint(nicheSlug, pageType);
  if (!blueprint) {
    throw new Error(`No blueprint found for niche: ${nicheSlug}, pageType: ${pageType}`);
  }
  
  // Select variant
  const variantId = selectVariant(blueprint, context);
  const variant = blueprint.variants.find(v => v.variantId === variantId);
  if (!variant) {
    throw new Error(`Variant ${variantId} not found in blueprint`);
  }
  
  // Get section order from variant
  const sectionOrder = variant.sectionOrder;
  
  // Build skeletons
  const skeletons: AppliedSkeleton[] = [];
  let orderIndex = 0;
  
  for (const sectionId of sectionOrder) {
    const section = blueprint.sections.find(s => s.id === sectionId);
    if (!section) {
      console.warn(`Section ${sectionId} not found in blueprint`);
      continue;
    }
    
    // Check conditional inclusion
    if (section.includeIf) {
      const shouldInclude = section.includeIf({
        focusKeyword: context.focusKeyword,
        supportingKeywords: context.supportingKeywords,
        keywordRoles: context.keywordRoles,
      });
      
      if (!shouldInclude) {
        continue;
      }
    }
    
    // Select title template (use first for now, could randomize)
    const titleTemplate = section.titleTemplates[0] || section.id;
    const heading = replaceTokens(titleTemplate, context);
    
    // Get local hints
    const localHints = getLocalHints(context.state);
    
    // Determine style variant
    let styleVariant = 'straight'; // Default value
    const urgencyKeywords = context.keywordRoles.get('modifier_urgency');
    if (urgencyKeywords && urgencyKeywords.length > 0) {
      styleVariant = 'urgency';
    }
    
    skeletons.push({
      sectionId: section.id,
      heading,
      purpose: section.purpose,
      requiredKeywordRoles: section.requiredKeywordRoles,
      optionalKeywordRoles: section.optionalKeywordRoles,
      localHints,
      styleVariant,
      targetWordCount: section.maxWords,
      minWords: section.minWords,
      maxWords: section.maxWords,
      orderIndex,
    });
    
    orderIndex++;
  }
  
  return skeletons;
}

/**
 * Get page-level keyword targets from blueprint
 */
export function getPageKeywordTargets(
  nicheSlug: string,
  pageType: string,
  variantId?: string
): { [role: string]: { min: number; max: number } } | null {
  const blueprint = getBlueprint(nicheSlug, pageType);
  if (!blueprint) {
    return null;
  }
  
  const variant = variantId
    ? blueprint.variants.find(v => v.variantId === variantId)
    : blueprint.variants[0];
  
  if (!variant) {
    return null;
  }
  
  return variant.pageKeywordTargets;
}

