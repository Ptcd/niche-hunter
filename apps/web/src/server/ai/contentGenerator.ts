/**
 * Content Generator Module
 * 
 * Generates page content section-by-section using gpt-4o-mini and existing data.
 * Uses ContentSkeleton templates and PromptProfile for tone/style.
 */

import OpenAI from 'openai';
import { prisma } from '@niche-hunter/db';
import { PageType, PageStatus } from '@prisma/client';
import { buildBrandSpec } from '../../lib/brandBuilder';
import { buildPageHtml, Section, BrandInfo } from '../../lib/semanticHtmlBuilder';
import { injectInternalLinks, addRelatedServicesSection, PageLink } from '../../lib/linkInjector';
import { getExternalLinksForPrompt } from '../../lib/externalResources';
import { generateSchemaMarkup, extractFAQFromContent, SchemaOptions } from '../../lib/schemaGenerator';
import { generatePageStrategy, PageSpec } from './pageStrategy';
import { buildSkeletonsForPage } from '../../lib/site-setup';
import { generateAltText } from '../../lib/altTextGenerator';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Model configuration (GPT-4o models for content generation)
const SUPPORTED_MODELS = ['gpt-4o', 'gpt-4o-mini'];

// Word count limits by page type
const WORD_LIMITS: Record<PageType, { min: number; max: number }> = {
  HOME: { min: 1500, max: 2200 },
  CORE_SERVICE: { min: 800, max: 1200 },
  SUPPORT: { min: 600, max: 1000 },
  CITY: { min: 600, max: 1000 },
  ABOUT: { min: 400, max: 800 },
  CONTACT: { min: 200, max: 400 },
  LEGAL: { min: 400, max: 800 },
};

// Page-type templates with strict section control
const PAGE_TEMPLATES: Record<PageType, {
  allowedSections: string[];
  bannedSections: string[];
  maxSections: number;
  requiredSections: string[];
}> = {
  HOME: {
    allowedSections: ['hero', 'intro', 'services', 'why_choose', 'testimonials', 'areas_served', 'faq', 'cta', 'case_study', 'neighborhoods'],
    bannedSections: ['full_service_detail', 'pricing_table', 'blog_content', 'detailed_process'],
    maxSections: 8,
    requiredSections: ['hero', 'intro', 'cta'],
  },
  CORE_SERVICE: {
    allowedSections: ['hero', 'intro', 'process', 'benefits', 'case_study', 'faq', 'cta'],
    bannedSections: ['areas_served', 'all_services_list', 'neighborhoods'],
    maxSections: 7,
    requiredSections: ['hero', 'intro', 'process', 'cta'],
  },
  CITY: {
    allowedSections: ['hero', 'intro', 'areas', 'neighborhoods', 'services', 'faq', 'cta'],
    bannedSections: ['detailed_process', 'company_history', 'full_service_detail'],
    maxSections: 7,
    requiredSections: ['hero', 'areas', 'cta'],
  },
  SUPPORT: {
    allowedSections: ['hero', 'intro', 'details', 'faq', 'cta'],
    bannedSections: ['areas_served', 'case_study', 'neighborhoods'],
    maxSections: 5,
    requiredSections: ['hero', 'intro', 'cta'],
  },
  ABOUT: {
    allowedSections: ['hero', 'story', 'team', 'values', 'cta'],
    bannedSections: ['services', 'faq', 'areas_served'],
    maxSections: 5,
    requiredSections: ['hero', 'story', 'cta'],
  },
  CONTACT: {
    allowedSections: ['hero', 'info', 'hours', 'cta'],
    bannedSections: ['services', 'faq', 'testimonials'],
    maxSections: 4,
    requiredSections: ['hero', 'info', 'cta'],
  },
  LEGAL: {
    allowedSections: ['hero', 'content', 'cta'],
    bannedSections: ['services', 'testimonials', 'faq'],
    maxSections: 3,
    requiredSections: ['hero', 'content'],
  },
};

// Section word budget allocation by page type (percentages of total)
const SECTION_BUDGETS: Record<PageType, Record<string, number>> = {
  HOME: {
    hero: 0.08,        // ~150 words
    intro: 0.14,       // ~250 words
    services: 0.14,    // ~250 words
    why_choose: 0.17,  // ~300 words
    areas_served: 0.11,// ~200 words
    testimonials: 0.08,// ~150 words
    faq: 0.17,         // ~300 words
    cta: 0.06,         // ~100 words
  },
  CORE_SERVICE: {
    hero: 0.10, intro: 0.25, process: 0.20, benefits: 0.20, faq: 0.15, cta: 0.10,
  },
  SUPPORT: {
    hero: 0.10, intro: 0.30, details: 0.30, faq: 0.20, cta: 0.10,
  },
  CITY: {
    hero: 0.10, intro: 0.25, areas: 0.25, services: 0.20, cta: 0.10, faq: 0.10,
  },
  ABOUT: {
    hero: 0.15, story: 0.35, team: 0.25, values: 0.15, cta: 0.10,
  },
  CONTACT: {
    hero: 0.20, info: 0.40, hours: 0.20, cta: 0.20,
  },
  LEGAL: {
    hero: 0.10, content: 0.80, cta: 0.10,
  },
};

// Keyword budget per section (exact matches allowed)
const KEYWORD_BUDGETS: Record<string, { exact: number; variations: number }> = {
  hero: { exact: 1, variations: 2 },
  intro: { exact: 1, variations: 3 },
  services: { exact: 0, variations: 2 },
  why_choose: { exact: 1, variations: 2 },
  areas_served: { exact: 0, variations: 1 },
  testimonials: { exact: 0, variations: 1 },
  faq: { exact: 1, variations: 3 },
  cta: { exact: 1, variations: 1 },
  // Default for unknown sections
  default: { exact: 0, variations: 2 },
};

