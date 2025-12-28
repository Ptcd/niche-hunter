/**
 * Blueprint Generator
 * 
 * Generates sitemap + interlink graph from site input
 */

import OpenAI from 'openai';
import { SiteInput, LocalContext, Blueprint, BlueprintPage } from '../types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate slug for a service page
 */
function generateServiceSlug(service: string, targetCity: string, state: string): string {
  const serviceSlug = service.toLowerCase().replace(/\s+/g, '-');
  const citySlug = targetCity.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  return `/${serviceSlug}-${citySlug}-${stateSlug}`;
}

/**
 * Generate slug for a city page
 */
function generateCitySlug(primaryService: string, city: string, state: string): string {
  const serviceSlug = primaryService.toLowerCase().replace(/\s+/g, '-');
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  return `/${serviceSlug}-${citySlug}-${stateSlug}`;
}

/**
 * Generate blueprint from site input and local context
 */
export async function generateBlueprint(
  siteInput: SiteInput,
  localContext: LocalContext
): Promise<Blueprint> {
  const pages: BlueprintPage[] = [];
  const allSlugs = new Set<string>();
  
  // Home page
  const homePage: BlueprintPage = {
    slug: '/',
    page_type: 'home',
    can_link_to: [],
    primary_keyword: `${siteInput.primary_service} ${siteInput.target_city} ${siteInput.state}`,
    semantic_keywords: siteInput.semantic_keywords_map[siteInput.primary_service] || [],
  };
  pages.push(homePage);
  allSlugs.add('/');
  
  // Service pages
  const servicePages: BlueprintPage[] = [];
  const allServices = [siteInput.primary_service, ...siteInput.supporting_services];
  
  for (const service of allServices) {
    const slug = generateServiceSlug(service, siteInput.target_city, siteInput.state);
    
    // Ensure unique slug
    let uniqueSlug = slug;
    let counter = 2;
    while (allSlugs.has(uniqueSlug)) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
    
    const servicePage: BlueprintPage = {
      slug: uniqueSlug,
      page_type: 'service',
      can_link_to: ['/', '/contact'],
      service,
      primary_keyword: `${service} ${siteInput.target_city} ${siteInput.state}`,
      semantic_keywords: siteInput.semantic_keywords_map[service] || [],
    };
    
    pages.push(servicePage);
    servicePages.push(servicePage);
    allSlugs.add(uniqueSlug);
  }
  
  // City pages (one per nearby city using primary service)
  const cityPages: BlueprintPage[] = [];
  const primaryServiceSlug = servicePages.find(p => p.service === siteInput.primary_service)?.slug || '';
  
  for (const city of localContext.nearby_cities) {
    const slug = generateCitySlug(siteInput.primary_service, city, siteInput.state);
    
    // Ensure unique slug
    let uniqueSlug = slug;
    let counter = 2;
    while (allSlugs.has(uniqueSlug)) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
    
    const cityPage: BlueprintPage = {
      slug: uniqueSlug,
      page_type: 'city',
      can_link_to: ['/', '/contact', primaryServiceSlug],
      city,
      service: siteInput.primary_service,
      primary_keyword: `${siteInput.primary_service} ${city} ${siteInput.state}`,
      semantic_keywords: siteInput.semantic_keywords_map[siteInput.primary_service] || [],
    };
    
    pages.push(cityPage);
    cityPages.push(cityPage);
    allSlugs.add(uniqueSlug);
  }
  
  // About page
  const aboutPage: BlueprintPage = {
    slug: '/about',
    page_type: 'about',
    can_link_to: ['/', '/contact'],
  };
  pages.push(aboutPage);
  allSlugs.add('/about');
  
  // Contact page
  const contactPage: BlueprintPage = {
    slug: '/contact',
    page_type: 'contact',
    can_link_to: ['/'],
  };
  pages.push(contactPage);
  allSlugs.add('/contact');
  
  // Terms page
  const termsPage: BlueprintPage = {
    slug: '/terms',
    page_type: 'terms',
    can_link_to: ['/', '/contact'],
  };
  pages.push(termsPage);
  allSlugs.add('/terms');
  
  // Update home page can_link_to to include all service and city pages
  homePage.can_link_to = [
    ...servicePages.map(p => p.slug),
    ...cityPages.map(p => p.slug),
    '/about',
    '/contact',
    '/terms',
  ];
  
  // Update service pages can_link_to to include up to 3 city pages
  for (const servicePage of servicePages) {
    const citySlugs = cityPages.slice(0, 3).map(p => p.slug);
    servicePage.can_link_to = ['/', '/contact', ...citySlugs];
  }
  
  return {
    site_meta: {
      primary_service: siteInput.primary_service,
      target_city: siteInput.target_city,
      state: siteInput.state,
      business_type: siteInput.business_type,
    },
    pages,
  };
}

