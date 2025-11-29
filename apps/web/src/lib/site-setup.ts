/**
 * Site Setup Helpers
 * 
 * Functions for setting up sites: page plan generation, skeleton creation, etc.
 */

import { prisma } from '@niche-hunter/db';
import { buildPagePlan, PagePlanRow } from './page-plan-builder';
import { 
  applyBlueprintToPage, 
  BlueprintContext,
  KeywordRole,
  classifyKeywords,
  extractKeywordRoles,
  KeywordForClassification,
} from '@niche-hunter/core';

/**
 * Map page type from page planner to blueprint page type
 */
function mapPageTypeToBlueprint(pageType: string): string {
  const mapping: { [key: string]: string } = {
    'Home': 'home',
    'Service': 'primary_service',
    'City': 'city_page',
    'Blog': 'blog_support',
    'About': 'about',
    'Contact': 'contact',
    'FAQ': 'faq_page',
  };
  
  return mapping[pageType] || 'primary_service';
}

/**
 * Generate page plan and create SitePage records
 */
export async function generateSitePages(
  siteId: string,
  batchId: string,
  city: string,
  state: string
): Promise<string[]> {
  // Fetch batch with keywords
  const batch = await prisma.scanBatch.findUnique({
    where: { id: batchId },
    include: {
      niche: true,
      keywords: {
        where: {
          isSkipped: false,
          city: {
            city,
            state,
          },
        },
        include: {
          city: true,
          nicheKeyword: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error('Batch not found');
  }

  // Get all niche keywords for the batch
  const nicheKeywords = await prisma.nicheKeyword.findMany({
    where: {
      nicheId: batch.nicheId,
      keywords: {
        some: {
          batchId,
          city: {
            city,
            state,
          },
        },
      },
    },
    include: {
      keywords: {
        where: {
          batchId,
          city: {
            city,
            state,
          },
          isSkipped: false,
        },
        include: {
          city: true,
          metrics: true,
        },
      },
    },
  });

  // Find center city ID
  const centerCity = await prisma.cityV5000.findFirst({
    where: {
      city,
      state,
    },
  });

  // Build page plan using existing function
  const pagePlan = await buildPagePlan(nicheKeywords, batch, centerCity?.id);

  // Create SitePage records
  const pageIds: string[] = [];
  let orderIndex = 0;

  for (const planRow of pagePlan) {
    const page = await prisma.sitePage.create({
      data: {
        siteId,
        pageType: mapPageTypeToBlueprint(planRow.pageType) as any,
        slug: planRow.urlSlug,
        titleTag: planRow.pageTitle,
        h1: planRow.h1,
        focusKeyword: planRow.focusKeyword,
        supportingKeywords: planRow.supportingKeywords
          ? planRow.supportingKeywords.split(',').map(k => k.trim())
          : [],
        searchIntent: planRow.searchIntent || null,
        internalLinks: planRow.internalLinks
          ? planRow.internalLinks.split(',').map(l => l.trim())
          : [],
        contentStatus: 'skeleton_ready',
        orderIndex,
      },
    });

    pageIds.push(page.id);
    orderIndex++;
  }

  return pageIds;
}

/**
 * Generate content skeletons for all pages in a site
 */
export async function generateContentSkeletons(siteId: string): Promise<void> {
  // First, get site to know city/state
  const siteBasic = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      city: true,
      state: true,
      nicheId: true,
      batchId: true,
    },
  });

  if (!siteBasic) {
    throw new Error('Site not found');
  }

  // Now load full site with batch keywords
  // Always include batch to avoid TypeScript conditional include issues
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      niche: true,
      pages: true,
      batch: siteBasic.batchId ? {
        include: {
          keywords: {
            where: {
              isSkipped: false,
              city: {
                city: siteBasic.city,
                state: siteBasic.state,
              },
            },
            include: {
              nicheKeyword: true,
              city: true,
            },
          },
        },
      } : undefined,
    },
  });

  if (!site) {
    throw new Error('Site not found');
  }

  // Classify keywords into roles (batch process)
  // Handle case where batch might be null
  const batchKeywords = (site.batch && 'keywords' in site.batch ? site.batch.keywords : []) as Array<{
    id: string;
    nicheKeyword: { keyword: string };
    localizedQuery: string;
    keywordType: string;
    city: { city: string; state: string };
    keywordRole?: string | null;
  }>;
  const keywordsForClassification: KeywordForClassification[] = batchKeywords.map((kw) => ({
    id: kw.id,
    keyword: kw.nicheKeyword.keyword,
    localizedQuery: kw.localizedQuery,
    keywordType: kw.keywordType,
    city: kw.city.city,
    state: kw.city.state,
  }));

  // Classify in batches of 50
  const batchSize = 50;
  const classifiedKeywords: { [keywordId: string]: KeywordRole | null } = {};

  for (let i = 0; i < keywordsForClassification.length; i += batchSize) {
    const batch = keywordsForClassification.slice(i, i + batchSize);
    const classified = await classifyKeywords(batch, site.niche.name, site.city, site.state);
    
    for (const result of classified) {
      classifiedKeywords[result.id] = result.role;
    }
  }

  // Update keyword roles in database
  for (const [keywordId, role] of Object.entries(classifiedKeywords)) {
    if (role) {
      await prisma.keywordV5000.update({
        where: { id: keywordId },
        data: { keywordRole: role },
      });
    }
  }

  // Extract keyword roles map
  const keywordRolesMap = new Map<KeywordRole, string[]>();
  for (const kw of batchKeywords) {
    if (kw.keywordRole) {
      const role = kw.keywordRole as KeywordRole;
      if (!keywordRolesMap.has(role)) {
        keywordRolesMap.set(role, []);
      }
      keywordRolesMap.get(role)!.push(kw.nicheKeyword.keyword);
    }
  }

  // Generate skeletons for each page
  for (const page of site.pages) {
    const context: BlueprintContext = {
      niche: site.niche.slug,
      city: site.city,
      state: site.state,
      focusKeyword: page.focusKeyword,
      brandName: site.siteName || `${site.city} Service`,
      supportingKeywords: page.supportingKeywords,
      keywordRoles: keywordRolesMap,
    };

    try {
      const skeletons = applyBlueprintToPage(
        site.niche.slug,
        page.pageType,
        context
      );

      // Create ContentSkeleton records
      for (const skeleton of skeletons) {
        await prisma.contentSkeleton.create({
          data: {
            sitePageId: page.id,
            sectionId: skeleton.sectionId,
            heading: skeleton.heading,
            purpose: skeleton.purpose,
            requiredKeywordRoles: skeleton.requiredKeywordRoles,
            optionalKeywordRoles: skeleton.optionalKeywordRoles,
            localHints: skeleton.localHints,
            styleVariant: skeleton.styleVariant,
            targetWordCount: skeleton.targetWordCount,
            minWords: skeleton.minWords,
            maxWords: skeleton.maxWords,
            orderIndex: skeleton.orderIndex,
          },
        });
      }
    } catch (error) {
      console.error(`Error generating skeletons for page ${page.id}:`, error);
      // Continue with other pages
    }
  }
}

