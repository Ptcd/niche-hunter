/**
 * WordPress Factory Types
 * 
 * Shared types for communicating with the WordPress factory plugin.
 */

export type BrandSpec = {
  name: string;
  phonePretty: string;     // "(414) 555-1234"
  phoneClean: string;      // "14145551234" (for tel:)
  email: string;
  city: string;
  state: string;
  logoUrl?: string;        // URL to logo image (optional)
};

export type PageSpec = {
  type: string;            // 'home' | 'about' | 'contact' | 'service' | 'city' | 'privacy' | 'terms' | ...
  slug: string;           // 'about', 'contact', '' for home, etc.
  title: string;          // Page title (e.g. "HVAC Repair in Wesley Chapel, FL | Brand")
  content: string;        // Full HTML body; can include tokens like {{URL_CONTACT}}
  seoTitle: string;       // Meta title
  seoDescription: string; // Meta description
  focusKeyword: string;   // Primary SEO keyword
};