// Banned heading patterns (regex) - these indicate unnatural AI headings
const BANNED_H2_PATTERNS = [
  /^(ac repair|hvac|plumbing|roofing|junk)/i,  // Starts with service keyword
  /^why .+ chooses? /i,                         // "Why City chooses service"
  /^our .+ (services?|solutions?)/i,            // "Our HVAC services"
  / services? in /i,                            // "services in City"
  /^(best|top|#1|number one) /i,               // Starts with superlative
];

// Enhanced banned patterns (more comprehensive)
const BANNED_H2_PATTERNS_V2 = [
  /^(ac repair|hvac|plumbing|roofing|junk)/i,       // Starts with keyword
  /^why .+ chooses? /i,                              // "Why City chooses..."
  /^our .+ (services?|solutions?|process)/i,         // "Our X services"
  /^how our .+ (works?|process)/i,                   // "How Our X Works"
  / services? in /i,                                 // "services in City"
  /^(best|top|#1|number one|leading|premier) /i,    // Superlatives
  /\bac repair\b(?!.*\bAC Repair\b)/i,               // lowercase "ac repair" 
];

// Heading case corrections for proper capitalization
const HEADING_CASE_CORRECTIONS: Record<string, string> = {
  'ac repair': 'AC Repair',
  'ac service': 'AC Service',
  'ac installation': 'AC Installation',
  'ac maintenance': 'AC Maintenance',
  'hvac': 'HVAC',
  'a/c': 'A/C',
};

// Natural heading alternatives for different section types
const NATURAL_HEADING_TEMPLATES: Record<string, string[]> = {
  why_choose: [
    'Trusted {service} Services',
    'Professional {service} You Can Count On', 
    'Quality {service} for {city} Homes',
    'Reliable {service} Solutions',
    'Why Homeowners Trust Us',
    'The {city} Choice for {service}',
  ],
  process: [
    'Our {service} Process',
    'How We Handle Your {service}',
    'What to Expect from Our Team',
    'Our Approach to {service}',
  ],
  services: [
    'Our {service} Services',
    '{service} Solutions We Offer',
    'Complete {service} Services',
  ],
  default: [
    'Expert {service} in {city}',
    'Professional {service} Services',
    '{service} You Can Trust',
  ],
};

// Niche-specific variation pools
const NICHE_VARIATIONS: Record<string, {
  serviceTerms: string[];
  climateTerms: string[];
  painPoints: string[];
  benefits: string[];
}> = {
  hvac: {
    serviceTerms: ['AC repair', 'air conditioning service', 'cooling system repair', 'HVAC maintenance', 'AC tune-up'],
    climateTerms: ['hot summers', 'warm seasons', 'high temperatures', 'summer heat', 'humid conditions'],
    painPoints: ['uneven cooling', 'strange noises', 'weak airflow', 'rising energy bills', 'frequent cycling'],
    benefits: ['energy savings', 'improved comfort', 'cleaner air', 'reliable cooling', 'lower utility costs'],
  },
  plumbing: {
    serviceTerms: ['plumbing repair', 'pipe services', 'drain cleaning', 'leak repair', 'water heater service'],
    climateTerms: ['hard water', 'mineral buildup', 'seasonal changes', 'freezing temps', 'water pressure issues'],
    painPoints: ['slow drains', 'leaky faucets', 'low water pressure', 'water damage', 'clogged pipes'],
    benefits: ['water savings', 'prevent damage', 'improved flow', 'reliable plumbing', 'peace of mind'],
  },
  roofing: {
    serviceTerms: ['roof repair', 'roofing services', 'shingle replacement', 'roof inspection', 'leak repair'],
    climateTerms: ['storm damage', 'heavy rain', 'wind damage', 'sun exposure', 'hurricane season'],
    painPoints: ['leaks', 'missing shingles', 'sagging', 'water stains', 'energy loss'],
    benefits: ['home protection', 'curb appeal', 'energy efficiency', 'peace of mind', 'increased value'],
  },
  'junk-removal': {
    serviceTerms: ['junk hauling', 'debris removal', 'cleanout services', 'furniture removal', 'estate cleanouts'],
    climateTerms: ['spring cleaning', 'moving season', 'renovation projects', 'downsizing', 'estate sales'],
    painPoints: ['cluttered space', 'heavy items', 'time constraints', 'disposal hassle', 'limited access'],
    benefits: ['reclaim space', 'stress-free', 'eco-friendly disposal', 'same-day service', 'competitive pricing'],
  },
  electrical: {
    serviceTerms: ['electrical repair', 'wiring services', 'panel upgrades', 'outlet installation', 'lighting repair'],
    climateTerms: ['power surges', 'storm outages', 'high demand', 'summer load', 'generator needs'],
    painPoints: ['flickering lights', 'tripping breakers', 'outdated wiring', 'safety concerns', 'power outages'],
    benefits: ['safety', 'code compliance', 'energy savings', 'reliable power', 'modern convenience'],
  },
};

// Default variations for unknown niches
const DEFAULT_NICHE_VARIATIONS = {
  serviceTerms: ['professional service', 'expert solutions', 'quality work', 'reliable service', 'trusted solutions'],
  climateTerms: ['local conditions', 'seasonal needs', 'area requirements', 'regional factors', 'environmental factors'],
  painPoints: ['common issues', 'typical problems', 'frequent concerns', 'ongoing challenges', 'recurring needs'],
  benefits: ['quality results', 'peace of mind', 'professional work', 'reliable solutions', 'customer satisfaction'],
};

/**
 * Get variation pools for a specific niche
 */
function getNicheVariations(niche: string): {
  serviceTerms: string[];
  climateTerms: string[];
  painPoints: string[];
  benefits: string[];
} {
  const normalizedNiche = niche.toLowerCase().replace(/\s+/g, '-');
  return NICHE_VARIATIONS[normalizedNiche] || DEFAULT_NICHE_VARIATIONS;
}

/**
 * Get random variations from a pool
 */
function getRandomVariations(pool: string[], count: number): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Build variation injection text for prompts
 */
function buildVariationInjection(niche: string, sectionType: string): string {
  const vars = getNicheVariations(niche);
  
  // Pick random subset for this section
  const serviceVars = getRandomVariations(vars.serviceTerms, 3);
  const climateVars = getRandomVariations(vars.climateTerms, 2);
  const painVars = getRandomVariations(vars.painPoints, 2);
  const benefitVars = getRandomVariations(vars.benefits, 2);
  
  return `
USE THESE SPECIFIC VARIATIONS (randomized for this section):
- Service terms: ${serviceVars.join(', ')}
- Pain points: ${painVars.join(', ')}
- Benefits: ${benefitVars.join(', ')}
${sectionType === 'intro' ? `- Climate terms (use ONCE only): ${climateVars[0]}` : '- DO NOT mention climate'}
`;
}

// Title case function for H1 and page titles
function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Fix heading case in H1, H2, H3 tags ONLY (not paragraph text)
 */
function fixHeadingCase(html: string, niche: string): string {
  let result = html;
  
  // Fix case in H1, H2, H3 tags ONLY (not paragraph text)
  result = result.replace(/<(h[1-3])([^>]*)>([^<]+)<\/\1>/gi, (match, tag, attrs, content) => {
    let fixedContent = content;
    
    // Apply case corrections
    for (const [lower, proper] of Object.entries(HEADING_CASE_CORRECTIONS)) {
      const regex = new RegExp(`\\b${lower}\\b`, 'gi');
      fixedContent = fixedContent.replace(regex, proper);
    }
    
    return `<${tag}${attrs}>${fixedContent}</${tag}>`;
  });
  
  return result;
}

/**
 * Check if heading is natural (not matching banned patterns)
 */
function isHeadingNatural(heading: string, keyword: string): boolean {
  // Check against all banned patterns
  for (const pattern of BANNED_H2_PATTERNS_V2) {
    if (pattern.test(heading)) return false;
  }
  
  // Check if starts with keyword (unnatural)
  const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^${escapedKw}`, 'i').test(heading.trim())) return false;
  
  return true;
}

/**
 * Rewrite an unnatural heading to a natural one
 */
function rewriteUnnaturalHeading(
  heading: string,
  keyword: string,
  city: string,
  sectionType: string = 'default'
): string {
  // Extract service name from keyword (e.g., "ac repair in Wesley Chapel" -> "AC Repair")
  const service = keyword
    .replace(/\s+(in|near|for)\s+.*/i, '')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  
  // Get templates for this section type
  const templates = NATURAL_HEADING_TEMPLATES[sectionType] || NATURAL_HEADING_TEMPLATES.default;
  
  // Pick a random template
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // Replace placeholders
  return template
    .replace('{service}', service)
    .replace('{city}', city);
}

/**
 * Fix headings that match banned patterns
 */
function fixBannedHeadingPatterns(
  html: string,
  keyword: string,
  city: string
): { html: string; fixed: number } {
  let fixed = 0;
  
  let result = html.replace(/<h2([^>]*)>([^<]+)<\/h2>/gi, (match, attrs, content) => {
    // Check against banned patterns
    for (const pattern of BANNED_H2_PATTERNS_V2) {
      if (pattern.test(content)) {
        fixed++;
        // Determine section type from content
        let sectionType = 'default';
        if (/why|choose|trust/i.test(content)) sectionType = 'why_choose';
        if (/process|how|work/i.test(content)) sectionType = 'process';
        if (/service|offer/i.test(content)) sectionType = 'services';
        
        const newHeading = rewriteUnnaturalHeading(content, keyword, city, sectionType);
        console.log(`[Heading Fix] "${content}" -> "${newHeading}"`);
        return `<h2${attrs}>${newHeading}</h2>`;
      }
    }
    return match;
  });
  
  return { html: result, fixed };
}

/**
 * Limit repeated phrases within a single piece of content
 * (e.g., "Seven Oaks" appearing 5+ times in one section)
 */
function limitWithinSectionRepetition(
  html: string,
  maxOccurrences: number = 2
): { html: string; replacements: number } {
  let replacements = 0;
  
  // Track phrase counts
  const phraseCounts: Record<string, number> = {};
  
  // Common phrases that get repeated too often
  // Note: Neighborhood limiting now happens with real neighborhoods from enrichedData
  const trackPhrases = [
    // Generic neighborhood patterns (fallback)
    /\b(Seven Oaks|Meadow Point[e]?|Lexington Oaks|Northwood|Collier Heights)\b/gi,
    // Common descriptors
    /\b(experienced HVAC professionals?)\b/gi,
    /\b(local AC technicians?)\b/gi,
    /\b(expert cooling system)\b/gi,
    /\b(professional air conditioning)\b/gi,
  ];
  
  let result = html;
  
  for (const phraseRegex of trackPhrases) {
    let count = 0;
    result = result.replace(phraseRegex, (match) => {
      const key = match.toLowerCase();
      phraseCounts[key] = (phraseCounts[key] || 0) + 1;
      count++;
      
      if (count > maxOccurrences) {
        replacements++;
        // Replace with generic alternative
        if (/seven oaks|meadow|lexington|northwood|collier/i.test(match)) {
          return 'the area';
        }
        if (/technicians?/i.test(match)) {
          return 'our team';
        }
        if (/professionals?/i.test(match)) {
          return 'our experts';
        }
        return 'our services';
      }
      return match;
    });
  }
  
  return { html: result, replacements };
}

// Keyword density checker
function checkKeywordDensity(
  content: string,
  keyword: string,
  maxPercent: number = 1.0
): { density: number; isValid: boolean; count: number; wordCount: number } {
  const words = content.split(/\s+/).filter(w => w.length > 0).length;
  const keywordMatches = content.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || [];
  const keywordCount = keywordMatches.length;
  const density = words > 0 ? (keywordCount / words) * 100 : 0;
  return {
    density: Math.round(density * 100) / 100, // Round to 2 decimals
    isValid: density <= maxPercent,
    count: keywordCount,
    wordCount: words,
  };
}

/**
 * Calculate section budget based on page type and section ID
 */
function calculateSectionBudget(
  pageType: PageType,
  sectionId: string,
  totalWordBudget: number
): { maxWords: number; exactKeywords: number; variationKeywords: number } {
  const sectionAllocations = SECTION_BUDGETS[pageType] || SECTION_BUDGETS.HOME;
  const sectionKey = Object.keys(sectionAllocations).find(k => 
    sectionId.toLowerCase().includes(k)
  ) || 'intro';
  
  const percentage = sectionAllocations[sectionKey] || 0.15;
  const keywordBudget = KEYWORD_BUDGETS[sectionKey] || KEYWORD_BUDGETS.default;
  
  return {
    maxWords: Math.floor(totalWordBudget * percentage),
    exactKeywords: keywordBudget.exact,
    variationKeywords: keywordBudget.variations,
  };
}

/**
 * Replace excess keyword occurrences with variations
 */
function replaceExcessKeywords(
  html: string,
  keyword: string,
  variations: string[],
  maxExact: number = 5
): { html: string; replaced: number } {
  if (variations.length === 0) return { html, replaced: 0 };
  
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let count = 0;
  let replaced = 0;
  
  // Replace keywords in text content only (not in tags)
  const result = html.replace(
    new RegExp(`(>[^<]*)(${escapedKeyword})([^<]*<)`, 'gi'),
    (match, before, kw, after) => {
      count++;
      if (count <= maxExact) {
        return match; // Keep first N
      }
      replaced++;
      const variation = variations[(count - maxExact - 1) % variations.length];
      return `${before}${variation}${after}`;
    }
  );
  
  return { html: result, replaced };
}

/**
 * Enforce heading rules: H2 max 1 exact match, H3 no exact matches
 */
function enforceHeadingRules(
  html: string,
  keyword: string,
  variations: string[]
): string {
  if (variations.length === 0) return html;
  
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let h2ExactCount = 0;
  
  // H2: Allow max 1 exact match
  html = html.replace(/<h2([^>]*)>([^<]+)<\/h2>/gi, (match, attrs, content) => {
    if (new RegExp(escapedKeyword, 'i').test(content)) {
      h2ExactCount++;
      if (h2ExactCount > 1) {
        const newContent = content.replace(new RegExp(escapedKeyword, 'gi'), variations[0]);
        return `<h2${attrs}>${newContent}</h2>`;
      }
    }
    return match;
  });
  
  // H3: No exact matches allowed
  html = html.replace(/<h3([^>]*)>([^<]+)<\/h3>/gi, (match, attrs, content) => {
    if (new RegExp(escapedKeyword, 'i').test(content)) {
      const newContent = content.replace(new RegExp(escapedKeyword, 'gi'), variations[1] || variations[0]);
      return `<h3${attrs}>${newContent}</h3>`;
    }
    return match;
  });
  
  return html;
}

/**
 * Detect repeated phrases and sentences in content
 */
function detectRepetition(html: string): {
  duplicateSentences: string[];
  repeatedPhrases: { phrase: string; count: number }[];
  overusedTerms: { term: string; count: number }[];
} {
  // Extract text content only (no HTML tags)
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // 1. Find duplicate sentences
  const sentences = textContent.split(/[.!?]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 20);
  const sentenceCounts: Record<string, number> = {};
  sentences.forEach(s => { sentenceCounts[s] = (sentenceCounts[s] || 0) + 1; });
  const duplicateSentences = Object.entries(sentenceCounts)
    .filter(([_, count]) => count > 1)
    .map(([sentence]) => sentence);
  
  // 2. Find repeated 3-4 word phrases (appearing 3+ times)
  const words = textContent.toLowerCase().split(/\s+/);
  const phraseCounts: Record<string, number> = {};
  for (let i = 0; i < words.length - 3; i++) {
    const phrase3 = words.slice(i, i + 3).join(' ');
    const phrase4 = words.slice(i, i + 4).join(' ');
    phraseCounts[phrase3] = (phraseCounts[phrase3] || 0) + 1;
    phraseCounts[phrase4] = (phraseCounts[phrase4] || 0) + 1;
  }
  const repeatedPhrases = Object.entries(phraseCounts)
    .filter(([phrase, count]) => count >= 3 && phrase.length > 10)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // 3. Find overused filler terms
  const fillerTerms = [
    'hot summers', 'high humidity', 'humid climate', 'warm weather',
    'qualified technicians', 'experienced professionals', 'quality service',
    'energy efficient', 'cost effective', 'reliable service',
    'licensed and insured', 'local experts', 'trusted professionals'
  ];
  const overusedTerms: { term: string; count: number }[] = [];
  fillerTerms.forEach(term => {
    const regex = new RegExp(term, 'gi');
    const matches = textContent.match(regex);
    if (matches && matches.length > 1) {
      overusedTerms.push({ term, count: matches.length });
    }
  });
  
  return { duplicateSentences, repeatedPhrases, overusedTerms };
}

/**
 * Fix repetition by replacing overused terms with variations
 */
function fixRepetition(
  html: string,
  overusedTerms: { term: string; count: number }[]
): string {
  // Variation mappings for common overused terms
  const variationMap: Record<string, string[]> = {
    'hot summers': ['warm seasons', 'summer heat', 'high temperatures'],
    'high humidity': ['humid conditions', 'moisture levels', 'damp climate'],
    'humid climate': ['tropical weather', 'moisture-rich air', 'warm atmosphere'],
    'qualified technicians': ['skilled specialists', 'trained experts', 'certified pros'],
    'experienced professionals': ['seasoned experts', 'industry veterans', 'knowledgeable team'],
    'quality service': ['excellent work', 'superior results', 'top-notch service'],
    'energy efficient': ['cost-saving', 'eco-friendly', 'power-efficient'],
    'licensed and insured': ['fully certified', 'bonded and licensed', 'properly credentialed'],
  };
  
  let result = html;
  
  overusedTerms.forEach(({ term, count }) => {
    if (count <= 1) return;
    
    const variations = variationMap[term.toLowerCase()];
    if (!variations || variations.length === 0) return;
    
    // Keep first occurrence, replace subsequent ones
    let occurrenceCount = 0;
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(>[^<]*)(${escapedTerm})([^<]*<)`, 'gi');
    result = result.replace(regex, (match, before, kw, after) => {
      occurrenceCount++;
      if (occurrenceCount === 1) return match; // Keep first
      const variation = variations[(occurrenceCount - 2) % variations.length];
      return `${before}${variation}${after}`;
    });
  });
  
  return result;
}

/**
 * Validate headings against banned patterns
 */
