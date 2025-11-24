/**
 * SERP Types
 * 
 * Shared types for SERP (Search Engine Results Page) data structures.
 * These types are used by both core and crawler packages.
 */

export interface OrganicResult {
  domain: string;
  url: string;
  title: string;
  snippet: string;
  position: number;
}

export interface LocalBusiness {
  name: string;
  category: string;
  rating: number | null;
  reviewsCount: number | null;
  websiteDomain: string | null;
  address?: string;
}

