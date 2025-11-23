/**
 * GPT Page Generator
 * 
 * Uses OpenAI to generate PageSpec arrays for niche + location combinations.
 * Supports Site Factory workflow with PromptProfile integration.
 */

import OpenAI from "openai";
import type { PageSpec, BrandSpec } from "./wpFactoryTypes";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type GenerateParams = {
  siteId: string;
  niche: string;        // e.g. "hvac"
  city: string;        // "Wesley Chapel"
  state: string;       // "FL"
  keywords?: string[]; // optional list of money keywords
  brand: BrandSpec;
  promptProfile?: {
    systemPrompt: string;
    styleGuidelines: string;
  };
};

/**
 * Generate pages for a site using GPT with optional PromptProfile
 */
export async function generatePagesForSite(
  params: GenerateParams
): Promise<PageSpec[]> {
  const { niche, city, state, keywords = [], brand, promptProfile } = params;

  const systemPrompt = (promptProfile?.systemPrompt || `
You are an expert local SEO strategist and copywriter.
You generate ONLY JSON arrays of page objects for local service websites.
Each page object must have:
- "type"
- "slug"
- "title"
- "content"
- "seoTitle"
- "seoDescription"
- "focusKeyword"

No commentary. No backticks.
`).trim();

  const style = promptProfile?.styleGuidelines || `
- Tone: confident, friendly, professional
- No pricing or dollar amounts
- Emphasize trust, reliability, and local expertise
- Mention licensing & insurance when appropriate
`;

  const userPrompt = `
Niche: ${niche}
Brand Name: ${brand.name}
Service Area: ${city}, ${state}
Primary Phone: ${brand.phonePretty} (${brand.phoneClean})
Primary Email: ${brand.email}
Keywords (highest intent first): ${keywords.join(", ")}

Style guidelines:
${style}

Create pages:
- 1 home page (type "home", slug "")
- 1 about page (type "about", slug "about")
- 1 contact page (type "contact", slug "contact")
- 2 core service pages (type "service", slugs based on main money keywords)
- 1 city/service-area page (type "city", slug based on "${city} ${niche}")

Home page: 1200–1500 words.
Other pages: 800–1200 words minimum.

SEO rules:
- Use the main keyword in the H1 and first paragraph.
- Include supporting keywords naturally 3–7 times.
- Use {{URL_CONTACT}} token anywhere you link to the contact page.

Output ONLY a JSON array of page objects with fields:
"type", "slug", "title", "content", "seoTitle", "seoDescription", "focusKeyword".
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.5,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt.trim() },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("GPT returned empty content");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error("[generatePagesForSite] JSON parse error. Raw:", content);
    throw new Error("Failed to parse GPT JSON; check logs for raw output.");
  }

  return parsed as PageSpec[];
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use generatePagesForSite instead
 */
export async function generatePagesForNicheLocation(
  params: Omit<GenerateParams, "siteId">
): Promise<PageSpec[]> {
  return generatePagesForSite({
    ...params,
    siteId: "legacy",
  });
}