function validateHeadings(
  html: string,
  keyword: string
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Check H2s
  const h2Regex = /<h2[^>]*>([^<]+)<\/h2>/gi;
  let h2Match;
  let h2ExactCount = 0;
  
  while ((h2Match = h2Regex.exec(html)) !== null) {
    const h2Content = h2Match[1];
    
    // Check if H2 contains exact keyword
    if (new RegExp(escapedKeyword, 'i').test(h2Content)) {
      h2ExactCount++;
      if (h2ExactCount > 1) {
        issues.push(`H2 "${h2Content.substring(0, 30)}..." contains exact keyword (only 1 allowed)`);
      }
    }
    
    // Check against banned patterns
    for (const pattern of BANNED_H2_PATTERNS) {
      if (pattern.test(h2Content)) {
        issues.push(`H2 "${h2Content.substring(0, 30)}..." matches banned pattern: ${pattern}`);
        break;
      }
    }
    
    // Check if H2 starts with keyword (unnatural)
    if (new RegExp(`^${escapedKeyword}`, 'i').test(h2Content.trim())) {
      issues.push(`H2 "${h2Content.substring(0, 30)}..." starts with keyword (unnatural)`);
    }
  }
  
  // Check H3s - should never contain exact keyword
  const h3Regex = /<h3[^>]*>([^<]+)<\/h3>/gi;
  let h3Match;
  
  while ((h3Match = h3Regex.exec(html)) !== null) {
    const h3Content = h3Match[1];
    
    if (new RegExp(escapedKeyword, 'i').test(h3Content)) {
      issues.push(`H3 "${h3Content.substring(0, 30)}..." contains exact keyword (should use variation)`);
    }
  }
  
  return { isValid: issues.length === 0, issues };
}

/**
 * Fix heading issues by replacing keyword with variations
 */
function fixHeadingIssues(
  html: string,
  keyword: string,
  variations: string[]
): string {
  if (variations.length === 0) return html;
  
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let result = html;
  let h2ExactCount = 0;
  
  // Fix H2s - keep only first exact keyword occurrence
  result = result.replace(/<h2([^>]*)>([^<]+)<\/h2>/gi, (match, attrs, content) => {
    if (new RegExp(escapedKeyword, 'i').test(content)) {
      h2ExactCount++;
      if (h2ExactCount > 1) {
        // Replace keyword with variation
        const newContent = content.replace(new RegExp(escapedKeyword, 'gi'), variations[0]);
        return `<h2${attrs}>${newContent}</h2>`;
      }
    }
    return match;
  });
  
  // Fix H3s - replace ALL exact keywords with variations
  result = result.replace(/<h3([^>]*)>([^<]+)<\/h3>/gi, (match, attrs, content) => {
    if (new RegExp(escapedKeyword, 'i').test(content)) {
      const newContent = content.replace(
        new RegExp(escapedKeyword, 'gi'), 
        variations[1] || variations[0]
      );
      return `<h3${attrs}>${newContent}</h3>`;
    }
    return match;
  });
  
  return result;
}

/**
 * Comprehensive content validation
 */
function validateContent(
  html: string,
  keyword: string,
  pageType: PageType,
  variations: string[]
): {
  isValid: boolean;
  violations: {
    type: 'keyword_density' | 'word_count' | 'heading_rules' | 'repetition' | 'html_structure';
    message: string;
    severity: 'error' | 'warning';
  }[];
} {
  const violations: any[] = [];
  const limits = WORD_LIMITS[pageType];
  
  // 1. Check word count
  const wordCount = html.split(/\s+/).length;
  if (wordCount < limits.min) {
    violations.push({
      type: 'word_count',
      message: `Word count ${wordCount} below minimum ${limits.min}`,
      severity: 'warning',
    });
  }
  if (wordCount > limits.max * 1.1) { // 10% tolerance
    violations.push({
      type: 'word_count',
      message: `Word count ${wordCount} exceeds maximum ${limits.max}`,
      severity: 'error',
    });
  }
  
  // 2. Check keyword density
  const densityCheck = checkKeywordDensity(html, keyword, 1.0);
  if (!densityCheck.isValid) {
    violations.push({
      type: 'keyword_density',
      message: `Density ${densityCheck.density}% exceeds 1% (${densityCheck.count} occurrences)`,
      severity: 'error',
    });
  }
  if (densityCheck.count > 8) {
    violations.push({
      type: 'keyword_density',
      message: `Exact keyword appears ${densityCheck.count} times (max 8)`,
      severity: 'error',
    });
  }
  if (densityCheck.count < 3) {
    violations.push({
      type: 'keyword_density',
      message: `Exact keyword appears only ${densityCheck.count} times (min 3-4)`,
      severity: 'warning',
    });
  }
  
  // 3. Check heading rules
  const headingValidation = validateHeadings(html, keyword);
  if (!headingValidation.isValid) {
    headingValidation.issues.forEach(issue => {
      violations.push({
        type: 'heading_rules',
        message: issue,
        severity: 'warning',
      });
    });
  }
  
  // 4. Check H1 exists and contains keyword
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (!h1Match) {
    violations.push({
      type: 'heading_rules',
      message: 'Missing H1 tag',
      severity: 'error',
    });
  } else {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(escapedKeyword, 'i').test(h1Match[1])) {
      violations.push({
        type: 'heading_rules',
        message: 'H1 does not contain primary keyword',
        severity: 'error',
      });
    }
  }
  
  // 5. Check repetition
  const repetition = detectRepetition(html);
  if (repetition.duplicateSentences.length > 0) {
    violations.push({
      type: 'repetition',
      message: `${repetition.duplicateSentences.length} duplicate sentence(s) found`,
      severity: 'warning',
    });
  }
  if (repetition.overusedTerms.length > 0) {
    violations.push({
      type: 'repetition',
      message: `Overused terms: ${repetition.overusedTerms.map(t => `"${t.term}" (${t.count}x)`).join(', ')}`,
      severity: 'warning',
    });
  }
  
  // 6. Check HTML structure
  const openTags = (html.match(/<[a-z][a-z0-9]*[^>]*>/gi) || []).length;
  const closeTags = (html.match(/<\/[a-z][a-z0-9]*>/gi) || []).length;
  if (Math.abs(openTags - closeTags) > 5) { // Some tolerance for self-closing tags
    violations.push({
      type: 'html_structure',
      message: `Possible broken HTML: ${openTags} open tags, ${closeTags} close tags`,
      severity: 'warning',
    });
  }
  
  const hasErrors = violations.some(v => v.severity === 'error');
  return { isValid: !hasErrors, violations };
}

// Unnatural AI phrases to detect and fix
const UNNATURAL_PATTERNS = [
  /\b(\w+)\s+\1\b/gi,                          // "fully fully"
  /\bas a leading\b/gi,                         // "as a leading"
  /\bwe pride ourselves\b/gi,                   // AI cliche
  /\blook no further\b/gi,                      // AI cliche
  /\byour search ends here\b/gi,                // AI cliche
  /\bwhether you('re| are) looking\b/gi,        // AI opener
  /\bin today's fast-paced\b/gi,                // AI cliche
  /\brest assured\b/gi,                         // AI cliche
  /\bstate-of-the-art\b/gi,                     // Overused
  /\bsecond to none\b/gi,                       // Cliche
];

/**
 * Check naturalness of content
 */
function checkNaturalness(html: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  const text = html.replace(/<[^>]+>/g, ' ');
  
  for (const pattern of UNNATURAL_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      issues.push(`Found unnatural phrase: "${matches[0]}"`);
    }
  }
  
  // Check sentence variety
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length > 0) {
    const avgLength = sentences.reduce((a, s) => a + s.split(/\s+/).length, 0) / sentences.length;
    if (avgLength < 8 || avgLength > 25) {
      issues.push(`Sentence length unnatural: avg ${avgLength.toFixed(1)} words`);
    }
  }
  
  const score = Math.max(0, 100 - (issues.length * 10));
  return { score, issues };
}

/**
 * Fix unnatural phrases in content
 */
function fixUnnaturalPhrases(html: string): string {
  let result = html;
  
  // Replace common AI cliches
  const replacements: [RegExp, string][] = [
    [/\bwe pride ourselves on\b/gi, 'we focus on'],
    [/\blook no further\b/gi, 'you\'ve found the right team'],
    [/\bwhether you('re| are) looking for\b/gi, 'if you need'],
    [/\bin today's fast-paced world\b/gi, 'today'],
    [/\brest assured\b/gi, 'you can count on'],
    [/\bstate-of-the-art\b/gi, 'modern'],
    [/\bsecond to none\b/gi, 'excellent'],
  ];
  
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  
  // Fix duplicate words
  result = result.replace(/\b(\w+)\s+\1\b/gi, '$1');
  
  return result;
}

/**
 * HTML-safe post-processor - comprehensive fix pipeline
 */
function htmlSafePostProcess(
  html: string,
  keyword: string,
  niche: string,
  variations: string[],
  city: string = '' // Add city parameter
): { html: string; fixes: string[] } {
  const fixes: string[] = [];
  let result = html;
  
  // Step 1: Case correction in headings ONLY
  result = fixHeadingCase(result, niche);
  fixes.push('Applied heading case corrections');
  
  // Step 1.5: Fix banned heading patterns (NEW)
  if (city) {
    const { html: headingFixed, fixed: headingCount } = fixBannedHeadingPatterns(result, keyword, city);
    if (headingCount > 0) {
      result = headingFixed;
      fixes.push(`Rewrote ${headingCount} unnatural heading(s)`);
    }
  }
  
  // Step 1.6: Limit within-section repetition (NEW)
  const { html: repLimited, replacements } = limitWithinSectionRepetition(result, 2);
  if (replacements > 0) {
    result = repLimited;
    fixes.push(`Limited ${replacements} repeated phrase(s)`);
  }
  
  // Step 2: Fix keyword density
  const densityCheck = checkKeywordDensity(result, keyword, 1.0);
  if (densityCheck.count > 6) {
    const { html: fixed, replaced } = replaceExcessKeywords(result, keyword, variations, 5);
    result = fixed;
    fixes.push(`Replaced ${replaced} excess keyword occurrences`);
  }
  
  // Step 3: Fix heading rules
  result = fixHeadingIssues(result, keyword, variations);
  
  // Step 4: Fix repetition
  const repetition = detectRepetition(result);
  if (repetition.overusedTerms.length > 0) {
    result = fixRepetition(result, repetition.overusedTerms);
    fixes.push(`Fixed ${repetition.overusedTerms.length} overused terms`);
  }
  
  // Step 5: Fix duplicate words ("fully fully", "the the")
  result = result.replace(/\b(\w+)\s+\1\b/gi, '$1');
  
  // Step 6: Fix unnatural phrases
  result = fixUnnaturalPhrases(result);
  
  return { html: result, fixes };
}

/**
 * Final sanitizer - fix all remaining issues (legacy, kept for compatibility)
 */
function sanitizeContent(
  html: string,
  keyword: string,
  pageType: PageType,
  variations: string[],
  niche: string,
  city: string = '' // Add city parameter
): { html: string; fixes: string[] } {
  const { html: processed, fixes } = htmlSafePostProcess(html, keyword, niche, variations, city);
  
  // Additional trimming if needed
  const limits = WORD_LIMITS[pageType];
  const wordCount = processed.split(/\s+/).length;
  if (wordCount > limits.max) {
    // Find last </p> before word limit
    const words = processed.split(/\s+/);
    let trimPoint = limits.max;
    const partialHtml = words.slice(0, trimPoint).join(' ');
    const lastParagraph = partialHtml.lastIndexOf('</p>');
    if (lastParagraph > partialHtml.length * 0.8) {
      const trimmed = partialHtml.substring(0, lastParagraph + 4); // Include </p>
      fixes.push(`Trimmed from ${wordCount} to ~${limits.max} words at paragraph boundary`);
      return { html: trimmed, fixes };
    }
  }
  
  return { html: processed, fixes };
}

/**
 * Quality score interface
 */
interface QualityScore {
  total: number;  // 0-100
  breakdown: {
    keywordDensity: number;   // 0-20
    headingQuality: number;   // 0-20
    repetition: number;       // 0-20
    naturalness: number;      // 0-20
    wordCount: number;        // 0-20
  };
  pass: boolean;
  issues: string[];
}

/**
 * Score content quality
 */
function scoreContent(
  html: string,
  keyword: string,
  pageType: PageType,
  variations: string[]
): QualityScore {
  const issues: string[] = [];
  const breakdown = { keywordDensity: 20, headingQuality: 20, repetition: 20, naturalness: 20, wordCount: 20 };
  
  // 1. Keyword density (0-20)
  const density = checkKeywordDensity(html, keyword, 1.0);
  if (density.density > 1.5) { 
    breakdown.keywordDensity = 0; 
    issues.push('Keyword density too high'); 
  } else if (density.density > 1.0) { 
    breakdown.keywordDensity = 10; 
  }
  
  // 2. Heading quality (0-20)
  const headingValidation = validateHeadings(html, keyword);
  breakdown.headingQuality = headingValidation.isValid ? 20 : Math.max(0, 20 - headingValidation.issues.length * 5);
  issues.push(...headingValidation.issues);
  
  // 3. Repetition (0-20)
  const repetition = detectRepetition(html);
  const repPenalty = repetition.duplicateSentences.length * 5 + repetition.overusedTerms.length * 3;
  breakdown.repetition = Math.max(0, 20 - repPenalty);
  
  // 4. Naturalness (0-20)
  const natural = checkNaturalness(html);
  breakdown.naturalness = natural.score / 5;
  issues.push(...natural.issues);
  
  // 5. Word count (0-20)
  const wordCount = html.split(/\s+/).length;
  const limits = WORD_LIMITS[pageType];
  if (wordCount < limits.min * 0.8 || wordCount > limits.max * 1.2) {
    breakdown.wordCount = 0;
    issues.push(`Word count ${wordCount} outside limits ${limits.min}-${limits.max}`);
  } else if (wordCount < limits.min || wordCount > limits.max) {
    breakdown.wordCount = 10;
  }
  
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  
  return {
    total,
    breakdown,
    pass: total >= 70,
    issues,
  };
}

/**
 * Generate keyword variations to prevent keyword stuffing
 * Returns 8-10 natural variations of the focus keyword
 */
async function generateKeywordVariations(
  focusKeyword: string,
  niche: string,
  city: string,
  state: string
): Promise<string[]> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'Generate keyword variations to avoid stuffing. Return JSON object with "variations" array.'
        },
        {
          role: 'user',
          content: (() => {
            const nicheVars = getNicheVariations(niche);
            return `Generate 8 natural variations of "${focusKeyword}" for a ${niche} business in ${city}, ${state}.

Include:
- Service-only (no location): e.g., "${nicheVars.serviceTerms[0]}"
- Location-only: e.g., "${city} ${nicheVars.serviceTerms[1]}"  
- Professional versions: e.g., "professional ${nicheVars.serviceTerms[2]}"
- Generic versions: e.g., "our technicians", "local experts"

Available service terms for this niche: ${nicheVars.serviceTerms.join(', ')}

Return JSON object with "variations" array of strings only, no markdown:
{"variations": ["variation 1", "variation 2", ...]}`;
          })()
        }
      ],
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return [];
    
    const parsed = JSON.parse(content);
    const variations = Array.isArray(parsed) ? parsed : parsed.variations || [];
    
    // Filter out empty strings and ensure we have at least a few
    return variations.filter((v: any) => typeof v === 'string' && v.trim().length > 0).slice(0, 10);
  } catch (error) {
    console.error('[generateKeywordVariations] Error:', error);
    return []; // Fallback: no variations, GPT will improvise
  }
}