/**
 * Build content skeletons for a single page
 * Used when regenerating existing pages that don't have skeletons
 */
export async function buildSkeletonsForPage(pageId: string): Promise<void> {
  // Load page with site data
  const page = await prisma.sitePage.findUnique({
    where: { id: pageId },
    include: {
      site: {
        include: {
          niche: true,
        },
        select: {
          id: true,
          siteName: true,
          city: true,
          state: true,
          niche: true,
          batchId: true,
        },
      },
    },
  });

  if (!page || !page.site) {
    throw new Error('Page or site not found');
  }

  const site = page.site;

  if (!site.batchId) {
    throw new Error('Site has no batch');
  }

  // Load batch keywords for this city
  const batchKeywords = await prisma.keywordV5000.findMany({
    where: {
      batchId: site.batchId,
      isSkipped: false,
      city: {
        city: site.city,
        state: site.state,
      },
    },
    include: {
      nicheKeyword: true,
      city: true,
    },
  });

  // Classify keywords into roles
  const keywordsForClassification: KeywordForClassification[] = batchKeywords.map((kw) => ({
    id: kw.id,
    keyword: kw.nicheKeyword.keyword,
    localizedQuery: kw.localizedQuery || kw.nicheKeyword.keyword,
    keywordType: kw.keywordType,
    city: kw.city.city,
    state: kw.city.state,
  }));

  // Classify in batches of 50
  const batchSize = 50;
  const classifiedKeywords: { [keywordId: string]: KeywordRole | null } = {};

  for (let i = 0; i < keywordsForClassification.length; i += batchSize) {
    const batch = keywordsForClassification.slice(i, i + batchSize);
    const classified = await classifyKeywords(batch, site.niche.name, site.city, site.state);
    
    for (const result of classified) {
      classifiedKeywords[result.id] = result.role;
    }
  }

  // Extract keyword roles map
  const keywordRolesMap = new Map<KeywordRole, string[]>();
  for (const kw of batchKeywords) {
    const role = (kw.keywordRole || classifiedKeywords[kw.id]) as KeywordRole | null;
    if (role) {
      if (!keywordRolesMap.has(role)) {
        keywordRolesMap.set(role, []);
      }
      keywordRolesMap.get(role)!.push(kw.nicheKeyword.keyword);
    }
  }

  // Map PageType enum to blueprint page type
  const blueprintPageType = mapPageTypeToBlueprintType(page.pageType);

  // Build blueprint context
  const context: BlueprintContext = {
    niche: site.niche.slug,
    city: site.city,
    state: site.state,
    focusKeyword: page.focusKeyword || '',
    brandName: site.siteName || `${site.city} Service`,
    supportingKeywords: page.supportingKeywords || [],
    keywordRoles: keywordRolesMap,
  };

  // Delete existing skeletons for this page
  await prisma.contentSkeleton.deleteMany({
    where: { sitePageId: pageId },
  });

  // Apply blueprint and create skeletons
  const skeletons = applyBlueprintToPage(
    site.niche.slug,
    blueprintPageType,
    context
  );

  // Create ContentSkeleton records
  for (const skeleton of skeletons) {
    await prisma.contentSkeleton.create({
      data: {
        sitePageId: pageId,
        sectionId: skeleton.sectionId,
        heading: skeleton.heading,
        purpose: skeleton.purpose,
        requiredKeywordRoles: skeleton.requiredKeywordRoles,
        optionalKeywordRoles: skeleton.optionalKeywordRoles,
        localHints: skeleton.localHints,
        styleVariant: skeleton.styleVariant,
        targetWordCount: skeleton.targetWordCount,
        minWords: skeleton.minWords,
        maxWords: skeleton.maxWords,
        orderIndex: skeleton.orderIndex,
      },
    });
  }
}

/**
 * Map PageType enum to blueprint page type string
 */
function mapPageTypeToBlueprintType(pageType: string): string {
  const mapping: { [key: string]: string } = {
    'HOME': 'home',
    'CORE_SERVICE': 'primary_service',
    'PRIMARY_SERVICE': 'primary_service',
    'CITY': 'city_page',
    'SUPPORT': 'primary_service', // Support pages use service blueprint
    'ABOUT': 'about',
    'CONTACT': 'contact',
    'LEGAL': 'legal',
  };
  
  return mapping[pageType] || 'primary_service';
}

