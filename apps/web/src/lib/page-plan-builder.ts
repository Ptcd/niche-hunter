/**
 * Page Plan Builder
 * 
 * Generates a comprehensive page plan for building a local SEO website
 * based on discovered keywords. Creates actionable blueprints for VAs.
 */

import { prisma } from '@niche-hunter/db';
import { classifyKeywordWithScope } from './keyword-classifier';
import { deriveClusterKey } from './cluster-mappings';
import { getInternalLinksForPage } from './internal-link-generator';
import { findNearbyCities, getPrimaryCityFromBatch } from './geo-utils';

// Types
export interface KeywordRow {
  keyword: string;
  volume: number;
  type: 'money' | 'supporting' | 'informational' | 'brand' | 'local' | 'other';
  scope: 'local' | 'national';
  suggestedPageType: string;
  city?: string;
  state?: string;
}

export interface PagePlanRow {
  pageType: 'Home' | 'Service' | 'City' | 'Blog' | 'FAQ' | 'About' | 'Contact';
  pageTitle: string;
  h1: string;
  urlSlug: string;
  focusKeyword: string;
  supportingKeywords: string; // comma-separated
  searchIntent: string;
  contentLength: string;
  schemaType: string;
  internalLinks: string;
  notes: string;
  clusterKey: string; // NEW - for internal linking
}

// Type for Prisma NicheKeyword with includes
type NicheKeywordWithIncludes = {
  id: string;
  keyword: string;
  nationalVolume: number | null;
  nationalKd: number | null;
  keywordType: string | null;
  scope: string | null;
  keywords: Array<{
    city: {
      city: string;
      state: string;
    };
    metrics: {
      searchVolume: number | null;
    } | null;
  }>;
};

type BatchWithNiche = {
  id: string;
  niche: {
    name: string;
  };
};

