/**
 * Core types for deterministic generator
 */

export interface SiteInput {
  business_name: string;
  cta_phone: string;
  primary_service: string;
  supporting_services: string[];
  target_city: string;
  state: string;
  business_type: 'lead_gen' | 'local_service';
  semantic_keywords_map: Record<string, string[]>;
  top_keywords?: Array<{
    keyword: string;
    volume: number;
  }>;
  blog?: {
    enabled: boolean;
    num_posts: number;
    publish_mode: 'draft' | 'publish';
    avoid_topics: string[];
  };
  external_links_policy: 'default_us';
}

export interface LocalContext {
  nearby_cities: string[];
  landmarks: string[];
}

export interface BlueprintPage {
  slug: string;
  page_type: 'home' | 'service' | 'city' | 'about' | 'contact' | 'terms' | 'blog_index' | 'blog_post';
  can_link_to: string[];
  service?: string;
  city?: string;
  primary_keyword?: string;
  semantic_keywords?: string[];
}

export interface Blueprint {
  site_meta: {
    primary_service: string;
    target_city: string;
    state: string;
    business_type: string;
  };
  pages: BlueprintPage[];
}

export interface BlogPlan {
  blog_index: { slug: string };
  posts: Array<{
    slug: string;
    title: string;
    primary_keyword: string;
    intent: string;
    links_to: {
      service_slug: string;
      contact_slug: string;
      related_post_slug: string | null;
    };
  }>;
}

export interface PagePayload {
  slug: string;
  page_type: string;
  business_name: string;
  cta_phone: string;
  state: string;
  can_link_to: string[];
  external_link_placeholders: string[];
  real_landmarks: string[];
  // Page-type specific
  primary_service?: string;
  target_city?: string;
  primary_keyword?: string;
  semantic_keywords?: string[];
  service?: string;
  city?: string;
  service_pages?: Array<{ slug: string; title: string }>;
  city_pages?: Array<{ slug: string; title: string }>;
}

export interface ValidationReport {
  hard_failures: Array<{
    page_slug: string;
    rule: string;
    message: string;
  }>;
  warnings: Array<{
    page_slug: string;
    rule: string;
    message: string;
  }>;
  needs_regen_pages: string[];
  pass: boolean;
}

export interface RunManifest {
  site_id: string;
  timestamp: string;
  site_input_hash: string;
  model: string;
  temperature: number;
  prompt_version: string;
  pages_generated: string[];
  validation_pass: boolean;
  output_directory: string;
}

export interface RunConfig {
  model: string;
  temperature: number;
  seed?: number;
  prompt_version: string;
  strictness_level: 'strict' | 'moderate' | 'lenient';
  output_directory: string;
}

