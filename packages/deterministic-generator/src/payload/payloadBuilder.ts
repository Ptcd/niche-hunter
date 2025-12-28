/**
 * Payload Builder
 * 
 * Assembles page payloads from blueprint, site input, and local context
 */

import { SiteInput, LocalContext, Blueprint, BlueprintPage, PagePayload } from '../types';
import { selectExternalPlaceholder } from '../linking/externalLinkPlanner';

/**
 * Deterministic landmark rotation via hash
 */
function selectLandmark(slug: string, landmarks: string[]): string[] {
  if (landmarks.length === 0) return [];
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash) + slug.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const index = Math.abs(hash) % landmarks.length;
  return [landmarks[index]];
}

/**
 * Build page payload from blueprint page
 */
export function buildPagePayload(
  blueprintPage: BlueprintPage,
  siteInput: SiteInput,
  localContext: LocalContext,
  blueprint: Blueprint
): PagePayload {
  const payload: PagePayload = {
    slug: blueprintPage.slug,
    page_type: blueprintPage.page_type,
    business_name: siteInput.business_name,
    cta_phone: siteInput.cta_phone,
    state: siteInput.state.toLowerCase(),
    can_link_to: blueprintPage.can_link_to,
    external_link_placeholders: [],
    real_landmarks: [],
  };
  
  // Determine external placeholder
  const externalPlaceholder = selectExternalPlaceholder(blueprint);
  payload.external_link_placeholders = [`[[EXTERNAL:${externalPlaceholder}]]`];
  
  // Select landmarks deterministically
  if (localContext.landmarks.length > 0) {
    payload.real_landmarks = selectLandmark(blueprintPage.slug, localContext.landmarks);
  }
  
  // Page-type specific fields
  if (blueprintPage.page_type === 'home') {
    payload.primary_service = siteInput.primary_service;
    payload.target_city = siteInput.target_city;
    payload.primary_keyword = blueprintPage.primary_keyword || `${siteInput.primary_service} ${siteInput.target_city} ${siteInput.state}`;
    payload.semantic_keywords = blueprintPage.semantic_keywords || siteInput.semantic_keywords_map[siteInput.primary_service] || [];
    
    // Add service and city page lists for home page
    const servicePages = blueprint.pages.filter(p => p.page_type === 'service');
    const cityPages = blueprint.pages.filter(p => p.page_type === 'city');
    
    payload.service_pages = servicePages.map(p => ({
      slug: p.slug,
      title: p.service || '',
    }));
    
    payload.city_pages = cityPages.map(p => ({
      slug: p.slug,
      title: p.city || '',
    }));
  } else if (blueprintPage.page_type === 'service') {
    payload.service = blueprintPage.service || siteInput.primary_service;
    payload.target_city = siteInput.target_city;
    payload.primary_keyword = blueprintPage.primary_keyword || `${blueprintPage.service} ${siteInput.target_city} ${siteInput.state}`;
    payload.semantic_keywords = blueprintPage.semantic_keywords || siteInput.semantic_keywords_map[blueprintPage.service || ''] || [];
  } else if (blueprintPage.page_type === 'city') {
    payload.service = blueprintPage.service || siteInput.primary_service;
    payload.city = blueprintPage.city;
    payload.primary_keyword = blueprintPage.primary_keyword || `${blueprintPage.service} ${blueprintPage.city} ${siteInput.state}`;
    payload.semantic_keywords = blueprintPage.semantic_keywords || siteInput.semantic_keywords_map[blueprintPage.service || ''] || [];
  }
  
  return payload;
}

/**
 * Build all page payloads from blueprint
 */
export function buildAllPagePayloads(
  blueprint: Blueprint,
  siteInput: SiteInput,
  localContext: LocalContext
): PagePayload[] {
  return blueprint.pages.map(page => 
    buildPagePayload(page, siteInput, localContext, blueprint)
  );
}