// Helper: Title case converter
function titleCase(str: string): string {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

// Helper: Slugify
function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper: Extract service root from keyword
function extractServiceRoot(keyword: string): string {
  // Remove location modifiers and quality modifiers
  let clean = keyword.toLowerCase()
    .replace(/\b(near me|nearby|local|in [a-z]+|best|top|rated|emergency|24\/7|same day|cheap|affordable|professional|licensed|certified)\b/g, '')
    .trim();
  
  // Take first 2-3 words as service root
  const words = clean.split(/\s+/).filter(w => w.length > 2);
  return words.slice(0, 2).join(' ');
}

// Helper: Assign unique slug
function assignUniqueSlug(baseSlug: string, existingSlugs: Set<string>): string {
  let slug = baseSlug;
  let counter = 2;
  
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  existingSlugs.add(slug);
  return slug;
}

// Helper: Get blog content length (smart classification)
function getBlogContentLength(keyword: string): string {
  const lower = keyword.toLowerCase();
  
  // Short Q&A format
  if (lower.match(/^(how much|what is|can|should|will|does)\s/i)) {
    return '800-1200 words (FAQ/quick answer format)';
  }
  
  // Comprehensive guides
  if (lower.match(/guide|complete|ultimate|everything|step by step/i)) {
    return '2000-3000 words (in-depth guide)';
  }
  
  // Default: standard blog
  return '1200-1800 words (standard blog depth)';
}

// Helper: Get service schema type
function getServiceSchema(serviceRoot: string): string {
  const lower = serviceRoot.toLowerCase();
  
  // HVAC/AC services
  if (lower.match(/\b(hvac|ac|air conditioner|heating|cooling|furnace)\b/)) {
    return 'HVACBusiness';
  }
  
  // Plumbing
  if (lower.match(/\b(plumb|pipe|drain|sewer|water heater)\b/)) {
    return 'Plumber';
  }
  
  // Roofing
  if (lower.match(/\b(roof|gutter|siding)\b/)) {
    return 'RoofingContractor';
  }
  
  // Electrical
  if (lower.match(/\b(electric|electrical|wiring|panel)\b/)) {
    return 'Electrician';
  }
  
  // Generic
  return 'LocalBusiness + Service';
}

// Normalize keyword row from database
function normalizeKeywordRow(nk: NicheKeywordWithIncludes, batch: BatchWithNiche): KeywordRow[] {
  const classification = classifyKeywordWithScope(nk.keyword);
  const type = (nk.keywordType || 'other') as KeywordRow['type'];
  const scope = (nk.scope || 'local') as 'local' | 'national';
  
  // If keyword has city data, create one row per city (local)
  if (nk.keywords.length > 0) {
    return nk.keywords.map(kw => {
      // Use ONLY local metrics for local keywords, never fall back to national volume
      const volume = kw.metrics?.searchVolume || 0;
      return {
        keyword: nk.keyword,
        volume,
        type,
        scope: 'local' as const,
        suggestedPageType: classification.suggestedPageType,
        city: kw.city.city,
        state: kw.city.state,
      };
    });
  }
  
  // For national keywords (no city data), single row
  return [{
    keyword: nk.keyword,
    volume: nk.nationalVolume || 0,
    type,
    scope: 'national' as const,
    suggestedPageType: classification.suggestedPageType,
  }];
}

// Cluster keywords by service root
function clusterByServiceRoot(keywords: KeywordRow[]): Map<string, KeywordRow[]> {
  const clusters = new Map<string, KeywordRow[]>();
  
  for (const kw of keywords) {
    if (kw.type !== 'money' && kw.type !== 'supporting') continue;
    
    const root = extractServiceRoot(kw.keyword);
    if (!root || root.length < 3) continue;
    
    if (!clusters.has(root)) {
      clusters.set(root, []);
    }
    clusters.get(root)!.push(kw);
  }
  
  return clusters;
}

// Build core pages (Home, About, Contact, FAQ)
function buildCorePages(
  nicheName: string,
  topMoneyKeywords: KeywordRow[],
  cities: Array<{ city: string; state: string }>
): PagePlanRow[] {
  const pages: PagePlanRow[] = [];
  const existingSlugs = new Set<string>();
  
  // Home page
  const homeSlug = assignUniqueSlug('home', existingSlugs);
  const top3Money = topMoneyKeywords.slice(0, 3);
  pages.push({
    pageType: 'Home',
    pageTitle: `${titleCase(nicheName)} Services ${cities.length > 0 ? `in ${cities[0].city}, ${cities[0].state}` : ''} | Expert ${titleCase(nicheName)}`,
    h1: `Professional ${titleCase(nicheName)} Services ${cities.length > 0 ? `in ${cities[0].city}, ${cities[0].state}` : ''}`,
    urlSlug: homeSlug,
    focusKeyword: top3Money[0]?.keyword || nicheName.toLowerCase(),
    supportingKeywords: top3Money.slice(1).map(k => k.keyword).join(', '),
    searchIntent: 'Commercial',
    contentLength: '1500-2000 words',
    schemaType: 'LocalBusiness',
    internalLinks: 'About, Contact, Services',
    notes: 'Homepage with service overview, service areas, and CTA',
    clusterKey: 'home',
  });
  
  // About page
  const aboutSlug = assignUniqueSlug('about', existingSlugs);
  pages.push({
    pageType: 'About',
    pageTitle: `About Our ${titleCase(nicheName)} Company ${cities.length > 0 ? `in ${cities[0].city}, ${cities[0].state}` : ''}`,
    h1: `About Our ${titleCase(nicheName)} Company`,
    urlSlug: aboutSlug,
    focusKeyword: `about ${nicheName.toLowerCase()}`,
    supportingKeywords: `${nicheName.toLowerCase()} company, ${nicheName.toLowerCase()} professionals`,
    searchIntent: 'Informational',
    contentLength: '800-1200 words',
    schemaType: 'AboutPage',
    internalLinks: 'Home, Contact, Services',
    notes: 'Company history, credentials, team overview',
    clusterKey: 'general',
  });
  
  // Contact page
  const contactSlug = assignUniqueSlug('contact', existingSlugs);
  pages.push({
    pageType: 'Contact',
    pageTitle: `Contact Us | ${titleCase(nicheName)} Services ${cities.length > 0 ? `${cities[0].city}, ${cities[0].state}` : ''}`,
    h1: `Contact Our ${titleCase(nicheName)} Team`,
    urlSlug: contactSlug,
    focusKeyword: `contact ${nicheName.toLowerCase()}`,
    supportingKeywords: `${nicheName.toLowerCase()} phone, ${nicheName.toLowerCase()} address`,
    searchIntent: 'Commercial',
    contentLength: '400-600 words',
    schemaType: 'ContactPage',
    internalLinks: 'Home, About, Services',
    notes: 'Contact form, address, phone, hours, service areas map',
    clusterKey: 'general',
  });
  
  return pages;
}

// Build service pages from national keywords
function buildServicePages(
  nationalKeywords: KeywordRow[],
  nicheName: string,
  existingSlugs: Set<string>
): PagePlanRow[] {
  const pages: PagePlanRow[] = [];
  
  // Filter to money/supporting keywords with volume >= 10
  const serviceKeywords = nationalKeywords.filter(
    kw => (kw.type === 'money' || kw.type === 'supporting') && kw.volume >= 10
  );
  
  // Cluster by service root
  const clusters = clusterByServiceRoot(serviceKeywords);
  
  // Sort clusters by total volume
  const sortedClusters = Array.from(clusters.entries()).sort((a, b) => {
    const volA = a[1].reduce((sum, kw) => sum + kw.volume, 0);
    const volB = b[1].reduce((sum, kw) => sum + kw.volume, 0);
    return volB - volA;
  });
  
  // Create one page per service root
  for (const [serviceRoot, keywords] of sortedClusters) {
    // Sort keywords in cluster by volume
    const sorted = [...keywords].sort((a, b) => b.volume - a.volume);
    const focus = sorted[0];
    const supporting = sorted.slice(1, 6).map(k => k.keyword);
    
    const baseSlug = slugify(serviceRoot);
    const slug = assignUniqueSlug(baseSlug, existingSlugs);
    
    pages.push({
      pageType: 'Service',
      pageTitle: `${titleCase(focus.keyword)} | ${titleCase(nicheName)} Services`,
      h1: titleCase(focus.keyword),
      urlSlug: slug,
      focusKeyword: focus.keyword,
      supportingKeywords: supporting.join(', '),
      searchIntent: focus.type === 'money' ? 'Commercial' : 'Commercial/Research',
      contentLength: '1200-1800 words',
      schemaType: getServiceSchema(serviceRoot),
      internalLinks: 'Home, Contact, City pages',
      notes: `Service page for ${serviceRoot}. Include service details, pricing info, process, FAQs`,
      clusterKey: deriveClusterKey(focus.keyword, 'Service'),
    });
  }
  
  return pages;
}

// Build city page
// Prioritizes city-specific keywords if available, falls back to focus city keywords
function buildCityPage(
  localKeywords: KeywordRow[],
  city: string,
  state: string,
  nicheName: string,
  existingSlugs: Set<string>
): PagePlanRow | null {
  // Try to use city-specific money keywords with volume > 0
  // Filter for REASONABLE local volumes (10-10000 range) to avoid corrupted national data
  const citySpecificKeywords = localKeywords
    .filter(kw => 
      kw.city === city && 
      kw.state === state && 
      kw.type === 'money' && 
      kw.scope === 'local' &&
      kw.volume >= 10 &&
      kw.volume <= 10000  // Local keywords rarely exceed 10K
    )
    .sort((a, b) => b.volume - a.volume);
  
  // Fallback: use local money keywords from ANY city with reasonable volume
  // This ensures we use real local data, not corrupted national volumes
  const fallbackKeywords = localKeywords
    .filter(kw => 
      kw.city !== undefined &&  // Must have city data
      kw.type === 'money' && 
      kw.scope === 'local' &&
      kw.volume >= 10 &&
      kw.volume <= 10000  // Safety: local volume cap
    )
    .sort((a, b) => b.volume - a.volume);
  
  const keywords = citySpecificKeywords.length > 0 ? citySpecificKeywords : fallbackKeywords;
  
  console.log(`      📊 City-specific keywords: ${citySpecificKeywords.length}, Fallback keywords: ${fallbackKeywords.length}`);
  if (citySpecificKeywords.length > 0) {
    console.log(`      Top 3 city-specific: ${citySpecificKeywords.slice(0, 3).map(k => `${k.keyword} (${k.volume})`).join(', ')}`);
  }
  if (fallbackKeywords.length > 0 && citySpecificKeywords.length === 0) {
    console.log(`      Top 3 fallback: ${fallbackKeywords.slice(0, 3).map(k => `${k.keyword} (${k.volume})`).join(', ')}`);
  }
  
  if (keywords.length === 0) {
    console.log(`      ⚠️ No money keywords with volume found for ${city}, ${state}`);
    return null;
  }
  
  const focus = keywords[0];
  const supporting = keywords.slice(1, 6).map(k => k.keyword);
  
  console.log(`      ✅ Selected focus keyword: "${focus.keyword}" (volume: ${focus.volume}, scope: ${focus.scope})`);
  
  const baseSlug = slugify(`${nicheName}-${city}-${state}`);
  const slug = assignUniqueSlug(baseSlug, existingSlugs);
  
  const usingFallback = citySpecificKeywords.length === 0;
  
  return {
    pageType: 'City',
    pageTitle: `${titleCase(nicheName)} Services in ${city}, ${state} | Local ${titleCase(nicheName)}`,
    h1: `${titleCase(nicheName)} Services in ${city}, ${state}`,
    urlSlug: slug,
    focusKeyword: focus.keyword,
    supportingKeywords: supporting.join(', '),
    searchIntent: 'Commercial',
    contentLength: '1500-2000 words',
    schemaType: 'LocalBusiness + Service',
    internalLinks: 'Home, Services, Contact',
    notes: `City-specific landing page${usingFallback ? ' (using focus city keywords - nearby market)' : ''}. Include local service areas, local testimonials, city-specific content.`,
    clusterKey: 'city',
  };
}

// Build blog pages from informational keywords
function buildBlogPages(
  informationalKeywords: KeywordRow[],
  existingSlugs: Set<string>
): PagePlanRow[] {
  const pages: PagePlanRow[] = [];
  
  // Filter to informational keywords with volume >= 10
  const blogKeywords = informationalKeywords
    .filter(kw => kw.type === 'informational' && kw.volume >= 10)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8); // Limit to top 8 to keep site manageable
  
  for (const kw of blogKeywords) {
    const baseSlug = slugify(kw.keyword);
    const slug = assignUniqueSlug(baseSlug, existingSlugs);
    
    const isFAQ = /\b(can|should|will|does|do|why|when|where|what|how)\b/i.test(kw.keyword);
    const schemaType = isFAQ ? 'FAQPage' : 'Article';
    
    pages.push({
      pageType: 'Blog',
      pageTitle: `${titleCase(kw.keyword)} | Guide & Tips`,
      h1: titleCase(kw.keyword),
      urlSlug: slug,
      focusKeyword: kw.keyword,
      supportingKeywords: '',
      searchIntent: 'Informational',
      contentLength: getBlogContentLength(kw.keyword),
      schemaType,
      internalLinks: 'Home, Related service pages',
      notes: isFAQ 
        ? 'Format as Q&A. Answer the question directly, then provide supporting details'
        : 'Educational content. Include step-by-step instructions, tips, best practices',
      clusterKey: deriveClusterKey(kw.keyword, 'Blog'),
    });
  }
  
  return pages;
}

