/**
 * GPT Content Generator
 * 
 * Generates full HTML content from content skeletons using OpenAI GPT.
 */

import OpenAI from 'openai';
import { prisma } from '@niche-hunter/db';
import { KeywordRole } from '../blueprints/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ContentGenerationContext {
  site: {
    niche: { name: string; slug: string };
    city: string;
    state: string;
    domain?: string | null;
    phoneNumber?: string | null;
  };
  page: {
    pageType: string;
    focusKeyword: string;
    supportingKeywords: string[];
    h1: string;
    titleTag: string;
  };
  skeletons: Array<{
    sectionId: string;
    heading: string;
    purpose: string;
    requiredKeywordRoles: KeywordRole[];
    optionalKeywordRoles: KeywordRole[];
    localHints: string[];
    styleVariant: string;
    minWords: number;
    maxWords: number;
  }>;
  keywordRoles: Map<KeywordRole, string[]>;
  writerConfig?: {
    systemPrompt?: string | null;
    tone?: string | null;
    styleRules?: string | null;
    brandVoice?: string | null;
    terminology?: string | null;
    thingsToAvoid?: string | null;
  };
}

/**
 * Build GPT prompt from content skeletons
 */
function buildContentPrompt(context: ContentGenerationContext): string {
  const { site, page, skeletons, keywordRoles, writerConfig } = context;

  let prompt = `You are a local SEO copywriter for ${site.niche.name} services in ${site.city}, ${site.state}.\n\n`;

  // Add writer config instructions
  if (writerConfig?.systemPrompt) {
    prompt += `${writerConfig.systemPrompt}\n\n`;
  }

  if (writerConfig?.tone) {
    prompt += `Tone: ${writerConfig.tone}\n`;
  }

  if (writerConfig?.styleRules) {
    prompt += `Style rules: ${writerConfig.styleRules}\n`;
  }

  if (writerConfig?.brandVoice) {
    prompt += `Brand voice: ${writerConfig.brandVoice}\n`;
  }

  if (writerConfig?.terminology) {
    prompt += `Preferred terminology: ${writerConfig.terminology}\n`;
  }

  if (writerConfig?.thingsToAvoid) {
    prompt += `Things to avoid: ${writerConfig.thingsToAvoid}\n\n`;
  }

  prompt += `Target audience: Homeowners and businesses needing ${site.niche.name} services.\n`;
  prompt += `Lead value: High - write to convert high-intent searchers.\n\n`;

  prompt += `Generate content for: ${page.titleTag}\n`;
  prompt += `H1: ${page.h1}\n`;
  prompt += `Focus keyword: ${page.focusKeyword}\n`;
  prompt += `Supporting keywords: ${page.supportingKeywords.join(', ')}\n\n`;

  prompt += `Sections to write:\n\n`;

  for (const skeleton of skeletons) {
    // Get actual keywords for required roles
    const requiredKeywords: string[] = [];
    for (const role of skeleton.requiredKeywordRoles) {
      const keywords = keywordRoles.get(role) || [];
      requiredKeywords.push(...keywords.slice(0, 3)); // Limit to 3 per role
    }

    const optionalKeywords: string[] = [];
    for (const role of skeleton.optionalKeywordRoles) {
      const keywords = keywordRoles.get(role) || [];
      optionalKeywords.push(...keywords.slice(0, 2));
    }

    prompt += `## ${skeleton.heading}\n`;
    prompt += `Purpose: ${skeleton.purpose}\n`;
    prompt += `Word count: ${skeleton.minWords}-${skeleton.maxWords} words\n`;
    
    if (requiredKeywords.length > 0) {
      prompt += `Required keywords (use naturally): ${requiredKeywords.join(', ')}\n`;
    }
    
    if (optionalKeywords.length > 0) {
      prompt += `Optional keywords: ${optionalKeywords.join(', ')}\n`;
    }
    
    if (skeleton.localHints.length > 0) {
      prompt += `Local context: ${skeleton.localHints.join('; ')}\n`;
    }
    
    prompt += `Style: ${skeleton.styleVariant}\n\n`;
  }

  prompt += `\nRequirements:\n`;
  prompt += `- Output clean HTML with proper heading hierarchy (H2 for section headings)\n`;
  prompt += `- Use keywords naturally - no keyword stuffing\n`;
  prompt += `- Include 2-3 internal links to other service pages (use descriptive anchor text)\n`;
  prompt += `- Include 1-4 external links to authoritative sources (government sites, universities, major publications)\n`;
  prompt += `- Write compelling CTAs that encourage phone calls\n`;
  prompt += `- Make content genuinely helpful and local\n`;
  prompt += `- Ensure each section meets the word count target\n\n`;

  prompt += `Output the complete HTML content for the entire page, with all sections combined.`;

  return prompt;
}

