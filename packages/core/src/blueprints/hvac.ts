/**
 * HVAC Niche Blueprints
 * 
 * Complete blueprint definitions for HVAC service websites.
 * Based on the comprehensive blueprint specification.
 */

import { PageBlueprint, SectionBlueprint, KeywordRole } from './types';

// Helper to create standard keyword rules
const standardRules = {
  requiredEach: 2,
  recommendedMaxEach: 3,
  optionalMaxEach: 2,
};

const lightRules = {
  requiredEach: 1,
  recommendedMaxEach: 3,
  optionalMaxEach: 2,
};

// HOME PAGE SECTIONS
const homeSections: SectionBlueprint[] = [
  {
    id: 'hero_intro',
    slot: 'hero',
    purpose: 'Say who you are, what you do, where you do it, and invite to call.',
    titleTemplates: [
      '{{SERVICE_CATEGORY}} in {{CITY}} – {{BRAND_NAME}}',
      'Your Local {{SERVICE_CATEGORY}} Experts in {{CITY}}',
    ],
    minWords: 220,
    maxWords: 350,
    requiredKeywordRoles: ['primary_service_city', 'service_category', 'city', 'brand_name'],
    recommendedKeywordRoles: ['primary_service', 'benefit_outcome'],
    optionalKeywordRoles: ['modifier_urgency'],
    keywordRules: standardRules,
    internalLinkTargets: ['service_hub', 'contact'],
  },
  {
    id: 'quick_benefits',
    slot: 'section_1',
    purpose: '3-6 bullets on why you\'re better.',
    titleTemplates: [
      'Why {{CITY}} Chooses {{BRAND_NAME}}',
      'What You Get with Our {{SERVICE_CATEGORY}}',
    ],
    minWords: 180,
    maxWords: 260,
    requiredKeywordRoles: ['service_category'],
    recommendedKeywordRoles: ['benefit_outcome', 'city'],
    optionalKeywordRoles: ['primary_service'],
    keywordRules: lightRules,
    internalLinkTargets: ['contact'],
  },
  {
    id: 'core_services_overview',
    slot: 'section_2',
    purpose: 'Introduce main services and link to their pages.',
    titleTemplates: [
      'Our {{SERVICE_CATEGORY}}',
      'Services We Offer in {{CITY}}',
    ],
    minWords: 260,
    maxWords: 380,
    requiredKeywordRoles: ['service_category', 'city'],
    recommendedKeywordRoles: ['primary_service', 'supporting_longtail'],
    optionalKeywordRoles: ['topical_entity'],
    keywordRules: lightRules,
    internalLinkTargets: ['primary_service_pages', 'secondary_service_pages'],
  },
  {
    id: 'why_choose_us',
    slot: 'section_3',
    purpose: 'Trust — experience, licensing, guarantees, reviews.',
    titleTemplates: [
      'Why Work with {{BRAND_NAME}}',
      'Local Pros Who Know {{CITY}}',
    ],
    minWords: 250,
    maxWords: 350,
    requiredKeywordRoles: ['brand_name'],
    recommendedKeywordRoles: ['city', 'benefit_outcome'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    internalLinkTargets: ['about', 'reviews_page', 'contact'],
  },
  {
    id: 'how_it_works',
    slot: 'section_4',
    purpose: '3–5 step process to reduce friction.',
    titleTemplates: [
      'How Our {{SERVICE_CATEGORY}} Process Works',
      'Getting Started is Simple',
    ],
    minWords: 200,
    maxWords: 300,
    requiredKeywordRoles: ['service_category'],
    recommendedKeywordRoles: ['primary_service', 'city'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    internalLinkTargets: ['contact', 'primary_service_pages'],
  },
  {
    id: 'service_areas_summary',
    slot: 'section_5',
    purpose: 'List city + key suburbs/areas and link to city pages.',
    titleTemplates: [
      'Areas We Serve',
      'Serving {{CITY}} and Nearby Communities',
    ],
    minWords: 180,
    maxWords: 260,
    requiredKeywordRoles: ['city'],
    recommendedKeywordRoles: ['neighborhood'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    internalLinkTargets: ['service_area_hub', 'city_pages'],
  },
  {
    id: 'homepage_faq',
    slot: 'section_6',
    purpose: '4–7 FAQs that hit objections.',
    titleTemplates: [
      'Questions from {{CITY}} Customers',
      '{{SERVICE_CATEGORY}} FAQ for {{CITY}}',
    ],
    minWords: 300,
    maxWords: 450,
    requiredKeywordRoles: ['service_category'],
    recommendedKeywordRoles: ['primary_service_city', 'problem_symptom'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    schemaHints: ['FAQPage'],
    internalLinkTargets: ['primary_service_pages', 'faq_page', 'contact'],
  },
  {
    id: 'final_cta',
    slot: 'cta_bottom',
    purpose: 'Punchy closing CTA.',
    titleTemplates: [
      'Ready for {{PRIMARY_SERVICE}} in {{CITY}}?',
    ],
    minWords: 80,
    maxWords: 150,
    requiredKeywordRoles: ['primary_service_city'],
    recommendedKeywordRoles: [],
    optionalKeywordRoles: [],
    keywordRules: { requiredEach: 1, recommendedMaxEach: 0, optionalMaxEach: 0 },
    internalLinkTargets: ['contact'],
  },
];

// PRIMARY SERVICE PAGE SECTIONS
const primaryServiceSections: SectionBlueprint[] = [
  {
    id: 'hero_service',
    slot: 'hero',
    purpose: 'Introduce the service in the city context.',
    titleTemplates: [
      '{{PRIMARY_SERVICE}} in {{CITY}}',
      'Need {{PRIMARY_SERVICE}} in {{CITY}}? {{BRAND_NAME}} Can Help',
    ],
    minWords: 220,
    maxWords: 320,
    requiredKeywordRoles: ['primary_service_city', 'primary_service', 'city'],
    recommendedKeywordRoles: ['modifier_urgency', 'benefit_outcome'],
    optionalKeywordRoles: [],
    keywordRules: standardRules,
    internalLinkTargets: ['contact', 'service_hub'],
  },
  {
    id: 'problems_section',
    slot: 'section_1',
    purpose: 'Spell out symptoms/risks.',
    titleTemplates: [
      'Common {{PRIMARY_SERVICE}} Problems in {{CITY}}',
      'Signs You Need {{PRIMARY_SERVICE}}',
    ],
    minWords: 220,
    maxWords: 320,
    requiredKeywordRoles: ['problem_symptom', 'primary_service'],
    recommendedKeywordRoles: ['city'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    internalLinkTargets: ['blog_support_posts', 'service_faq'],
    includeIf: (args) => {
      const problemSymptoms = args.keywordRoles.get('problem_symptom');
      return (problemSymptoms && problemSymptoms.length > 0) || false;
    },
  },
  {
    id: 'our_solution',
    slot: 'section_2',
    purpose: 'What the service actually does.',
    titleTemplates: [
      'How We Handle {{PRIMARY_SERVICE}}',
      'Our Approach to {{PRIMARY_SERVICE}} in {{CITY}}',
    ],
    minWords: 220,
    maxWords: 320,
    requiredKeywordRoles: ['primary_service'],
    recommendedKeywordRoles: ['benefit_outcome', 'topical_entity', 'city'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    internalLinkTargets: ['contact', 'service_hub'],
  },
  {
    id: 'process_section',
    slot: 'section_3',
    purpose: 'Step-by-step process explanation.',
    titleTemplates: [
      'Our {{PRIMARY_SERVICE}} Process',
      'What to Expect When You Call',
    ],
    minWords: 180,
    maxWords: 260,
    requiredKeywordRoles: ['primary_service'],
    recommendedKeywordRoles: ['modifier_urgency'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    internalLinkTargets: ['contact'],
  },
  {
    id: 'benefits_section',
    slot: 'section_4',
    purpose: 'Why choose us for this service.',
    titleTemplates: [
      'Why Choose {{BRAND_NAME}} for {{PRIMARY_SERVICE}}',
      'What Makes Our {{PRIMARY_SERVICE}} Different',
    ],
    minWords: 180,
    maxWords: 260,
    requiredKeywordRoles: ['brand_name'],
    recommendedKeywordRoles: ['primary_service', 'city', 'benefit_outcome'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    internalLinkTargets: ['about', 'reviews_page', 'contact'],
  },
  {
    id: 'local_context',
    slot: 'section_5',
    purpose: 'Local conditions and context.',
    titleTemplates: [
      '{{PRIMARY_SERVICE}} in {{CITY}}',
      'Local {{CITY}} Conditions We See Every Day',
    ],
    minWords: 180,
    maxWords: 260,
    requiredKeywordRoles: ['city'],
    recommendedKeywordRoles: ['primary_service', 'neighborhood'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    internalLinkTargets: ['city_pages'],
  },
  {
    id: 'service_area_for_service',
    slot: 'section_6',
    purpose: 'Service area coverage for this specific service.',
    titleTemplates: [
      'Where We Offer {{PRIMARY_SERVICE}}',
    ],
    minWords: 120,
    maxWords: 200,
    requiredKeywordRoles: ['primary_service', 'city'],
    recommendedKeywordRoles: ['neighborhood'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    internalLinkTargets: ['service_area_hub', 'city_pages'],
  },
  {
    id: 'service_faq',
    slot: 'section_7',
    purpose: 'Service-specific FAQs.',
    titleTemplates: [
      '{{PRIMARY_SERVICE}} FAQ',
    ],
    minWords: 280,
    maxWords: 400,
    requiredKeywordRoles: ['primary_service'],
    recommendedKeywordRoles: ['problem_symptom', 'benefit_outcome'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    schemaHints: ['FAQPage'],
    internalLinkTargets: ['faq_page', 'contact'],
  },
  {
    id: 'service_cta',
    slot: 'cta_bottom',
    purpose: 'Final call to action.',
    titleTemplates: [
      'Get {{PRIMARY_SERVICE}} in {{CITY}} Today',
    ],
    minWords: 80,
    maxWords: 140,
    requiredKeywordRoles: ['primary_service_city'],
    recommendedKeywordRoles: [],
    optionalKeywordRoles: [],
    keywordRules: { requiredEach: 1, recommendedMaxEach: 0, optionalMaxEach: 0 },
    internalLinkTargets: ['contact'],
  },
];

// CITY PAGE SECTIONS
const cityPageSections: SectionBlueprint[] = [
  {
    id: 'hero_city',
    slot: 'hero',
    purpose: 'Introduce services in the city.',
    titleTemplates: [
      '{{SERVICE_CATEGORY}} in {{CITY}}',
      'Your Local {{SERVICE_CATEGORY}} in {{CITY}}',
    ],
    minWords: 220,
    maxWords: 320,
    requiredKeywordRoles: ['service_category', 'city', 'primary_service_city'],
    recommendedKeywordRoles: [],
    optionalKeywordRoles: [],
    keywordRules: standardRules,
    internalLinkTargets: ['service_hub', 'primary_service_pages'],
  },
  {
    id: 'how_we_help_city',
    slot: 'section_1',
    purpose: 'Narrative about how you serve that city.',
    titleTemplates: [
      'How We Serve {{CITY}}',
    ],
    minWords: 200,
    maxWords: 300,
    requiredKeywordRoles: ['city'],
    recommendedKeywordRoles: ['primary_service', 'benefit_outcome'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    internalLinkTargets: ['primary_service_pages'],
  },
  {
    id: 'featured_services_city',
    slot: 'section_2',
    purpose: 'Popular services in this city.',
    titleTemplates: [
      'Popular Services in {{CITY}}',
    ],
    minWords: 220,
    maxWords: 340,
    requiredKeywordRoles: ['service_category', 'city'],
    recommendedKeywordRoles: ['primary_service'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    internalLinkTargets: ['primary_service_pages', 'secondary_service_pages'],
  },
  {
    id: 'neighborhoods_zip_list',
    slot: 'section_3',
    purpose: 'List neighborhoods/ZIPs served.',
    titleTemplates: [
      'Neighborhoods We Serve in {{CITY}}',
    ],
    minWords: 180,
    maxWords: 260,
    requiredKeywordRoles: ['city'],
    recommendedKeywordRoles: ['neighborhood'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    internalLinkTargets: ['city_pages', 'service_area_hub'],
  },
  {
    id: 'local_projects_social_proof',
    slot: 'section_4',
    purpose: 'Local work and testimonials.',
    titleTemplates: [
      'Local Work in {{CITY}}',
      'Recent Projects Around {{CITY}}',
    ],
    minWords: 220,
    maxWords: 340,
    requiredKeywordRoles: ['city'],
    recommendedKeywordRoles: ['primary_service', 'benefit_outcome', 'neighborhood'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    internalLinkTargets: ['reviews_page', 'gallery_page'],
  },
  {
    id: 'city_specific_faq',
    slot: 'section_5',
    purpose: 'City-specific FAQs.',
    titleTemplates: [
      '{{CITY}} {{SERVICE_CATEGORY}} FAQ',
    ],
    minWords: 260,
    maxWords: 380,
    requiredKeywordRoles: ['city', 'service_category'],
    recommendedKeywordRoles: ['problem_symptom'],
    optionalKeywordRoles: [],
    keywordRules: lightRules,
    schemaHints: ['FAQPage'],
    internalLinkTargets: ['primary_service_pages', 'faq_page', 'contact'],
  },
  {
    id: 'city_cta',
    slot: 'cta_bottom',
    purpose: 'Final CTA.',
    titleTemplates: [
      'Need {{SERVICE_CATEGORY}} in {{CITY}}?',
    ],
    minWords: 80,
    maxWords: 140,
    requiredKeywordRoles: ['primary_service_city'],
    recommendedKeywordRoles: [],
    optionalKeywordRoles: [],
    keywordRules: { requiredEach: 1, recommendedMaxEach: 0, optionalMaxEach: 0 },
    internalLinkTargets: ['contact'],
  },
];

// HOME PAGE BLUEPRINT
const homeBlueprint: PageBlueprint = {
  pageType: 'home',
  variants: [
    {
      variantId: 'problem_solution_proof',
      description: 'Problem → Solution → Proof',
      targetWordCount: { min: 2000, max: 2600 },
      pageKeywordTargets: {
        primary_service_city: { min: 6, max: 10 },
        primary_service: { min: 10, max: 18 },
        city: { min: 15, max: 25 },
        service_category: { min: 8, max: 14 },
      },
      sectionOrder: [
        'hero_intro',
        'quick_benefits',
        'core_services_overview',
        'why_choose_us',
        'how_it_works',
        'service_areas_summary',
        'homepage_faq',
        'final_cta',
      ],
    },
    {
      variantId: 'benefits_trust_services',
      description: 'Benefits/Trust → Services',
      targetWordCount: { min: 2000, max: 2600 },
      pageKeywordTargets: {
        primary_service_city: { min: 6, max: 10 },
        primary_service: { min: 10, max: 18 },
        city: { min: 15, max: 25 },
        service_category: { min: 8, max: 14 },
      },
      sectionOrder: [
        'hero_intro',
        'quick_benefits',
        'why_choose_us',
        'core_services_overview',
        'service_areas_summary',
        'homepage_faq',
        'how_it_works',
        'final_cta',
      ],
    },
    {
      variantId: 'process_local_services',
      description: 'Process/Local → Services',
      targetWordCount: { min: 2000, max: 2600 },
      pageKeywordTargets: {
        primary_service_city: { min: 6, max: 10 },
        primary_service: { min: 10, max: 18 },
        city: { min: 15, max: 25 },
        service_category: { min: 8, max: 14 },
      },
      sectionOrder: [
        'hero_intro',
        'how_it_works',
        'core_services_overview',
        'service_areas_summary',
        'why_choose_us',
        'homepage_faq',
        'quick_benefits',
        'final_cta',
      ],
    },
  ],
  sections: homeSections,
};

// PRIMARY SERVICE PAGE BLUEPRINT
const primaryServiceBlueprint: PageBlueprint = {
  pageType: 'primary_service',
  variants: [
    {
      variantId: 'problem_first',
      description: 'Problem-first',
      targetWordCount: { min: 1500, max: 2000 },
      pageKeywordTargets: {
        primary_service_city: { min: 5, max: 8 },
        primary_service: { min: 8, max: 15 },
        city: { min: 10, max: 18 },
        service_category: { min: 4, max: 8 },
      },
      sectionOrder: [
        'hero_service',
        'problems_section',
        'our_solution',
        'process_section',
        'benefits_section',
        'local_context',
        'service_area_for_service',
        'service_faq',
        'service_cta',
      ],
    },
    {
      variantId: 'process_first',
      description: 'Process-first',
      targetWordCount: { min: 1500, max: 2000 },
      pageKeywordTargets: {
        primary_service_city: { min: 5, max: 8 },
        primary_service: { min: 8, max: 15 },
        city: { min: 10, max: 18 },
        service_category: { min: 4, max: 8 },
      },
      sectionOrder: [
        'hero_service',
        'process_section',
        'our_solution',
        'benefits_section',
        'problems_section',
        'local_context',
        'service_area_for_service',
        'service_faq',
        'service_cta',
      ],
    },
    {
      variantId: 'benefits_first',
      description: 'Benefits-first / proof',
      targetWordCount: { min: 1500, max: 2000 },
      pageKeywordTargets: {
        primary_service_city: { min: 5, max: 8 },
        primary_service: { min: 8, max: 15 },
        city: { min: 10, max: 18 },
        service_category: { min: 4, max: 8 },
      },
      sectionOrder: [
        'hero_service',
        'benefits_section',
        'our_solution',
        'problems_section',
        'local_context',
        'service_area_for_service',
        'service_faq',
        'process_section',
        'service_cta',
      ],
    },
  ],
  sections: primaryServiceSections,
};

// CITY PAGE BLUEPRINT
const cityPageBlueprint: PageBlueprint = {
  pageType: 'city_page',
  variants: [
    {
      variantId: 'services_first',
      description: 'Services-first',
      targetWordCount: { min: 1500, max: 2000 },
      pageKeywordTargets: {
        primary_service_city: { min: 5, max: 8 },
        service_category: { min: 8, max: 14 },
        city: { min: 15, max: 25 },
      },
      sectionOrder: [
        'hero_city',
        'featured_services_city',
        'how_we_help_city',
        'neighborhoods_zip_list',
        'local_projects_social_proof',
        'city_specific_faq',
        'city_cta',
      ],
    },
    {
      variantId: 'neighborhood_first',
      description: 'Neighborhood-first',
      targetWordCount: { min: 1500, max: 2000 },
      pageKeywordTargets: {
        primary_service_city: { min: 5, max: 8 },
        service_category: { min: 8, max: 14 },
        city: { min: 15, max: 25 },
      },
      sectionOrder: [
        'hero_city',
        'neighborhoods_zip_list',
        'how_we_help_city',
        'featured_services_city',
        'local_projects_social_proof',
        'city_specific_faq',
        'city_cta',
      ],
    },
    {
      variantId: 'proof_first',
      description: 'Proof-first',
      targetWordCount: { min: 1500, max: 2000 },
      pageKeywordTargets: {
        primary_service_city: { min: 5, max: 8 },
        service_category: { min: 8, max: 14 },
        city: { min: 15, max: 25 },
      },
      sectionOrder: [
        'hero_city',
        'local_projects_social_proof',
        'how_we_help_city',
        'featured_services_city',
        'neighborhoods_zip_list',
        'city_specific_faq',
        'city_cta',
      ],
    },
  ],
  sections: cityPageSections,
};

// Export HVAC blueprints
export const hvacBlueprints: { [pageType: string]: PageBlueprint } = {
  home: homeBlueprint,
  primary_service: primaryServiceBlueprint,
  city_page: cityPageBlueprint,
  // TODO: Add other page types (service_hub, secondary_service, emergency_service, etc.)
};