// Main orchestrator: Build complete page plan
export async function buildPagePlan(
  allKeywords: NicheKeywordWithIncludes[],
  batch: BatchWithNiche,
  centerCityId?: string // Optional: specific city ID to use as center (for city-specific downloads)
): Promise<PagePlanRow[]> {
  const pages: PagePlanRow[] = [];
  const existingSlugs = new Set<string>();
  
  // Normalize all keywords to KeywordRow format
  const keywordRows: KeywordRow[] = [];
  for (const nk of allKeywords) {
    keywordRows.push(...normalizeKeywordRow(nk, batch));
  }
  
  // Separate by scope
  const localKeywords = keywordRows.filter(kw => kw.scope === 'local');
  const nationalKeywords = keywordRows.filter(kw => kw.scope === 'national');
  
  // Get center city (either provided centerCityId or primary city from batch)
  let centerCity: { id: string; city: string; state: string; latitude: number | null; longitude: number | null } | null = null;
  
  if (centerCityId) {
    // Use the provided city ID (for city-specific downloads)
    const city = await prisma.cityV5000.findUnique({
      where: { id: centerCityId },
    });
    if (city) {
      centerCity = {
        id: city.id,
        city: city.city,
        state: city.state,
        latitude: city.latitude,
        longitude: city.longitude,
      };
      console.log(`📍 [PAGE-PLAN] Using provided center city: ${city.city}, ${city.state} (ID: ${centerCityId})`);
    } else {
      console.warn(`⚠️ [PAGE-PLAN] Provided centerCityId ${centerCityId} not found, falling back to primary city`);
    }
  }
  
  // Fallback to primary city from batch if no centerCityId or city not found
  if (!centerCity) {
    centerCity = await getPrimaryCityFromBatch(batch.id);
    if (centerCity) {
      console.log(`📍 [PAGE-PLAN] Using primary city from batch: ${centerCity.city}, ${centerCity.state}`);
    }
  }
  
  let cities: Array<{ city: string; state: string }> = [];
  
  if (centerCity && centerCity.latitude && centerCity.longitude) {
    // Use geographic proximity to find nearby cities (get more candidates for prioritization)
    console.log(`🔍 [PAGE-PLAN] Finding nearby cities within 30 miles of ${centerCity.city}, ${centerCity.state}...`);
    const nearbyCities = await findNearbyCities(centerCity.id, 30, 5000, 20); // Get 20 candidates
    console.log(`✅ [PAGE-PLAN] Found ${nearbyCities.length} nearby cities: ${nearbyCities.map(c => `${c.city}, ${c.state}`).join(', ')}`);
    
    // Calculate search volume for each city
    const citiesWithVolume = nearbyCities.map(nearbyCity => {
      const cityKeywords = localKeywords.filter(kw => 
        kw.city === nearbyCity.city && 
        kw.state === nearbyCity.state && 
        kw.type === 'money' && 
        kw.volume > 0
      );
      const totalVolume = cityKeywords.reduce((sum, kw) => sum + kw.volume, 0);
      return {
        city: nearbyCity.city,
        state: nearbyCity.state,
        distance: nearbyCity.distance,
        totalVolume,
        hasKeywords: cityKeywords.length > 0,
      };
    });

    // Prioritize cities with real search volume data
    const citiesWithData = citiesWithVolume
      .filter(c => c.totalVolume > 0)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 8); // Top 8 with volume

    console.log(`📊 [PAGE-PLAN] Found ${citiesWithData.length} nearby cities with search volume data`);
    if (citiesWithData.length > 0) {
      console.log(`   Top cities: ${citiesWithData.slice(0, 3).map(c => `${c.city}, ${c.state} (${c.totalVolume} vol)`).join(', ')}`);
    }

    // If we have < 6 cities with data, fill with closest cities (using focus city's keywords)
    if (citiesWithData.length < 6) {
      const fillCount = Math.min(6 - citiesWithData.length, citiesWithVolume.length - citiesWithData.length);
      const fillCities = citiesWithVolume
        .filter(c => c.totalVolume === 0)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, fillCount);
      
      citiesWithData.push(...fillCities);
      console.log(`   📍 [PAGE-PLAN] Added ${fillCities.length} nearby cities without volume data (will use focus city keywords)`);
    }

    // Include center city first, then nearby cities
    cities = [
      { city: centerCity.city, state: centerCity.state },
      ...citiesWithData.map(c => ({ city: c.city, state: c.state })),
    ];
  } else {
    // Fallback: use all cities from local keywords if no coordinates
    console.warn('⚠️ [PAGE-PLAN] Center city missing coordinates, using all cities from batch');
    cities = Array.from(
      new Set(localKeywords.map(kw => `${kw.city}|${kw.state}`).filter(Boolean))
    ).map(cityState => {
      const [city, state] = cityState.split('|');
      return { city, state };
    });
  }
  
  console.log(`📋 [PAGE-PLAN] Total cities for page plan: ${cities.length} (${cities.map(c => `${c.city}, ${c.state}`).join(', ')})`);
  
  // Get focus city's money keywords (for homepage and as fallback for nearby cities)
  const focusCityMoneyKeywords = localKeywords
    .filter(kw => kw.type === 'money' && kw.volume > 0)
    .sort((a, b) => b.volume - a.volume);
  
  // Get all money keywords for homepage
  const allMoneyKeywords = [...localKeywords, ...nationalKeywords]
    .filter(kw => kw.type === 'money')
    .sort((a, b) => b.volume - a.volume);
  
  // Build core pages
  pages.push(...buildCorePages(batch.niche.name, allMoneyKeywords, cities));
  
  // Build service pages (from national keywords)
  pages.push(...buildServicePages(nationalKeywords, batch.niche.name, existingSlugs));
  
  // Build city pages (one per nearby city)
  console.log(`🏙️ [PAGE-PLAN] Building city pages for ${cities.length} cities...`);
  console.log(`📊 [PAGE-PLAN] Local keywords available: ${localKeywords.length} (money: ${localKeywords.filter(kw => kw.type === 'money').length})`);
  
  for (const { city, state } of cities) {
    console.log(`   🔨 Building city page for ${city}, ${state}...`);
    const cityPage = buildCityPage(localKeywords, city, state, batch.niche.name, existingSlugs);
    if (cityPage) {
      console.log(`   ✅ Created city page for ${city}, ${state} (slug: ${cityPage.urlSlug})`);
      pages.push(cityPage);
    } else {
      console.log(`   ❌ Failed to create city page for ${city}, ${state} (no money keywords?)`);
    }
  }
  
  console.log(`✅ [PAGE-PLAN] Total city pages created: ${pages.filter(p => p.pageType === 'City').length}`);
  
  // Build blog pages (from informational keywords)
  const allInformational = [...localKeywords, ...nationalKeywords]
    .filter(kw => kw.type === 'informational');
  pages.push(...buildBlogPages(allInformational, existingSlugs));
  
  // Add cluster keys to all pages
  for (const page of pages) {
    page.clusterKey = deriveClusterKey(page.focusKeyword, page.pageType);
  }
  
  // Generate internal links for all pages
  for (const page of pages) {
    const links = getInternalLinksForPage(page, pages);
    page.internalLinks = links.join(', ');
  }
  
  return pages;
}