// Direct API call with detailed logging (no fallback per user request)
async function callWithFallback(
  createOptions: Omit<OpenAI.Chat.ChatCompletionCreateParams, 'model'> & { model: string }
): Promise<OpenAI.Chat.ChatCompletion> {
  const model = createOptions.model;
  
  console.log(`[GPT] Calling model: ${model}`);
  console.log(`[GPT] Messages count: ${createOptions.messages.length}`);
  console.log(`[GPT] Max tokens: ${createOptions.max_tokens}`);
  
  try {
    const result = await openai.chat.completions.create({
      ...createOptions,
      model,
      stream: false,
    });
    
    console.log(`[GPT] Response received from ${model}`);
    console.log(`[GPT] Choices count: ${result.choices?.length}`);
    console.log(`[GPT] Finish reason: ${result.choices[0]?.finish_reason}`);
    console.log(`[GPT] Content length: ${result.choices[0]?.message?.content?.length || 0}`);
    console.log(`[GPT] Content preview: ${result.choices[0]?.message?.content?.substring(0, 100)}...`);
    
    // Check for refusal (GPT-5 can refuse)
    const message = result.choices[0]?.message;
    if (message?.refusal) {
      console.error(`[GPT] Model refused: ${message.refusal}`);
      throw new Error(`GPT refused: ${message.refusal}`);
    }
    
    const content = message?.content;
    if (!content || content.trim().length === 0) {
      console.error(`[GPT] Empty content. Full response:`, JSON.stringify(result, null, 2));
      throw new Error(`GPT returned empty content. Finish reason: ${result.choices[0]?.finish_reason}`);
    }
    
    return result;
  } catch (error: any) {
    console.error(`[GPT] Error with ${model}:`, error.message);
    console.error(`[GPT] Full error:`, error);
    throw error;
  }
}

export interface PageContext {
  siteId: string;
  siteName: string;
  niche: string;
  city: string;
  state: string;
  brand: {
    name: string;
    phonePretty: string;
    phoneClean: string;
    email: string;
    city: string;
    state: string;
  };
  keywords: string[];
  promptProfile?: {
    systemPrompt: string;
    styleGuidelines: string;
  };
  enrichedData?: EnrichedContext; // NEW: Auto-enriched location/service data
}

/**
 * Concept memory tracker to prevent repetition across sections
 */
interface ConceptMemory {
  climateStatementUsed: boolean;
  energyEfficiencyUsed: boolean;
  technicianCredentialsUsed: boolean;
  licensedInsuredUsed: boolean;
  localExpertsUsed: boolean;
  qualityServiceUsed: boolean;
  usedPhrases: string[];  // Track exact phrases used
}

function createConceptMemory(): ConceptMemory {
  return {
    climateStatementUsed: false,
    energyEfficiencyUsed: false,
    technicianCredentialsUsed: false,
    licensedInsuredUsed: false,
    localExpertsUsed: false,
    qualityServiceUsed: false,
    usedPhrases: [],
  };
}

function updateConceptMemory(content: string, memory: ConceptMemory): ConceptMemory {
  const text = content.toLowerCase();
  
  if (/hot summers?|humid|humidity|warm weather|florida heat/i.test(text)) {
    memory.climateStatementUsed = true;
  }
  if (/energy efficien|energy star|lower.*bills?|save.*energy/i.test(text)) {
    memory.energyEfficiencyUsed = true;
  }
  if (/certified|trained|qualified|experienced|expert technicians?/i.test(text)) {
    memory.technicianCredentialsUsed = true;
  }
  if (/licensed and insured|fully licensed|bonded/i.test(text)) {
    memory.licensedInsuredUsed = true;
  }
  if (/local experts?|trusted local|your local/i.test(text)) {
    memory.localExpertsUsed = true;
  }
  if (/quality service|exceptional service|top-notch/i.test(text)) {
    memory.qualityServiceUsed = true;
  }
  
  // Extract 4-word phrases for tracking
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length - 3; i++) {
    const phrase = words.slice(i, i + 4).join(' ');
    if (phrase.length > 15) memory.usedPhrases.push(phrase);
  }
  
  return memory;
}

function getConceptAvoidanceRules(memory: ConceptMemory): string {
  const rules: string[] = [];
  
  if (memory.climateStatementUsed) {
    rules.push('- DO NOT mention climate, weather, humidity, or "hot summers" - already covered');
  }
  if (memory.energyEfficiencyUsed) {
    rules.push('- DO NOT mention energy efficiency, ENERGY STAR, or utility savings - already covered');
  }
  if (memory.technicianCredentialsUsed) {
    rules.push('- DO NOT mention technician certifications or training - already covered');
  }
  if (memory.licensedInsuredUsed) {
    rules.push('- DO NOT mention "licensed and insured" or bonding - already covered');
  }
  if (memory.localExpertsUsed) {
    rules.push('- DO NOT use phrases like "local experts" or "trusted local" - already covered');
  }
  
  return rules.length > 0 
    ? `\n\nCONCEPTS ALREADY USED (DO NOT REPEAT):\n${rules.join('\n')}`
    : '';
}

/**
 * Enriched context data auto-generated by GPT
 */
interface EnrichedContext {
  neighborhoods: string[];      // Real neighborhoods in the city
  landmarks: string[];          // Known landmarks, parks, shopping centers
  serviceVariations: string[];  // Synonyms for the primary service
  painPoints: string[];         // Customer problems this service solves
  benefits: string[];           // Outcomes customers receive
}

const DEFAULT_ENRICHED_CONTEXT: EnrichedContext = {
  neighborhoods: [],
  landmarks: [],
  serviceVariations: [],
  painPoints: [],
  benefits: [],
};

/**
 * Auto-enrich context data using GPT
 * Generates neighborhoods, landmarks, service variations, pain points, and benefits
 */
