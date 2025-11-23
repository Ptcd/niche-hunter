/**
 * Blueprint Type Definitions
 * 
 * Defines the structure for page and section blueprints that drive
 * content generation with keyword role-based semantic structure.
 */

export type KeywordRole =
  | 'primary_service_city'
  | 'primary_service'
  | 'service_category'
  | 'city'
  | 'neighborhood'
  | 'problem_symptom'
  | 'benefit_outcome'
  | 'modifier_urgency'
  | 'brand_name'
  | 'supporting_longtail'
  | 'topical_entity';

export interface KeywordRules {
  requiredEach: number;        // min uses per required role in this section
  recommendedMaxEach: number;  // cap per recommended role per section
  optionalMaxEach: number;     // cap per optional role per section
}

export interface SectionBlueprint {
  id: string;
  slot: string;                // "hero", "section_1", "faq", "cta_bottom", etc.
  purpose: string;
  titleTemplates: string[];    // with {{PLACEHOLDERS}}
  minWords: number;
  maxWords: number;
  requiredKeywordRoles: KeywordRole[];
  recommendedKeywordRoles: KeywordRole[];
  optionalKeywordRoles: KeywordRole[];
  keywordRules: KeywordRules;
  internalLinkTargets: string[]; // abstract: "service_pages","city_pages","contact"
  schemaHints?: string[];       // e.g., ["FAQPage"]
  includeIf?: (args: {
    focusKeyword: string;
    supportingKeywords: string[];
    keywordRoles: Map<KeywordRole, string[]>;
  }) => boolean;
}

export interface PageKeywordTargets {
  [role: string]: { min: number; max: number };
}

export interface PageVariant {
  variantId: string;
  description: string;
  targetWordCount: { min: number; max: number };
  pageKeywordTargets: PageKeywordTargets;
  sectionOrder: string[];      // list of section ids in order
}

export interface PageBlueprint {
  pageType:
    | 'home'
    | 'service_hub'
    | 'primary_service'
    | 'secondary_service'
    | 'emergency_service'
    | 'city_page'
    | 'service_area_hub'
    | 'faq_page'
    | 'blog_support'
    | 'about'
    | 'contact';
  variants: PageVariant[];
  sections: SectionBlueprint[];
}

export interface NicheBlueprints {
  [pageType: string]: PageBlueprint;
}

/**
 * Context for applying blueprints to a page
 */
export interface BlueprintContext {
  niche: string;
  city: string;
  state: string;
  brandName?: string;
  focusKeyword: string;
  supportingKeywords: string[];
  keywordRoles: Map<KeywordRole, string[]>;
  variantId?: string;
}

/**
 * Result of applying a blueprint to a page
 */
export interface AppliedSkeleton {
  sectionId: string;
  heading: string;
  purpose: string;
  requiredKeywordRoles: KeywordRole[];
  optionalKeywordRoles: KeywordRole[];
  localHints: string[];
  styleVariant: string;
  targetWordCount: number;
  minWords: number;
  maxWords: number;
  orderIndex: number;
}

