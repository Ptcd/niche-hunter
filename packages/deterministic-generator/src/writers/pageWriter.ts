/**
 * Page writer - generates HTML for a single page using GPT
 */

import OpenAI from 'openai';
import { PagePayload } from '../types';
import { getWordCountTarget, getKeywordPlacementRule, getReviewRule, getLandmarkRule } from '../generationRules';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface PageWriterConfig {
  model: string;
  temperature: number;
  promptVersion: string;
}

/**
 * Build prompt for a page based on page type
 */
function buildPagePrompt(payload: PagePayload, config: PageWriterConfig): string {
  const { page_type, primary_keyword, semantic_keywords, business_name, cta_phone, state } = payload;
  const wordTarget = getWordCountTarget(page_type as any);
  const keywordRule = getKeywordPlacementRule(page_type as any);
  const reviewRule = getReviewRule(page_type as any);
  const landmarkRule = getLandmarkRule(page_type as any);

  let prompt = `You are writing a local service page for a real business website.

ABSOLUTE RULES:
- Output HTML only
- Use the provided business name: ${business_name}
- Do NOT invent credentials or licenses
- Do NOT claim office locations
- Do NOT mention pricing or guarantees
- Use ONLY the provided landmarks (do not invent)

CONTENT DEPTH:
- Target ${wordTarget.min}-${wordTarget.max} words
- Use proper heading hierarchy (H1, H2, H3)
- 2-3 paragraphs per section
- 80-120 words per paragraph

KEYWORDS:
- Primary keyword: "${primary_keyword || ''}"
  - Use exactly ${keywordRule.h1_count} time in H1
  - Use exactly ${keywordRule.first_100_words_count} time in first 100 words
  - Use ${keywordRule.body_min}-${keywordRule.body_max} additional times in body (max ${keywordRule.body_max} total)
- Use ${keywordRule.semantic_keywords_min}-${keywordRule.semantic_keywords_max} semantic keywords naturally: ${semantic_keywords?.join(', ') || 'N/A'}
- Mention city ${keywordRule.city_mentions_min}-${keywordRule.city_mentions_max} times
- Mention state ${keywordRule.state_mentions_min}-${keywordRule.state_mentions_max} times

`;

  // Add landmark rules if applicable
  if (landmarkRule && payload.real_landmarks && payload.real_landmarks.length > 0) {
    prompt += `LANDMARKS:
- Mention ${landmarkRule.count_min}-${landmarkRule.count_max} of these landmarks: ${payload.real_landmarks.join(', ')}
- Use safe phrasing only: ${landmarkRule.safe_phrases.join(', ')}
- DO NOT use: ${landmarkRule.forbidden_phrases.join(', ')}

`;
  }

  // Add review rules if applicable
  if (reviewRule) {
    prompt += `REVIEWS:
- Generate exactly ${reviewRule.count} reviews
- Format: "First Name L." (e.g., "Sarah M.")
- At least one review must include the primary keyword exactly once
- Do NOT include: ${reviewRule.forbidden_content.join(', ')}

`;
  }

  // Add placeholder instructions
  prompt += `INTERNAL LINKS:
- Insert exactly ${payload.can_link_to.length} placeholders: [[INTERNAL:/slug]]
- Choose from these allowed slugs: ${payload.can_link_to.join(', ')}

EXTERNAL LINKS:
- Insert exactly ${payload.external_link_placeholders.length} placeholder(s): ${payload.external_link_placeholders.join(', ')}

OUTPUT:
- Clean HTML only
- Proper heading hierarchy
- No commentary
- No markdown
- Include placeholders exactly as specified

`;

  // Page-type specific instructions
  if (page_type === 'home') {
    prompt += `REQUIRED STRUCTURE:
1. H1 — Primary keyword + business name
2. Introduction
3. Overview of Services
4. Why Choose Us
5. Services (list all service pages)
6. Areas We Serve (list all city pages)
7. Local Context (include landmarks if provided)
8. Customer Review (if required)
9. Call to Action (include phone: ${cta_phone})
`;
  } else if (page_type === 'service') {
    prompt += `REQUIRED STRUCTURE:
1. H1 — Primary keyword + business name
2. Introduction
3. About This Service
4. How the Process Works
5. Local Experience & Area Coverage (include landmarks if provided)
6. Customer Reviews (if required)
7. FAQs
8. Call to Action (include phone: ${cta_phone})
`;
  } else if (page_type === 'city') {
    prompt += `REQUIRED STRUCTURE:
1. H1 — Primary keyword + business name
2. Introduction
3. Why This Service Matters in This City
4. What to Expect
5. Local Area Context (include exactly 1 landmark)
6. Reviews (if required)
7. Call to Action (include phone: ${cta_phone})
`;
  } else if (page_type === 'blog_index') {
    prompt += `REQUIRED STRUCTURE:
1. H1 — Blog
2. Introduction paragraph
3. List of all blog posts (each as a link using [[INTERNAL:/blog/post-slug]])
4. Brief description of blog purpose
`;
  } else if (page_type === 'blog_post') {
    prompt += `REQUIRED STRUCTURE:
1. H1 — Post title (use primary keyword)
2. Introduction
3. Main content (3-5 paragraphs)
4. Conclusion
5. Call to Action (include phone: ${cta_phone})
6. Must include links to service page and contact page
`;
  }

  return prompt;
}

/**
 * Generate HTML for a single page
 */
export async function generatePageHtml(
  payload: PagePayload,
  config: PageWriterConfig
): Promise<string> {
  const prompt = buildPagePrompt(payload, config);

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert local SEO copywriter. Generate high-quality HTML content following exact specifications.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: config.temperature,
      max_tokens: 4000,
    });

    const html = response.choices[0]?.message?.content || '';
    
    if (!html) {
      throw new Error('No content generated from GPT');
    }

    return html;
  } catch (error: any) {
    throw new Error(`Failed to generate page content: ${error.message}`);
  }
}