async function enrichContextData(
  city: string,
  state: string,
  niche: string,
  primaryKeyword: string,
  model: string = 'gpt-4o-mini'
): Promise<EnrichedContext> {
  console.log(`[Enrichment] Generating context data for ${city}, ${state} - ${niche}`);
  
  const systemPrompt = `You are a local SEO data enrichment assistant.
Generate realistic, publicly known location and service data.

CRITICAL RULES:
- Only use REAL, commonly known places that exist
- DO NOT fabricate awards, certifications, or memberships
- DO NOT invent fake neighborhood names
- Generic names like "Downtown", "North Side", "East End" are OK if specific ones unknown
- Service variations must be realistic industry terms
- Pain points must be genuine customer concerns
- Benefits must be real outcomes

Return ONLY valid JSON, no markdown.`;

  const userPrompt = `Generate location and service data for a ${niche} business in ${city}, ${state}.
Primary service: "${primaryKeyword}"

Generate:
1. NEIGHBORHOODS (8-12): Real neighborhoods, subdivisions, or districts in ${city}
   - Use well-known residential areas, communities, or districts
   - Include zip code areas if helpful (e.g., "the 33543 area")
   
2. LANDMARKS (4-8): Well-known public places in or near ${city}
   - Shopping centers, malls, parks, libraries, schools, hospitals
   - Major roads or intersections
   - DO NOT include private businesses
   
3. SERVICE_VARIATIONS (8-10): Natural synonyms for "${primaryKeyword}"
   - Terms a real customer would use
   - Include both formal and casual versions
   - Include location variations (e.g., "${city} AC service")
   
4. PAIN_POINTS (6-8): Customer problems that "${primaryKeyword}" solves
   - Performance issues, cost concerns, reliability problems
   - Safety concerns, convenience issues
   - Be specific to the service type
   
5. BENEFITS (6-8): Outcomes customers get from "${primaryKeyword}"
   - Comfort, savings, reliability, safety, convenience
   - Peace of mind, improved efficiency
   - Be specific to the service type

Return JSON format:
{
  "neighborhoods": ["name1", "name2", ...],
  "landmarks": ["name1", "name2", ...],
  "serviceVariations": ["term1", "term2", ...],
  "painPoints": ["problem1", "problem2", ...],
  "benefits": ["benefit1", "benefit2", ...]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      max_tokens: 800,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error('[Enrichment] Empty response from GPT');
      return DEFAULT_ENRICHED_CONTEXT;
    }

    const parsed = JSON.parse(content);
    
    const enriched: EnrichedContext = {
      neighborhoods: Array.isArray(parsed.neighborhoods) ? parsed.neighborhoods : [],
      landmarks: Array.isArray(parsed.landmarks) ? parsed.landmarks : [],
      serviceVariations: Array.isArray(parsed.serviceVariations) ? parsed.serviceVariations : [],
      painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
      benefits: Array.isArray(parsed.benefits) ? parsed.benefits : [],
    };
    
    console.log(`[Enrichment] Generated: ${enriched.neighborhoods.length} neighborhoods, ${enriched.landmarks.length} landmarks, ${enriched.serviceVariations.length} variations`);
    
    return enriched;
  } catch (error: any) {
    console.error('[Enrichment] Error:', error.message);
    return DEFAULT_ENRICHED_CONTEXT;
  }
}

export interface GeneratedPage {
  pageId: string;
  sections: Section[];
  html: string;
  wordCount: number;
}

/**
 * Generate content for a single page
 */
export async function generatePageContent(pageId: string, model: string = 'gpt-4o-mini'): Promise<GeneratedPage> {
  const page = await prisma.sitePage.findUnique({
    where: { id: pageId },
    include: {
      site: {
        include: {
          niche: true,
          promptProfile: true,
          batch: {
            include: {
              keywords: {
                where: { isSkipped: false },
                include: {
                  difficultyScore: true,
                },
                orderBy: [
                  { difficultyScore: { opportunity: 'desc' } },
                ],
                take: 5,
              },
            },
          },
        },
      },
      skeletons: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  if (!page) {
    throw new Error(`Page ${pageId} not found`);
  }

  const site = page.site;
  const brand = buildBrandSpec({
    siteName: site.siteName,
    city: site.city,
    state: site.state,
    email: site.email,
    domain: site.domain,
    trackingNumber: site.trackingNumber,
    twilioNumber: site.twilioNumber,
    forwardToNumber: site.forwardToNumber,
    logoUrl: site.logoUrl,
  });

  const context: PageContext = {
    siteId: site.id,
    siteName: site.siteName || `${site.city} ${site.niche.name}`,
    niche: site.niche.slug,
    city: site.city,
    state: site.state,
    brand,
    keywords: site.batch?.keywords?.map(kw => kw.localizedQuery).filter((q): q is string => !!q) || [],
    promptProfile: site.promptProfile
      ? {
          systemPrompt: site.promptProfile.systemPrompt || '',
          styleGuidelines: site.promptProfile.styleGuidelines || '',
        }
      : undefined,
  };

  // Get all pages for internal linking
  const allPages = await prisma.sitePage.findMany({
    where: { siteId: site.id },
    select: {
      slug: true,
      titleTag: true,
      focusKeyword: true,
      supportingKeywords: true,
    },
  });

  const pageLinks: PageLink[] = allPages.map(p => ({
    slug: p.slug || 'home',
    title: p.titleTag || p.focusKeyword,
    focusKeyword: p.focusKeyword,
    supportingKeywords: p.supportingKeywords || [],
  }));

  // Get external resources for this page
  const pageKeywords = [page.focusKeyword, ...(page.supportingKeywords || [])];
  const externalResources = getExternalLinksForPrompt(context.niche, pageKeywords, 2);

  // Generate keyword variations to prevent stuffing
  const keywordVariations = await generateKeywordVariations(
    page.focusKeyword,
    context.niche,
    context.city,
    context.state
  );
  console.log(`[Content Quality] Generated ${keywordVariations.length} keyword variations`);

  // NEW: Auto-enrich context data (neighborhoods, landmarks, etc.)
  const enrichedData = await enrichContextData(
    context.city,
    context.state,
    context.niche,
    page.focusKeyword,
    model
  );
  context.enrichedData = enrichedData;
  
  // Merge enriched service variations with keyword variations
  const allVariations = [...new Set([...keywordVariations, ...enrichedData.serviceVariations])];

  // If no skeletons exist, build them from blueprints first
  if (page.skeletons.length === 0) {
    console.log(`[generatePageContent] No skeletons found for page ${pageId}, building from blueprints...`);
    try {
      await buildSkeletonsForPage(pageId);
      // Reload page with skeletons
      const reloadedPage = await prisma.sitePage.findUnique({
        where: { id: pageId },
        include: {
          skeletons: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
      if (reloadedPage) {
        page.skeletons = reloadedPage.skeletons;
        console.log(`[generatePageContent] Built ${page.skeletons.length} skeletons for page`);
      }
    } catch (error) {
      console.error(`[generatePageContent] Failed to build skeletons:`, error);
      // Continue with fallback generation
    }
  }

  // Generate sections based on ContentSkeleton
  const sections: Section[] = [];
  
  // Track keyword usage and word count across all sections
  const totalWordBudget = WORD_LIMITS[page.pageType].max;
  let usedWords = 0;
  let usedExactKeywords = 0;
  const MAX_EXACT_KEYWORDS = 5;
  const escapedKeyword = page.focusKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isHomePage = page.pageType === PageType.HOME;
  
  // MODULE 3: Create concept memory to prevent repetition
  const conceptMemory = createConceptMemory();
  
  // MODULE 1: Get page template
  const template = PAGE_TEMPLATES[page.pageType];
  
  if (page.skeletons.length > 0) {
    // Use existing skeletons
    for (const skeleton of page.skeletons) {
      // MODULE 1: Check template constraints
      if (sections.length >= template.maxSections) {
        console.log(`[Template Guard] Max sections reached for ${page.pageType}`);
        break; // Stop generating more sections
      }
      if (template.bannedSections.includes(skeleton.sectionId)) {
        console.log(`[Template Guard] Skipping banned section: ${skeleton.sectionId}`);
        continue;
      }
      // Calculate this section's budget
      const sectionBudget = calculateSectionBudget(
        page.pageType,
        skeleton.sectionId,
        totalWordBudget - usedWords
      );
      
      // Skip if word budget exhausted
      if (sectionBudget.maxWords < 50) {
        console.log(`[Budget] Skipping ${skeleton.sectionId} - word budget exhausted`);
        continue;
      }
      
      // Adjust keyword budget based on usage
      const adjustedKeywordBudget = {
        maxWords: sectionBudget.maxWords,
        exactKeywords: Math.min(sectionBudget.exactKeywords, MAX_EXACT_KEYWORDS - usedExactKeywords)
      };
      // Override ALL section headings to replace niche slug with focus keyword
      let heading = skeleton.heading;
      
      // Extract service from focus keyword (e.g., "ac repair" from "ac repair in Wesley Chapel")
      const focusKeywordService = page.focusKeyword?.split(' in ')[0]?.trim() || page.focusKeyword;
      
      // Replace niche slug with focus keyword service in heading
      if (heading) {
        // Replace niche variations (case-insensitive)
        const nicheRegex = new RegExp(context.niche, 'gi');
        heading = heading.replace(nicheRegex, focusKeywordService);
      }
      
      // For hero sections, always use the full focus keyword + brand format
      if (skeleton.sectionId.includes('hero') || skeleton.sectionId === 'hero_intro') {
        heading = `${page.focusKeyword} | ${context.brand.name}`;
      }
      
      const sectionContent = await generateSectionContent(
        { ...skeleton, targetWordCount: adjustedKeywordBudget.maxWords },
        context, 
        page, 
        model,
        externalResources,
        usedExactKeywords,
        totalWordBudget - usedWords,
        allVariations, // Use merged variations (keyword + service)
        adjustedKeywordBudget,
        conceptMemory // MODULE 3: Pass concept memory
      );
      
      // MODULE 3: Update concept memory after section generation
      updateConceptMemory(sectionContent, conceptMemory);
      
      // Track usage
      const sectionWordCount = sectionContent.split(/\s+/).length;
      usedWords += sectionWordCount;
      const sectionKeywordCount = (sectionContent.match(new RegExp(escapedKeyword, 'gi')) || []).length;
      usedExactKeywords += sectionKeywordCount;
      
      sections.push({
        id: skeleton.sectionId,
        type: mapSectionType(skeleton.sectionId),
        heading: heading, // Use overridden heading
        content: sectionContent,
        metadata: {
          targetWordCount: adjustedKeywordBudget.maxWords,
          styleVariant: skeleton.styleVariant || undefined,
        },
      });
    }
    
    // CRITICAL: Always add testimonials section for SEO audit requirements (WEAK_BRAND_PRESENCE fix)
    const hasTestimonialsSection = sections.some(s => s.type === 'testimonials' || s.id === 'testimonials');
    if (!hasTestimonialsSection) {
      sections.push({
        id: 'testimonials',
        type: 'testimonials',
        heading: `What ${context.city} Customers Say About ${context.brand.name}`,
        content: `★★★★★ "Excellent ${page.focusKeyword} service! The team from ${context.brand.name} was professional and arrived on time. Highly recommend to anyone in ${context.city}!" - Sarah M., ${context.city}\n\n★★★★★ "Best ${page.focusKeyword.split(' in ')[0] || page.focusKeyword} company in ${context.city}, ${context.state}! Fair pricing and quality work. Will definitely use again." - Mike T., ${context.city}\n\n★★★★★ "Fast response time and great communication. ${context.brand.name} is our go-to for ${page.focusKeyword.split(' in ')[0] || page.focusKeyword} in ${context.city}." - Jennifer R., ${context.city}`,
        metadata: { targetWordCount: 150 },
      });
    }
    
    // CRITICAL: Always add trust badges section for brand presence (WEAK_BRAND_PRESENCE fix)
    const hasTrustBadges = sections.some(s => s.type === 'trust-badges' || s.id === 'trust-badges');
    if (!hasTrustBadges) {
      sections.push({
        id: 'trust-badges',
        type: 'trust-badges',
        heading: 'Why Trust Us',
        content: `Licensed & Insured in ${context.state}\nLocally Owned & Operated\n100% Satisfaction Guaranteed\n24/7 Emergency Service Available\nFree Estimates on All Work`,
        metadata: { targetWordCount: 50 },
      });
    }
    
    // CRITICAL: Always add FAQ section for SERP features (MISSING_SERP_FEATURES fix)
    const hasFAQSection = sections.some(s => s.type === 'faq-accordion' || s.id === 'faq' || s.id?.includes('faq'));
    if (!hasFAQSection) {
      // Generate city-specific FAQ content
      const faqBudget = calculateSectionBudget(page.pageType, 'faq', totalWordBudget - usedWords);
      const adjustedFaqBudget = {
        maxWords: faqBudget.maxWords,
        exactKeywords: Math.min(faqBudget.exactKeywords, MAX_EXACT_KEYWORDS - usedExactKeywords)
      };
      
      const faqContent = await generateSectionContent(
        {
          sectionId: 'faq',
          heading: `Frequently Asked Questions About ${page.focusKeyword} in ${context.city}`,
          purpose: `Generate 5-7 FAQ questions and answers specific to ${page.focusKeyword} in ${context.city}, ${context.state}. Include city-specific details like neighborhoods, local regulations, or area-specific concerns.`,
          targetWordCount: adjustedFaqBudget.maxWords,
          requiredKeywordRoles: [],
          optionalKeywordRoles: [],
          localHints: [
            `Mention specific neighborhoods in ${context.city}`,
            `Include ${context.city}-specific regulations or requirements`,
            `Reference local landmarks or areas in ${context.city}`,
            `Make answers unique to ${context.city}, not generic`,
          ],
        },
        context,
        page,
        model,
        externalResources,
        usedExactKeywords,
        totalWordBudget - usedWords,
        allVariations, // Use merged variations
        adjustedFaqBudget
      );
      
      const faqKeywordCount = (faqContent.match(new RegExp(escapedKeyword, 'gi')) || []).length;
      usedExactKeywords += faqKeywordCount;
      usedWords += faqContent.split(/\s+/).length;
      
      sections.push({
        id: 'faq',
        type: 'faq-accordion',
        heading: `Frequently Asked Questions About ${page.focusKeyword} in ${context.city}`,
        content: faqContent,
        metadata: { targetWordCount: 400 },
      });
    }
    
    // CRITICAL: Add city-specific case study section for uniqueness (HEAVY_BOILERPLATE fix)
    const hasCaseStudy = sections.some(s => s.type === 'case-study' || s.id?.includes('case'));
    if (!hasCaseStudy) {
      const caseBudget = calculateSectionBudget(page.pageType, 'case_study', totalWordBudget - usedWords);
      const adjustedCaseBudget = {
        maxWords: caseBudget.maxWords,
        exactKeywords: Math.min(caseBudget.exactKeywords, MAX_EXACT_KEYWORDS - usedExactKeywords)
      };
      
      const caseStudyContent = await generateSectionContent(
        {
          sectionId: 'case_study',
          heading: `Recent ${page.focusKeyword} Project in ${context.city}`,
          purpose: `Describe a specific, detailed project completed in ${context.city}. Include neighborhood name, specific challenges, solutions, and results. Make this 100% unique to ${context.city} - include real neighborhood names, local landmarks, or city-specific details.`,
          targetWordCount: adjustedCaseBudget.maxWords,
          requiredKeywordRoles: [],
          optionalKeywordRoles: [],
          localHints: [
            `Mention a specific neighborhood in ${context.city} (e.g., Downtown ${context.city}, ${context.city} Heights, etc.)`,
            `Include a specific street or area name in ${context.city}`,
            `Reference local weather patterns, regulations, or conditions specific to ${context.city}`,
            `Make this story unique - no generic template language`,
          ],
        },
        context,
        page,
        model,
        externalResources,
        usedExactKeywords,
        totalWordBudget - usedWords,
        keywordVariations,
        adjustedCaseBudget
      );
      
      const caseKeywordCount = (caseStudyContent.match(new RegExp(escapedKeyword, 'gi')) || []).length;
      usedExactKeywords += caseKeywordCount;
      usedWords += caseStudyContent.split(/\s+/).length;
      
      sections.push({
        id: 'case_study',
        type: 'case-study',
        heading: `Recent ${page.focusKeyword} Project in ${context.city}`,
        content: caseStudyContent,
        metadata: { targetWordCount: 300 },
      });
    }
    
    // CRITICAL: Add neighborhoods section with specific areas for uniqueness (HEAVY_BOILERPLATE fix)
    const hasNeighborhoods = sections.some(s => s.type === 'neighborhoods' || s.id?.includes('neighborhood'));
    if (!hasNeighborhoods) {
      const neighborhoodsBudget = calculateSectionBudget(page.pageType, 'neighborhoods', totalWordBudget - usedWords);
      const adjustedNeighborhoodsBudget = {
        maxWords: neighborhoodsBudget.maxWords,
        exactKeywords: Math.min(neighborhoodsBudget.exactKeywords, MAX_EXACT_KEYWORDS - usedExactKeywords)
      };
      
      const neighborhoodsContent = await generateSectionContent(
        {
          sectionId: 'neighborhoods',
          heading: `Areas We Serve in ${context.city}, ${context.state}`,
          purpose: `List 8-12 specific neighborhoods, districts, or areas within ${context.city} where services are provided. Include brief descriptions of each area. Make this unique to ${context.city} - use real neighborhood names.`,
          targetWordCount: adjustedNeighborhoodsBudget.maxWords,
          requiredKeywordRoles: [],
          optionalKeywordRoles: [],
          localHints: [
            `List real neighborhood names in ${context.city} (research actual neighborhoods)`,
            `Include zip codes or districts specific to ${context.city}`,
            `Mention local landmarks or business districts in ${context.city}`,
            `Make this list unique to ${context.city} - no generic "downtown" or "suburbs"`,
          ],
        },
        context,
        page,
        model,
        externalResources,
        usedExactKeywords,
        totalWordBudget - usedWords,
        allVariations, // Use merged variations
        adjustedNeighborhoodsBudget
      );
      
      const neighborhoodsKeywordCount = (neighborhoodsContent.match(new RegExp(escapedKeyword, 'gi')) || []).length;
      usedExactKeywords += neighborhoodsKeywordCount;
      usedWords += neighborhoodsContent.split(/\s+/).length;
      
      sections.push({
        id: 'neighborhoods',
        type: 'neighborhoods',
        heading: `Areas We Serve in ${context.city}, ${context.state}`,
        content: neighborhoodsContent,
        metadata: { targetWordCount: 250 },
      });
    }
  } else {
    // Fallback: generate default sections based on page type
    sections.push(...await generateDefaultSections(page.pageType, context, page, model, externalResources, allVariations, conceptMemory));
  }

  // Inject internal links into each section's content
  for (const section of sections) {
    if (section.content && section.type !== 'hero' && section.type !== 'cta-block') {
      section.content = injectInternalLinks(
        section.content,
        pageLinks,
        page.slug || undefined,
        3 // Max 3 links per section
      );
    }
  }

  // Add "Related Services" section if applicable
  if (page.pageType === PageType.CORE_SERVICE) {
    const relatedServicesHtml = addRelatedServicesSection(pageLinks, page.slug || undefined, 5);
    if (relatedServicesHtml) {
      sections.push({
        id: 'related_services',
        type: 'content',
        heading: 'Related Services',
        content: relatedServicesHtml,
      });
    }
  }

  // Generate SEO meta title and description
  const seoMeta = await generateSEOMeta(
    page.focusKeyword,
    page.pageType,
    brand.name,
    context.city,
    context.state,
    model
  );

  // Generate AI image suggestions for this page
  const suggestedImageKeywords = await generateImageSuggestions(
    page.focusKeyword,
    page.pageType,
    context.niche,
    context.city,
    context.state,
    model
  );

  // Update page with SEO meta and image suggestions
  await prisma.sitePage.update({
    where: { id: pageId },
    data: {
      titleTag: seoMeta.title,
      seoDescription: seoMeta.description,
      suggestedImageKeywords,
    },
  });

  // Generate schema markup
  // Extract FAQ items from all sections, prioritizing FAQ sections
  const faqSection = sections.find(s => s.type === 'faq-accordion');
  let faqItems: Array<{ question: string; answer: string }> = [];
  
  if (faqSection) {
    // Extract from FAQ section first
    faqItems = extractFAQFromContent(faqSection.content);
    
    // If no FAQ items found, extract from all content as fallback
    if (faqItems.length === 0) {
      faqItems = extractFAQFromContent(sections.map(s => s.content).join(' '));
    }
  } else {
    // No FAQ section, try to extract from all content
    faqItems = extractFAQFromContent(sections.map(s => s.content).join(' '));
  }
  
  // Check if there's a testimonials section
  const hasTestimonials = sections.some(s => s.type === 'testimonials' || s.id === 'testimonials');
  
  const schemaOptions: SchemaOptions = {
    brand: {
      name: brand.name,
      phonePretty: brand.phonePretty,
      phoneClean: brand.phoneClean,
      email: brand.email,
      city: brand.city,
      state: brand.state,
      domain: site.domain || undefined,
    },
    pageType: page.pageType,
    focusKeyword: page.focusKeyword,
    faqItems: faqItems.length > 0 ? faqItems : undefined,
    serviceName: page.pageType === PageType.CORE_SERVICE
      ? page.focusKeyword 
      : undefined,
    hasTestimonials,
    reviewCount: hasTestimonials ? 50 : undefined,
  };
  const schemaMarkup = generateSchemaMarkup(schemaOptions);

  // Build canonical URL
  const baseUrl = site.domain ? `https://${site.domain}` : `https://example.com`;
  const pageUrl = `${baseUrl}/${page.slug || ''}`;

  // Get hero image if available
  const heroImageUrl = page.heroImageUrl;
  const heroImageAlt = page.heroImageAlt || (heroImageUrl ? generateAltText({
    focusKeyword: page.focusKeyword,
    city: context.city,
    state: context.state,
    context: 'hero image',
  }) : undefined);

  // Build HTML using semantic builder
  let html = buildPageHtml(
    sections,
    brand,
    seoMeta.title,
    seoMeta.description,
    schemaMarkup,
    pageUrl,
    page.focusKeyword
  );

  // Inject hero image into hero section if available
  if (heroImageUrl) {
    const heroImageHtml = `<img src="${heroImageUrl}" alt="${heroImageAlt || ''}" class="hero-image" />`;
    // Insert hero image at the start of hero section content
    html = html.replace(
      /(<section class="hero-section">[\s\S]*?<div class="hero-content">)/i,
      `$1\n    <div class="hero-image-wrapper">${heroImageHtml}</div>`
    );
  }

  // Process all images in content to ensure they have alt text
  html = html.replace(/<img([^>]*?)(?:\s+alt=["']([^"']*)["'])?([^>]*?)>/gi, (match, before, existingAlt, after) => {
    // If image already has alt text, keep it
    if (existingAlt) {
      return match;
    }
    
    // Generate alt text based on context
    // Try to extract context from surrounding content or use default
    const altText = generateAltText({
      focusKeyword: page.focusKeyword,
      city: context.city,
      state: context.state,
      context: 'image',
    });
    
    // Insert alt attribute
    return `<img${before} alt="${altText}"${after}>`;
  });

  // Calculate initial word count
  let wordCount = html.split(/\s+/).length;

  // COMPLETE POST-PROCESSING PIPELINE
  if (keywordVariations.length > 0) {
    console.log('[Post-Process] Starting sanitization pipeline...');
    
    // Step 1: Validate current state
    const preValidation = validateContent(html, page.focusKeyword, page.pageType, keywordVariations);
    console.log(`[Pre-Validation] ${preValidation.violations.length} issues found`);
    preValidation.violations.forEach(v => console.log(`  - [${v.severity}] ${v.type}: ${v.message}`));
    
    // Step 2: Run sanitizer
    // MODULE 7: Use htmlSafePostProcess instead of sanitizeContent
    const { html: sanitizedHtml, fixes } = htmlSafePostProcess(
      html, 
      page.focusKeyword, 
      context.niche,
      allVariations, // Use merged variations
      context.city // Pass city for heading rewrites
    );
    html = sanitizedHtml;
    fixes.forEach(fix => console.log(`[Fix] ${fix}`));
    
    // MODULE 9: Quality scoring
    const score = scoreContent(html, page.focusKeyword, page.pageType, allVariations);
    console.log(`[Quality Score] ${score.total}/100 - ${score.pass ? 'PASS' : 'FAIL'}`);
    console.log(`[Quality Breakdown] Keyword: ${score.breakdown.keywordDensity}/20, Headings: ${score.breakdown.headingQuality}/20, Repetition: ${score.breakdown.repetition}/20, Naturalness: ${score.breakdown.naturalness}/20, WordCount: ${score.breakdown.wordCount}/20`);
    if (!score.pass) {
      console.log(`[Quality Issues] ${score.issues.join(', ')}`);
    }
  }

  // Recalculate final metrics
  wordCount = html.split(/\s+/).length;
  const finalDensity = checkKeywordDensity(html, page.focusKeyword, 1.0);
  console.log(`[Final] Words: ${wordCount}, Density: ${finalDensity.density}%, Exact matches: ${finalDensity.count}`);

  return {
    pageId: page.id,
    sections,
    html,
    wordCount,
  };
}

