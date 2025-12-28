/**
 * Deterministic internal link planning
 * 
 * Determines which pages should link to which, based on V1.3 rules
 */

import { Blueprint, BlueprintPage } from '../types';
import { getInternalLinkRule, PageType } from '../generationRules';

export interface InternalLinkPlan {
  from_slug: string;
  to_slugs: string[];
  exact_count: number | null;
}

/**
 * Generate internal link plan for all pages
 */
export function planInternalLinks(blueprint: Blueprint): InternalLinkPlan[] {
  const plans: InternalLinkPlan[] = [];
  
  // Build maps for quick lookup
  const servicePages = blueprint.pages.filter(p => p.page_type === 'service');
  const cityPages = blueprint.pages.filter(p => p.page_type === 'city');
  const allSlugs = new Set(blueprint.pages.map(p => p.slug));
  
  for (const page of blueprint.pages) {
    const rule = getInternalLinkRule(page.page_type as PageType);
    const plan: InternalLinkPlan = {
      from_slug: page.slug,
      to_slugs: [],
      exact_count: rule.exact_count || null,
    };
    
    // Home page: must link to ALL service pages + ALL city pages + about/contact/terms
    if (page.page_type === 'home') {
      plan.to_slugs.push(...servicePages.map(p => p.slug));
      plan.to_slugs.push(...cityPages.map(p => p.slug));
      
      // Add required pages
      if (rule.must_include) {
        for (const requiredSlug of rule.must_include) {
          if (allSlugs.has(requiredSlug)) {
            plan.to_slugs.push(requiredSlug);
          }
        }
      }
    }
    
    // Service pages: exactly 2 links from allowed sources
    else if (page.page_type === 'service' && rule.exact_count) {
      const allowed = rule.allowed_sources || [];
      
      // Always include home if allowed
      if (allowed.includes('/')) {
        plan.to_slugs.push('/');
      }
      
      // Always include contact if allowed
      if (allowed.includes('/contact')) {
        plan.to_slugs.push('/contact');
      }
      
      // Add up to 3 city pages (deterministically selected)
      const citySlugs = cityPages.map(p => p.slug);
      const cityCount = Math.min(3, citySlugs.length);
      const selectedCities = citySlugs.slice(0, cityCount);
      plan.to_slugs.push(...selectedCities);
      
      // Trim to exact count if needed
      if (plan.to_slugs.length > rule.exact_count) {
        plan.to_slugs = plan.to_slugs.slice(0, rule.exact_count);
      }
    }
    
    // City pages: exactly 2 links
    else if (page.page_type === 'city' && rule.exact_count) {
      const allowed = rule.allowed_sources || [];
      
      // Always include home
      if (allowed.includes('/')) {
        plan.to_slugs.push('/');
      }
      
      // Always include contact
      if (allowed.includes('/contact')) {
        plan.to_slugs.push('/contact');
      }
      
      // Add primary service page (deterministically: first service page)
      const primaryService = servicePages[0];
      if (primaryService) {
        plan.to_slugs.push(primaryService.slug);
      }
      
      // Trim to exact count
      if (plan.to_slugs.length > rule.exact_count) {
        plan.to_slugs = plan.to_slugs.slice(0, rule.exact_count);
      }
    }
    
    // About page: exactly 2 links
    else if (page.page_type === 'about' && rule.exact_count) {
      const allowed = rule.allowed_sources || [];
      if (allowed.includes('/')) plan.to_slugs.push('/');
      if (allowed.includes('/contact')) plan.to_slugs.push('/contact');
      
      // Trim to exact count
      if (plan.to_slugs.length > rule.exact_count) {
        plan.to_slugs = plan.to_slugs.slice(0, rule.exact_count);
      }
    }
    
    // Contact page: exactly 1 link
    else if (page.page_type === 'contact' && rule.exact_count) {
      const allowed = rule.allowed_sources || [];
      if (allowed.includes('/')) {
        plan.to_slugs.push('/');
      }
    }
    
    // Terms page: exactly 2 links
    else if (page.page_type === 'terms' && rule.exact_count) {
      const allowed = rule.allowed_sources || [];
      if (allowed.includes('/')) plan.to_slugs.push('/');
      if (allowed.includes('/contact')) plan.to_slugs.push('/contact');
      
      // Trim to exact count
      if (plan.to_slugs.length > rule.exact_count) {
        plan.to_slugs = plan.to_slugs.slice(0, rule.exact_count);
      }
    }
    
    // Blog index: must link to all blog posts
    else if (page.page_type === 'blog_index') {
      const blogPosts = blueprint.pages.filter(p => p.page_type === 'blog_post');
      plan.to_slugs.push(...blogPosts.map(p => p.slug));
    }
    
    // Blog post: must include service_slug + /contact + optional related
    else if (page.page_type === 'blog_post') {
      // This will be handled by blog plan generator
      // For now, add contact
      if (allSlugs.has('/contact')) {
        plan.to_slugs.push('/contact');
      }
    }
    
    plans.push(plan);
  }
  
  return plans;
}

/**
 * Get slug-to-title mapping (deterministic)
 */
export function getSlugToTitle(slug: string, blueprint: Blueprint): string {
  if (slug === '/') return 'Home';
  if (slug === '/about') return 'About Us';
  if (slug === '/contact') return 'Contact Us';
  if (slug === '/terms') return 'Terms & Conditions';
  if (slug === '/blog') return 'Blog';
  
  // Service page: /tree-removal-madison-wi -> "Tree Removal in Madison, WI"
  const servicePage = blueprint.pages.find(p => p.slug === slug && p.page_type === 'service');
  if (servicePage && servicePage.service && servicePage.primary_keyword) {
    // Extract city and state from primary_keyword or use blueprint meta
    const city = servicePage.city || blueprint.site_meta.target_city;
    const state = blueprint.site_meta.state;
    return `${servicePage.service} in ${city}, ${state}`;
  }
  
  // City page: /tree-removal-fitchburg-wi -> "Tree Removal in Fitchburg, WI"
  const cityPage = blueprint.pages.find(p => p.slug === slug && p.page_type === 'city');
  if (cityPage && cityPage.city && cityPage.primary_keyword) {
    const service = cityPage.service || blueprint.site_meta.primary_service;
    const state = blueprint.site_meta.state;
    return `${service} in ${cityPage.city}, ${state}`;
  }
  
  // Blog post: use title from blog plan (will be passed separately)
  // For now, derive from slug
  if (slug.startsWith('/blog/')) {
    const title = slug.replace('/blog/', '').replace(/-/g, ' ');
    return title.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  
  // Fallback: capitalize slug
  return slug
    .replace(/^\//, '')
    .replace(/\//g, ' ')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