/**
 * Generate content for a page using GPT
 */
export async function generatePageContent(
  siteId: string,
  pageId: string
): Promise<string> {
  // Load site, page, skeletons, and writer config
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      niche: true,
      pages: {
        where: { id: pageId },
        include: {
          skeletons: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      },
    },
  });

  if (!site || site.pages.length === 0) {
    throw new Error('Site or page not found');
  }

  const page = site.pages[0];

  // Get writer config
  const writerConfig = await prisma.contentWriterConfig.findUnique({
    where: { nicheId: site.nicheId },
  });

  // Get keyword roles from batch keywords
  const batch = await prisma.scanBatch.findUnique({
    where: { id: site.batchId || '' },
    include: {
      keywords: {
        where: {
          isSkipped: false,
          city: {
            city: site.city,
            state: site.state,
          },
          keywordRole: { not: null },
        },
        include: {
          nicheKeyword: true,
        },
      },
    },
  });

  const keywordRoles = new Map<KeywordRole, string[]>();
  if (batch) {
    for (const kw of batch.keywords) {
      if (kw.keywordRole) {
        const role = kw.keywordRole as KeywordRole;
        if (!keywordRoles.has(role)) {
          keywordRoles.set(role, []);
        }
        keywordRoles.get(role)!.push(kw.nicheKeyword.keyword);
      }
    }
  }

  // Build prompt
  const context: ContentGenerationContext = {
    site: {
      niche: { name: site.niche.name, slug: site.niche.slug },
      city: site.city,
      state: site.state,
      domain: site.domain,
      phoneNumber: site.phoneNumber,
    },
    page: {
      pageType: page.pageType,
      focusKeyword: page.focusKeyword,
      supportingKeywords: page.supportingKeywords,
      h1: page.h1,
      titleTag: page.titleTag,
    },
    skeletons: page.skeletons.map(s => ({
      sectionId: s.sectionId,
      heading: s.heading,
      purpose: s.purpose,
      requiredKeywordRoles: s.requiredKeywordRoles as KeywordRole[],
      optionalKeywordRoles: s.optionalKeywordRoles as KeywordRole[],
      localHints: s.localHints,
      styleVariant: s.styleVariant || 'straight',
      minWords: s.minWords || s.targetWordCount,
      maxWords: s.maxWords || s.targetWordCount,
    })),
    keywordRoles,
    writerConfig: writerConfig ? {
      systemPrompt: writerConfig.systemPrompt,
      tone: writerConfig.tone,
      styleRules: writerConfig.styleRules,
      brandVoice: writerConfig.brandVoice,
      terminology: writerConfig.terminology,
      thingsToAvoid: writerConfig.thingsToAvoid,
    } : undefined,
  };

  const prompt = buildContentPrompt(context);

  // Call GPT
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert local SEO copywriter. Generate high-quality, conversion-focused HTML content.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    
    if (!content) {
      throw new Error('No content generated');
    }

    return content;
  } catch (error: any) {
    console.error('GPT generation error:', error);
    throw new Error(`Failed to generate content: ${error.message}`);
  }
}