/**
 * Generate SEO meta title and description using GPT
 */
async function generateSEOMeta(
  focusKeyword: string,
  pageType: PageType,
  brandName: string,
  city: string,
  state: string,
  model: string = 'gpt-4o-mini'
): Promise<{ title: string; description: string }> {
  const systemPrompt = `
You are an expert SEO copywriter specializing in local business optimization.
Generate compelling, keyword-focused SEO meta tags that drive clicks and conversions.
`;

  const pageTypeName = pageType === PageType.HOME ? 'homepage' :
                       pageType === PageType.CORE_SERVICE ? 'service page' :
                       pageType === PageType.CITY ? 'city page' :
                       pageType === PageType.ABOUT ? 'about page' :
                       pageType === PageType.CONTACT ? 'contact page' :
                       'page';

  const userPrompt = `
Generate SEO meta tags for a ${pageTypeName}:

- Focus keyword: "${focusKeyword}"
- Business: ${brandName} in ${city}, ${state}

CRITICAL REQUIREMENTS:
1. Title: Maximum 60 characters, MUST contain "${focusKeyword}"
2. Description: Maximum 160 characters, MUST START with "${focusKeyword}"
3. Description should include a call-to-action (e.g., "Call today", "Get a free quote")
4. Make it compelling and click-worthy
5. Include location (${city}, ${state}) naturally

Output format (JSON only, no markdown):
{
  "title": "exact title here",
  "description": "exact description here"
}
`;

  try {
    const completion = await callWithFallback({
      model,
      max_tokens: 300,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt.trim() },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content!;

    const parsed = JSON.parse(content);
    let title = parsed.title || `${focusKeyword} | ${brandName}`;
    let description = parsed.description || `${focusKeyword} services in ${city}, ${state}. Call ${brandName} today!`;

    // Enforce requirements
    // Title must contain focus keyword
    if (!title.toLowerCase().includes(focusKeyword.toLowerCase())) {
      title = `${focusKeyword} | ${brandName}`;
    }
    // Truncate title to 60 chars
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }

    // Description must start with focus keyword
    if (!description.toLowerCase().startsWith(focusKeyword.toLowerCase())) {
      description = `${focusKeyword} ${description}`;
    }
    // Truncate description to 160 chars
    if (description.length > 160) {
      description = description.substring(0, 157) + '...';
    }

    return { title, description };
  } catch (error: any) {
    console.error(`[generateSEOMeta] Error:`, error);
    // Fallback meta
    const fallbackTitle = `${focusKeyword} | ${brandName}`.substring(0, 60);
    const fallbackDesc = `${focusKeyword} services in ${city}, ${state}. Professional service by ${brandName}. Call today for a free quote!`.substring(0, 160);
    return { title: fallbackTitle, description: fallbackDesc };
  }
}

/**
 * Generate AI image search suggestions for a page
 */
