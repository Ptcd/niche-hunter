/**
 * Schema Markup Generator
 * 
 * Generates JSON-LD structured data for SEO (LocalBusiness, FAQPage, Service, etc.)
 */

import type { BrandInfo } from './semanticHtmlBuilder';

export interface SchemaOptions {
  brand: BrandInfo;
  pageType: string;
  focusKeyword?: string;
  faqItems?: Array<{ question: string; answer: string }>;
  serviceName?: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
}

/**
 * Generate LocalBusiness schema (for all pages)
 */
function generateLocalBusinessSchema(brand: BrandInfo): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: brand.name,
    telephone: brand.phoneClean,
    email: brand.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: brand.city,
      addressRegion: brand.state,
      addressCountry: 'US',
    },
    url: brand.domain ? `https://${brand.domain}` : undefined,
  };
}

/**
 * Generate Service schema (for service pages)
 */
function generateServiceSchema(brand: BrandInfo, serviceName: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: serviceName,
    provider: {
      '@type': 'LocalBusiness',
      name: brand.name,
      telephone: brand.phoneClean,
      address: {
        '@type': 'PostalAddress',
        addressLocality: brand.city,
        addressRegion: brand.state,
        addressCountry: 'US',
      },
    },
    areaServed: {
      '@type': 'City',
      name: brand.city,
    },
  };
}

/**
 * Generate FAQPage schema
 */
function generateFAQSchema(faqItems: Array<{ question: string; answer: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

/**
 * Generate BreadcrumbList schema
 */
function generateBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

/**
 * Generate all relevant schemas for a page
 */
export function generateSchemaMarkup(options: SchemaOptions): string {
  const schemas: object[] = [];
  
  // Always include LocalBusiness
  schemas.push(generateLocalBusinessSchema(options.brand));
  
  // Add Service schema for service pages
  if (options.pageType === 'primary_service' || options.pageType === 'CORE_SERVICE') {
    if (options.serviceName || options.focusKeyword) {
      schemas.push(generateServiceSchema(
        options.brand,
        options.serviceName || options.focusKeyword || 'Service'
      ));
    }
  }
  
  // Add FAQ schema if FAQ items provided
  if (options.faqItems && options.faqItems.length > 0) {
    schemas.push(generateFAQSchema(options.faqItems));
  }
  
  // Add BreadcrumbList if breadcrumbs provided
  if (options.breadcrumbs && options.breadcrumbs.length > 0) {
    schemas.push(generateBreadcrumbSchema(options.breadcrumbs));
  }
  
  // If multiple schemas, wrap in array; otherwise return single schema
  if (schemas.length === 0) {
    return '';
  }
  
  if (schemas.length === 1) {
    return JSON.stringify(schemas[0], null, 2);
  }
  
  // Multiple schemas - return as array
  return JSON.stringify(schemas, null, 2);
}

/**
 * Extract FAQ items from HTML content (for schema generation)
 * Looks for <details> elements or Q: / A: patterns
 */
export function extractFAQFromContent(content: string): Array<{ question: string; answer: string }> {
  const faqItems: Array<{ question: string; answer: string }> = [];
  
  // Try to find <details> elements (semantic HTML FAQ format)
  const detailsRegex = /<details[^>]*>\s*<summary[^>]*>(.*?)<\/summary>\s*(.*?)<\/details>/gis;
  let match;
  
  while ((match = detailsRegex.exec(content)) !== null) {
    const question = match[1].replace(/<[^>]+>/g, '').trim();
    const answer = match[2].replace(/<[^>]+>/g, '').trim();
    
    if (question && answer) {
      faqItems.push({ question, answer });
    }
  }
  
  // Fallback: Look for Q: / A: patterns
  if (faqItems.length === 0) {
    const qaRegex = /Q:\s*(.*?)\s*A:\s*(.*?)(?=Q:|$)/gis;
    while ((match = qaRegex.exec(content)) !== null) {
      const question = match[1].trim();
      const answer = match[2].trim();
      
      if (question && answer) {
        faqItems.push({ question, answer });
      }
    }
  }
  
  return faqItems;
}

