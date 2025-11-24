/**
 * Content Generator Module
 * 
 * Generates page content section-by-section using gpt-4o and existing data.
 * Uses ContentSkeleton templates and PromptProfile for tone/style.
 */

import OpenAI from 'openai';
import { prisma } from '@niche-hunter/db';
import { PageType, PageStatus } from '@prisma/client';
import { buildBrandSpec } from '../../lib/brandBuilder';
import { buildPageHtml, Section } from './htmlTemplates';
import { generatePageStrategy, PageSpec } from './pageStrategy';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
export async function generatePageContent(pageId: string): Promise<GeneratedPage> {
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

  // Generate sections based on ContentSkeleton
  const sections: Section[] = [];
  
  if (page.skeletons.length > 0) {
    // Use existing skeletons
    for (const skeleton of page.skeletons) {
      const sectionContent = await generateSectionContent(skeleton, context, page);
      sections.push({
        id: skeleton.sectionId,
        type: mapSectionType(skeleton.sectionId),
        heading: skeleton.heading,
        content: sectionContent,
        metadata: {
          targetWordCount: skeleton.targetWordCount,
          styleVariant: skeleton.styleVariant,
        },
      });
    }
  } else {
    // Fallback: generate default sections based on page type
    sections.push(...await generateDefaultSections(page.pageType, context, page));
  }

  // Build HTML
  const html = buildPageHtml(
    sections,
    brand,
    page.titleTag || page.h1,
    page.seoDescription || undefined
  );

  // Calculate word count
  const wordCount = html.split(/\s+/).length;

  return {
    pageId: page.id,
    sections,
    html,
    wordCount,
  };
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
  page: { focusKeyword: string; pageType: PageType }
): Promise<string> {
  const systemPrompt = context.promptProfile?.systemPrompt || `
You are an expert local SEO copywriter for home-service businesses.
Write engaging, conversion-focused content that builds trust and drives action.
Always write in clear, friendly, professional US English.
`;

  const styleGuidelines = context.promptProfile?.styleGuidelines || `
- Tone: confident, friendly, professional
- No pricing or dollar amounts unless specifically requested
- Emphasize trust, reliability, and local expertise
- Mention licensing & insurance when appropriate
- Use the business name naturally throughout
- Include local references (city, state, neighborhoods)
`;

  const userPrompt = `
Write content for a ${page.pageType} page section.

Section Details:
- Heading: ${skeleton.heading}
- Purpose: ${skeleton.purpose}
- Target word count: ${skeleton.targetWordCount} words
${skeleton.styleVariant ? `- Style variant: ${skeleton.styleVariant}` : ''}

Business Context:
- Business Name: ${context.brand.name}
- Location: ${context.city}, ${context.state}
- Phone: ${context.brand.phonePretty}
- Email: ${context.brand.email}
- Primary Keyword: ${page.focusKeyword}

${skeleton.localHints.length > 0 ? `Local Hints:\n${skeleton.localHints.map(h => `- ${h}`).join('\n')}` : ''}

Style Guidelines:
${styleGuidelines}

Requirements:
- Use the primary keyword "${page.focusKeyword}" naturally 2-3 times
- Include local references to ${context.city}, ${context.state}
- Write exactly ${skeleton.targetWordCount} words (within 10% tolerance)
- Make it engaging and conversion-focused
- Use proper HTML formatting (paragraphs, lists, headings)

Output ONLY the content text (no markdown, no code blocks, just the content).
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: Math.ceil(skeleton.targetWordCount * 1.5), // Rough estimate
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt.trim() },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('GPT returned empty content');
    }

    return content.trim();
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
  page: { focusKeyword: string }
): Promise<Section[]> {
  const sections: Section[] = [];

  switch (pageType) {
    case PageType.HOME:
      sections.push(
        {
          id: 'hero',
          type: 'hero',
          heading: `${context.brand.name} - ${context.city}, ${context.state}`,
          content: `Professional ${context.niche} services in ${context.city}, ${context.state}. Trusted by homeowners for quality work and exceptional service.`,
        },
        {
          id: 'services',
          type: 'services',
          heading: 'Our Services',
          content: `Expert ${context.niche} services\nProfessional installation\nEmergency repairs\nMaintenance plans\nQuality guarantees`,
        },
        {
          id: 'trust',
          type: 'trust',
          content: '',
        },
        {
          id: 'faq',
          type: 'faq',
          heading: 'Frequently Asked Questions',
          content: `Q: What areas do you serve?\nA: We proudly serve ${context.city}, ${context.state} and surrounding areas.\n\nQ: Are you licensed and insured?\nA: Yes, we are fully licensed and insured for your protection.\n\nQ: Do you offer emergency services?\nA: Yes, we provide 24/7 emergency ${context.niche} services.`,
        }
      );
      break;

    case PageType.CORE_SERVICE:
      sections.push(
        {
          id: 'hero',
          type: 'hero',
          heading: `${page.focusKeyword} in ${context.city}, ${context.state}`,
          content: `Expert ${page.focusKeyword} services for ${context.city} homeowners. Professional, reliable, and affordable.`,
        },
        {
          id: 'content',
          type: 'content',
          heading: `Why Choose Us for ${page.focusKeyword}`,
          content: `We specialize in ${page.focusKeyword} services throughout ${context.city}, ${context.state}. Our experienced team delivers quality results you can trust.`,
        },
        {
          id: 'trust',
          type: 'trust',
          content: '',
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
          type: 'contact',
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
  for (const section of sections) {
    if (section.type !== 'trust' && section.type !== 'contact' && section.type !== 'footer') {
      try {
        const pageSpec: { focusKeyword: string; pageType: PageType } = {
          focusKeyword: page.focusKeyword,
          pageType: page.pageType,
        };
        section.content = await generateSectionContent(
          {
            sectionId: section.id,
            heading: section.heading || '',
            purpose: `Content for ${section.type} section`,
            targetWordCount: 200,
            requiredKeywordRoles: [],
            optionalKeywordRoles: [],
            localHints: [`Mention ${context.city}, ${context.state}`],
          },
          context,
          pageSpec
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
 * Map section ID to section type
 */
function mapSectionType(sectionId: string): Section['type'] {
  if (sectionId.includes('hero')) return 'hero';
  if (sectionId.includes('service')) return 'services';
  if (sectionId.includes('faq') || sectionId.includes('question')) return 'faq';
  if (sectionId.includes('trust') || sectionId.includes('badge')) return 'trust';
  if (sectionId.includes('contact')) return 'contact';
  if (sectionId.includes('footer')) return 'footer';
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