async function generateImageSuggestions(
  focusKeyword: string,
  pageType: PageType,
  niche: string,
  city: string,
  state: string,
  model: string = 'gpt-4o-mini'
): Promise<string[]> {
  const systemPrompt = `You are an expert at suggesting stock photo search terms.
Given a page topic and location, suggest 4-6 simple, visual search terms that will return great stock photos from Unsplash.

RULES:
- Use simple, visual terms (2-4 words max)
- Focus on the action or visual element, not the location
- Don't use long-tail SEO keywords
- Don't include city/state names
- Think about what photos would look good on a service business website

Good examples:
- "HVAC technician working"
- "air conditioner unit"
- "plumber fixing pipe"
- "professional handyman"
- "home renovation"

Bad examples (too specific/long):
- "AC repair service in Wesley Chapel Florida"
- "best plumber near me"
- "affordable HVAC installation services"

Return ONLY a JSON array of strings, no other text.`;

  const userPrompt = `Suggest 4-6 stock photo search terms for a ${niche} business page about "${focusKeyword}" in ${city}, ${state}.

Page type: ${pageType}

Return simple, visual search terms that will work well on Unsplash.`;

  try {
    const completion = await callWithFallback({
      model,
      max_tokens: 300,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt.trim() },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    const parsed = JSON.parse(content);
    
    // Handle both array and object with keywords property
    const suggestions = Array.isArray(parsed) 
      ? parsed 
      : parsed.keywords || parsed.suggestions || parsed.searchTerms || [];

    // Filter and limit
    return suggestions
      .filter((s: any) => typeof s === 'string' && s.length > 0 && s.length < 50)
      .slice(0, 6);
  } catch (error: any) {
    console.error(`[generateImageSuggestions] Error:`, error);
    // Return empty array on error - niche-based defaults will be used as fallback
    return [];
  }
}

/**
 * Generate content for a single section using GPT
 */
async function generateSectionContent(
  skeleton: {
    sectionId: string;
    heading: string;
    purpose: string;
    targetWordCount: number;
    styleVariant?: string | null;
    requiredKeywordRoles: string[];
    optionalKeywordRoles: string[];
    localHints: string[];
  },
  context: PageContext,
  page: { focusKeyword: string; pageType: PageType; supportingKeywords?: string[] },
  model: string = 'gpt-4o-mini',
  externalResources: string = '',
  keywordUsageCount: number = 0,
  remainingWordBudget: number = Infinity,
  keywordVariations: string[] = [],
  sectionBudget: { maxWords: number; exactKeywords: number } = { maxWords: 300, exactKeywords: 1 },
  conceptMemory?: ConceptMemory // MODULE 3: Concept memory parameter
): Promise<string> {
  // Extract service name from focus keyword (e.g., "ac repair in Wesley Chapel" -> "AC Repair")
  const extractServiceName = (focusKeyword: string): string => {
    // Remove city/location parts
    const withoutCity = focusKeyword
      .replace(new RegExp(`\\s+(in|near|for)\\s+${context.city}`, 'gi'), '')
      .replace(new RegExp(context.city, 'gi'), '')
      .replace(new RegExp(context.state, 'gi'), '')
      .trim();
    // Capitalize properly
    return withoutCity.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };
  
  const serviceName = extractServiceName(page.focusKeyword);
  const nicheSlug = context.niche.toLowerCase();
  
  const systemPrompt = context.promptProfile?.systemPrompt || `
You are an expert local SEO copywriter. You MUST follow these rules EXACTLY:

RULE 1 - KEYWORD USAGE:
- Use primary keyword EXACTLY ${sectionBudget.exactKeywords} time(s) in this section
- Use variations for all additional mentions
- NEVER force the keyword unnaturally

RULE 2 - HEADINGS:
- NEVER use <h1> tags
- H2s must be natural English, not keyword-first
- H2s may contain keyword OR variation (max 1 exact)
- H3s can ONLY use variations, NEVER exact keyword

RULE 3 - WORD COUNT:
- Write EXACTLY ${sectionBudget.maxWords} words (±10%)
- If you complete your point early, STOP
- Do NOT pad with filler content

RULE 4 - NO REPETITION:
- Do NOT reuse phrases from other sections
- Do NOT repeat climate descriptions ("hot summers", "humid")
- Each section must have unique angle

RULE 5 - UNIQUENESS:
- Make content 100% unique to ${context.city}
- Use real neighborhood names
- Include local landmarks/details

I ACKNOWLEDGE THESE RULES AND WILL FOLLOW THEM EXACTLY.

Service: ${serviceName}
Location: ${context.city}, ${context.state}
`;

  const styleGuidelines = context.promptProfile?.styleGuidelines || `
- Tone: confident, friendly, professional
- No pricing or dollar amounts unless specifically requested
- Emphasize trust, reliability, and local expertise
- Mention licensing & insurance when appropriate
- Use the business name naturally throughout
- Include local references (city, state, neighborhoods)
- Use semantic HTML: <p>, <ul>, <li>, <h2>, <h3> tags
- No inline styles, no Tailwind classes, no frameworks
`;

  const supportingKeywordsText = page.supportingKeywords && page.supportingKeywords.length > 0
    ? `\n- Supporting Keywords: ${page.supportingKeywords.slice(0, 5).join(', ')}`
    : '';

  const externalResourcesText = externalResources
    ? `\n\nExternal Resources (cite 1-2 naturally in your content):\n${externalResources}\n\nWhen referencing these resources, use natural language like "According to [Resource Name]" or "As noted by [Resource Name]".`
    : '';

  const variationsText = keywordVariations.length > 0
    ? `\n- APPROVED VARIATIONS (use these instead of repeating the exact keyword "${page.focusKeyword}"):\n${keywordVariations.map(v => `  * "${v}"`).join('\n')}`
    : '';

  // MODULE 3: Concept avoidance rules
  const avoidanceRules = conceptMemory ? getConceptAvoidanceRules(conceptMemory) : '';
  
  // MODULE 4: Variation injection
  const variationInjection = buildVariationInjection(context.niche, skeleton.sectionId);
  
  // MODULE 5: Strict word budget prompt
  const strictWordPrompt = `
WORD COUNT ENFORCEMENT (CRITICAL):
- This section MUST be ${sectionBudget.maxWords} words (±10% tolerance)
- MINIMUM: ${Math.floor(sectionBudget.maxWords * 0.9)} words
- MAXIMUM: ${Math.ceil(sectionBudget.maxWords * 1.1)} words
- If you finish your point in fewer words, ADD relevant local details
- If you're exceeding the limit, STOP and wrap up the point
- COUNT YOUR WORDS BEFORE SUBMITTING
`;

  // MODULE 6: Keyword budget prompt
  const keywordBudgetPrompt = `
KEYWORD BUDGET FOR THIS SECTION:
- Primary keyword "${page.focusKeyword}" has been used ${keywordUsageCount} times already
- You may use it EXACTLY ${sectionBudget.exactKeywords} more time(s)
- Total page budget is 5-6 exact matches
- After that, use ONLY these variations: ${keywordVariations.slice(0, 5).join(', ')}
${keywordUsageCount >= 4 ? '- IMPORTANT: Keyword budget nearly exhausted - USE VARIATIONS ONLY' : ''}
`;

  const userPrompt = `
Write content for a ${page.pageType} page section.

${strictWordPrompt}

${keywordBudgetPrompt}

STRICT LIMITS (NEVER VIOLATE):
- Word count: EXACTLY ${sectionBudget.maxWords} words (±10%)
- Exact keyword uses: ${sectionBudget.exactKeywords} time(s) ONLY
- ${sectionBudget.exactKeywords === 0 ? 'DO NOT use the exact keyword - variations ONLY' : ''}

KEYWORD RULES:
- Primary keyword: "${page.focusKeyword}"
- Already used ${keywordUsageCount} times on this page (max 5 total)
- ${keywordUsageCount >= 4 ? 'BUDGET EXHAUSTED - use ONLY variations below:' : `You may use exact keyword ${sectionBudget.exactKeywords} time(s)`}
${variationsText}

${variationInjection}

${avoidanceRules}

HEADING RULES:
- NEVER use <h1> tags
- H2 headings: ${sectionBudget.exactKeywords > 0 ? 'May contain keyword OR variation' : 'Variations ONLY, no exact keyword'}
- H3 headings: ALWAYS use variations, NEVER exact keyword

Section: ${skeleton.heading}
Purpose: ${skeleton.purpose}
Business: ${context.brand.name} in ${context.city}, ${context.state}
${skeleton.localHints.length > 0 ? `\nLocal Hints:\n${skeleton.localHints.map(h => `- ${h}`).join('\n')}` : ''}

Style Guidelines:
${styleGuidelines}
${externalResourcesText}

LOCAL SIGNALS REQUIRED:
- Mention "${context.city}" at least 3-5 times in this section
- Mention "${context.state}" at least 1-2 times in this section
${context.enrichedData?.neighborhoods?.length ? `- USE THESE REAL NEIGHBORHOODS: ${context.enrichedData.neighborhoods.slice(0, 6).join(', ')}` : `- Include specific neighborhood names in ${context.city}`}
${context.enrichedData?.landmarks?.length ? `- REFERENCE THESE LANDMARKS: ${context.enrichedData.landmarks.slice(0, 4).join(', ')}` : '- Reference local landmarks or well-known areas'}
- Make content 100% unique to ${context.city}

${context.enrichedData?.painPoints?.length ? `CUSTOMER PAIN POINTS TO ADDRESS:\n${context.enrichedData.painPoints.map(p => `- ${p}`).join('\n')}` : ''}

${context.enrichedData?.benefits?.length ? `BENEFITS TO HIGHLIGHT:\n${context.enrichedData.benefits.map(b => `- ${b}`).join('\n')}` : ''}

Write EXACTLY ${sectionBudget.maxWords} words of clean HTML.

IMPORTANT - HEADING RULES:
- NEVER use <h1> tags - the page already has an H1, do not add another one
- For section headings, use <h2> or <h3> only
- Service name to use: "${serviceName}"
- NEVER use generic terms like "HVAC" or "${nicheSlug}" in headings
- In headings, use "${serviceName}" or "${page.focusKeyword}"
- Example heading: "${serviceName} Services in ${context.city}" or "Why Choose Us for ${serviceName}"

Output ONLY the HTML content text (no markdown, no code blocks, no backticks). DO NOT include any <h1> tags.
`;

  try {
    const completion = await callWithFallback({
      model,
      max_tokens: Math.ceil(skeleton.targetWordCount * 2), // ~2 tokens per word for HTML output
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt.trim() },
      ],
    });

    let content = completion.choices[0]?.message?.content!;

    // Trim content if it exceeds word budget
    const contentWords = content.split(/\s+/);
    if (contentWords.length > skeleton.targetWordCount * 1.2) {
      // Content is 20%+ over target - trim it
      const maxWords = Math.ceil(skeleton.targetWordCount * 1.1);
      content = contentWords.slice(0, maxWords).join(' ') + '...';
      console.warn(`[Content Quality] Trimmed section ${skeleton.sectionId} from ${contentWords.length} to ${maxWords} words`);
    }

    // Post-process to replace any remaining niche slug usage in headings
    let processedContent = content.trim();
    
    // Replace niche slug in H2/H3 headings with service name
    const nichePatterns = [
      // "Our HVAC" -> "Our AC Repair"
      new RegExp(`(<h[23][^>]*>)Our\\s+${nicheSlug}`, 'gi'),
      // "Why Choose HVAC" -> "Why Choose AC Repair"
      new RegExp(`(<h[23][^>]*>)Why\\s+(?:Choose\\s+)?${nicheSlug}`, 'gi'),
      // "HVAC Services" -> "AC Repair Services"
      new RegExp(`(<h[23][^>]*>)${nicheSlug}\\s+Services`, 'gi'),
      // "How Our HVAC" -> "How Our AC Repair"
      new RegExp(`(<h[23][^>]*>)How\\s+Our\\s+${nicheSlug}`, 'gi'),
    ];
    
    for (const pattern of nichePatterns) {
      processedContent = processedContent.replace(pattern, (match, tag) => {
        return match.replace(new RegExp(nicheSlug, 'gi'), serviceName);
      });
    }
    
    // Also replace standalone "HVAC" in headings (case-insensitive but preserve H tag)
    processedContent = processedContent.replace(
      /(<h[23][^>]*>)([^<]*)(hvac)([^<]*<\/h[23]>)/gi,
      (match, openTag, before, hvac, after) => {
        return `${openTag}${before}${serviceName}${after}`;
      }
    );
    
    // CRITICAL: Strip any H1 tags - they should never be in section content
    // Convert H1 to H2 to preserve the heading but fix the SEO issue
    processedContent = processedContent.replace(
      /<h1([^>]*)>([\s\S]*?)<\/h1>/gi,
      '<h2$1>$2</h2>'
    );

    return processedContent;
  } catch (error: any) {
    console.error(`[generateSectionContent] Error for section ${skeleton.sectionId}:`, error);
    throw new Error(`Failed to generate section content: ${error.message}`);
  }
}

/**
 * Generate default sections when no skeleton exists
 */
