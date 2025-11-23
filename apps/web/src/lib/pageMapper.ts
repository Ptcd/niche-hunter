/**
 * Page Mapper Utilities
 * 
 * Utilities for mapping between internal Page models and external PageSpec format.
 */

import type { PageSpec } from "./wpFactoryTypes";

/**
 * Map internal page type to external WordPress type
 */
export function mapInternalTypeToExternal(internalType: string): string {
  const mapping: { [key: string]: string } = {
    "home": "home",
    "primary_service": "service",
    "secondary_service": "service",
    "emergency_service": "service",
    "service_hub": "service",
    "city_page": "city",
    "service_area_hub": "city",
    "about": "about",
    "contact": "contact",
    "faq_page": "faq",
    "blog_support": "blog",
  };
  
  return mapping[internalType] || internalType;
}

/**
 * Map Page record to PageSpec for WordPress
 */
export function mapPageToSpec(page: {
  pageType: string;
  slug: string;
  seoTitle: string | null;
  titleTag: string;
  seoDescription: string | null;
  htmlEdited: string | null;
  htmlDraft: string | null;
  focusKeyword: string;
}): PageSpec {
  return {
    type: mapInternalTypeToExternal(page.pageType),
    slug: page.slug,
    title: page.seoTitle || page.titleTag,
    content: page.htmlEdited || page.htmlDraft || "",
    seoTitle: page.seoTitle || page.titleTag,
    seoDescription: page.seoDescription || "",
    focusKeyword: page.focusKeyword,
  };
}

