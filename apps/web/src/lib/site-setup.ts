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
  const keywordsForClassification: KeywordForClassification[] = (site.batch?.keywords || []).map(kw => ({
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
  for (const kw of site.batch?.keywords || []) {
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