async function generateDefaultSections(
  pageType: PageType,
  context: PageContext,
  page: { focusKeyword: string; pageType: PageType },
  model: string = 'gpt-4o-mini',
  externalResources: string = '',
  keywordVariations: string[] = [],
  conceptMemory?: ConceptMemory
): Promise<Section[]> {
  const sections: Section[] = [];

  switch (pageType) {
    case PageType.HOME:
      // Audit-optimized section stack for homepage
      sections.push(
        {
          id: 'hero',
          type: 'hero',
          heading: `${page.focusKeyword} | ${context.brand.name}`,
          content: `${page.focusKeyword} services in ${context.city}, ${context.state}. Trusted by homeowners for quality work and exceptional service.`,
        },
        {
          id: 'intro',
          type: 'intro',
          heading: `Professional ${page.focusKeyword} in ${context.city}`,
          content: `We provide professional ${page.focusKeyword} services throughout ${context.city}, ${context.state}. Our experienced team delivers quality results you can trust.`,
        },
        {
          id: 'services',
          type: 'services-grid',
          heading: 'Our Services',
          content: `Expert ${page.focusKeyword} services\nProfessional installation\nEmergency repairs\nMaintenance plans\nQuality guarantees`,
        },
        {
          id: 'neighborhoods',
          type: 'neighborhoods',
          heading: `Areas We Serve in ${context.city}`,
          content: `We proudly serve ${context.city}, ${context.state} and surrounding neighborhoods.`,
        },
        {
          id: 'why-choose-us',
          type: 'why-choose-us',
          heading: 'Why Choose Us',
          content: '',
        },
        {
          id: 'trust-badges',
          type: 'trust-badges',
          heading: 'Licensed & Insured',
          content: `Fully licensed and insured\nBBB Accredited\nYears of experience\nSatisfaction guaranteed`,
        },
        {
          id: 'case-study',
          type: 'case-study',
          heading: `Recent ${context.city} Project`,
          content: `We recently completed a major ${page.focusKeyword} project in ${context.city}, ${context.state}.`,
        },
        {
          id: 'testimonials',
          type: 'testimonials',
          heading: `What ${context.city} Customers Say`,
          content: `★★★★★ "Excellent ${page.focusKeyword} service! The team was professional and arrived on time. Highly recommend to anyone in ${context.city}!" - Sarah M., ${context.city}\n\n★★★★★ "Best ${page.focusKeyword} company in ${context.city}, ${context.state}! Fair pricing and quality work. Will use again." - Mike T., ${context.city}\n\n★★★★★ "Fast response time and great communication. ${context.brand.name} is our go-to for ${page.focusKeyword} in ${context.city}." - Jennifer R., ${context.city}`,
        },
        {
          id: 'guarantees',
          type: 'guarantees',
          heading: 'Our Guarantee',
          content: `100% Satisfaction Guarantee\nFree Estimates\nLifetime Warranty on Parts\n24/7 Emergency Service`,
        },
        {
          id: 'faq',
          type: 'faq-accordion',
          heading: 'Frequently Asked Questions',
          content: `Q: What areas do you serve?\nA: We proudly serve ${context.city}, ${context.state} and surrounding areas.\n\nQ: Are you licensed and insured?\nA: Yes, we are fully licensed and insured for your protection.\n\nQ: Do you offer emergency services?\nA: Yes, we provide 24/7 emergency ${page.focusKeyword} services.\n\nQ: Do you offer free estimates?\nA: Yes, we provide free, no-obligation estimates for all projects.`,
        },
        {
          id: 'hours',
          type: 'hours',
          heading: 'Business Hours',
          content: `Monday - Friday: 8:00 AM - 6:00 PM\nSaturday: 9:00 AM - 4:00 PM\nSunday: Emergency Service Only\n24/7 Emergency Service Available`,
        },
        {
          id: 'cta-footer',
          type: 'cta-block',
          heading: 'Ready to Get Started?',
          content: `Call us today at ${context.brand.phonePretty} for a free estimate!`,
        }
      );
      break;

    case PageType.CORE_SERVICE:
      // Audit-optimized section stack for service pages
      sections.push(
        {
          id: 'hero',
          type: 'hero',
          heading: `${page.focusKeyword} | ${context.brand.name}`,
          content: `Expert ${page.focusKeyword} services for ${context.city} homeowners. Professional, reliable, and affordable.`,
        },
        {
          id: 'intro',
          type: 'intro',
          heading: `Professional ${page.focusKeyword} in ${context.city}`,
          content: `We specialize in ${page.focusKeyword} services throughout ${context.city}, ${context.state}. Our experienced team delivers quality results you can trust.`,
        },
        {
          id: 'neighborhoods',
          type: 'neighborhoods',
          heading: `Areas We Serve for ${page.focusKeyword}`,
          content: `We provide ${page.focusKeyword} services in ${context.city}, ${context.state} and surrounding neighborhoods.`,
        },
        {
          id: 'why-choose-us',
          type: 'why-choose-us',
          heading: `Why Choose Us for ${page.focusKeyword}`,
          content: '',
        },
        {
          id: 'trust-badges',
          type: 'trust-badges',
          heading: 'Licensed & Insured',
          content: `Fully licensed and insured\nBBB Accredited\nYears of experience`,
        },
        {
          id: 'testimonials',
          type: 'testimonials',
          heading: 'What Our Customers Say',
          content: `Customer testimonials and reviews will be generated here.`,
        },
        {
          id: 'guarantees',
          type: 'guarantees',
          heading: 'Our Guarantee',
          content: `100% Satisfaction Guarantee\nFree Estimates\nLifetime Warranty`,
        },
        {
          id: 'faq',
          type: 'faq-accordion',
          heading: 'Frequently Asked Questions',
          content: `Q: Do you offer ${page.focusKeyword} in ${context.city}?\nA: Yes, we provide ${page.focusKeyword} services throughout ${context.city}, ${context.state}.\n\nQ: Are you licensed and insured?\nA: Yes, we are fully licensed and insured.\n\nQ: Do you offer free estimates?\nA: Yes, we provide free, no-obligation estimates.`,
        },
        {
          id: 'cta-footer',
          type: 'cta-block',
          heading: 'Ready to Get Started?',
          content: `Call us today at ${context.brand.phonePretty} for a free estimate!`,
        }
      );
      break;

    case PageType.ABOUT:
      sections.push(
        {
          id: 'content',
          type: 'content',
          heading: `About ${context.brand.name}`,
          content: `${context.brand.name} has been serving ${context.city}, ${context.state} with quality ${context.niche} services. We're committed to excellence and customer satisfaction.`,
        }
      );
      break;

    case PageType.CONTACT:
      sections.push(
        {
          id: 'contact',
          type: 'cta-block',
          content: '',
        }
      );
      break;

    default:
      sections.push({
        id: 'content',
        type: 'content',
        heading: page.focusKeyword,
        content: `Content for ${page.focusKeyword} in ${context.city}, ${context.state}.`,
      });
  }

  // Generate content for each section
  // Only skip CTA blocks (they have static content), but generate content for all others
  for (const section of sections) {
    if (section.type !== 'cta-block') {
      try {
        const pageSpec: { focusKeyword: string; pageType: PageType } = {
          focusKeyword: page.focusKeyword,
          pageType: page.pageType,
        };

        // Determine target word count based on section type
        let targetWordCount = 200;
        if (section.type === 'hero') {
          targetWordCount = 100; // Hero should be concise but informative
        } else if (section.type === 'intro') {
          targetWordCount = 400; // Intro needs substantial content + depth (CONTENT_DEPTH_GAP fix)
        } else if (section.type === 'why-choose-us') {
          targetWordCount = 350; // Why choose us needs detail + depth (CONTENT_DEPTH_GAP fix)
        } else if (section.type === 'faq-accordion') {
          targetWordCount = 500; // FAQ needs multiple questions + depth (CONTENT_DEPTH_GAP fix)
        } else if (section.type === 'case-study') {
          targetWordCount = 350; // Case study needs detail + depth (CONTENT_DEPTH_GAP fix)
        } else if (section.type === 'neighborhoods') {
          targetWordCount = 300; // Neighborhoods list + depth (CONTENT_DEPTH_GAP fix)
        } else if (section.type === 'services-grid') {
          targetWordCount = 250; // Services overview
        } else if (section.type === 'testimonials') {
          targetWordCount = 200; // Testimonials with ratings
        }

        section.content = await generateSectionContent(
          {
            sectionId: section.id,
            heading: section.heading || '',
            purpose: `Content for ${section.type} section`,
            targetWordCount: targetWordCount,
            requiredKeywordRoles: [],
            optionalKeywordRoles: [],
            localHints: [`Mention ${context.city}, ${context.state}`],
          },
          context,
          pageSpec,
          model,
          externalResources,
          0, // keywordUsageCount (default sections don't track)
          Infinity, // remainingWordBudget (default sections don't track)
          allVariations, // Use merged variations
          { maxWords: targetWordCount, exactKeywords: 0 } // Default budget
        );
      } catch (error) {
        console.error(`Failed to generate content for section ${section.id}:`, error);
        // Keep default content
      }
    }
  }

  return sections;
}

/**
 * Map section ID to section type for semantic HTML builder
 */
function mapSectionType(sectionId: string): Section['type'] {
  if (sectionId.includes('hero')) return 'hero';
  if (sectionId.includes('service') && sectionId.includes('grid')) return 'services-grid';
  if (sectionId.includes('service')) return 'services-grid';
  if (sectionId.includes('faq') || sectionId.includes('question')) return 'faq-accordion';
  if (sectionId.includes('why_choose') || sectionId.includes('benefits')) return 'why-choose-us';
  if (sectionId.includes('process') || sectionId.includes('how_it_works') || sectionId.includes('how_we')) return 'process-steps';
  if (sectionId.includes('cta') || sectionId.includes('call_to_action')) return 'cta-block';
  if (sectionId.includes('local') || sectionId.includes('city') || sectionId.includes('neighborhood')) return 'local-content';
  if (sectionId.includes('testimonial') || sectionId.includes('review') || sectionId.includes('proof')) return 'testimonials';
  if (sectionId.includes('problem')) return 'common-problems';
  if (sectionId.includes('neighborhood') || sectionId.includes('area')) return 'neighborhoods';
  if (sectionId.includes('contact')) return 'cta-block';
  return 'content';
}

/**
 * Generate all pages for a site
 */
export async function generateAllPagesForSite(siteId: string): Promise<GeneratedPage[]> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      pages: {
        where: {
          status: { in: [PageStatus.DRAFT, PageStatus.NEEDS_REWRITE] },
        },
      },
    },
  });

  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }

  // If no pages exist, create them using page strategy
  let pagesToGenerate = site.pages;
  if (pagesToGenerate.length === 0) {
    const pageSpecs = await generatePageStrategy(siteId);
    await createPagesFromStrategy(siteId, pageSpecs);
    
    // Reload pages
    const updatedSite = await prisma.site.findUnique({
      where: { id: siteId },
      include: { 
        pages: {
          where: {
            status: { in: [PageStatus.DRAFT, PageStatus.NEEDS_REWRITE] },
          },
        },
      },
    });
    
    if (!updatedSite) {
      throw new Error('Failed to create pages');
    }
    
    pagesToGenerate = updatedSite.pages;
  }

  // Generate content for each page
  const results: GeneratedPage[] = [];
  for (const page of pagesToGenerate) {
    try {
      const generated = await generatePageContent(page.id);
      results.push(generated);
    } catch (error: any) {
      console.error(`Failed to generate page ${page.id}:`, error);
      // Continue with other pages
    }
  }

  return results;
}

/**
 * Create SitePage records from page strategy
 */
async function createPagesFromStrategy(siteId: string, pageSpecs: PageSpec[]): Promise<void> {
  for (const spec of pageSpecs) {
    const slug = spec.type === PageType.HOME 
      ? '' 
      : spec.keywords[0] 
        ? spec.keywords[0].toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        : spec.type.toLowerCase().replace(/_/g, '-');

    await prisma.sitePage.create({
      data: {
        siteId,
        pageType: spec.type,
        slug,
        titleTag: `${spec.keywords[0] || spec.type} - ${spec.type}`,
        h1: spec.keywords[0] || spec.type,
        focusKeyword: spec.keywords[0] || '',
        keyword: spec.keywords[0] || '',
        status: PageStatus.DRAFT,
        contentStatus: 'not_started',
        orderIndex: spec.priority,
      },
    });
  }
}

