/**
 * POST /api/page/regenerate
 * 
 * Regenerate a single page using GPT with optional notes.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { buildBrandSpec } from "../../../lib/brandBuilder";
import { chatWithFallback } from "../../../lib/openaiHelpers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { pageId } = req.body as {
      pageId: string;
    };

    if (!pageId) {
      return res.status(400).json({ error: "Missing pageId" });
    }

    // Load Page with Site and PromptProfile
    const page = await prisma.sitePage.findUnique({
      where: { id: pageId },
      include: {
        site: {
          include: {
            niche: true,
            promptProfile: true,
          },
        },
      },
    });

    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }

    const site = page.site;

    // Build BrandSpec
    const brand = buildBrandSpec({
      siteName: site.siteName,
      city: site.city,
      state: site.state,
      email: site.email,
      domain: site.domain,
      trackingNumber: site.trackingNumber,
      twilioNumber: site.twilioNumber, // Legacy field
      forwardToNumber: site.forwardToNumber,
      logoUrl: site.logoUrl,
    });

    // Prepare prompts
    const systemPrompt = (site.promptProfile?.systemPrompt || `
You are an expert local SEO copywriter.
Generate a single page of HTML content for a local service website.
Output ONLY valid HTML content (no JSON wrapper, no markdown).
`).trim();

    const styleGuidelines = site.promptProfile?.styleGuidelines || `
- Tone: confident, friendly, professional
- No pricing or dollar amounts
- Emphasize trust, reliability, and local expertise
- Use strong calls-to-action
`;

    const userPrompt = `
Niche: ${site.niche.slug}
Brand Name: ${brand.name}
Service Area: ${site.city}, ${site.state}
Primary Phone: ${brand.phonePretty} (${brand.phoneClean})
Primary Email: ${brand.email}

Page Type: ${page.pageType}
Page Slug: ${page.slug}
Focus Keyword: ${page.focusKeyword}
Supporting Keywords: ${page.supportingKeywords.join(", ")}

Style guidelines:
${styleGuidelines}

${page.notesForGpt ? `\nAdditional instructions:\n${page.notesForGpt}\n` : ""}

Generate ${page.pageType === "HOME" ? "1200-1500" : "800-1200"} words of HTML content.
Include the focus keyword in the H1 and first paragraph.
Use {{URL_CONTACT}} token for contact page links.
Include phone links with tel:${brand.phoneClean}.
Output ONLY the HTML content, no JSON, no markdown, no backticks.
`;

    // Call OpenAI with fallback
    const completion = await chatWithFallback({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt.trim() },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("GPT returned empty content");
    }

    // Clean content (remove markdown code blocks if present)
    let htmlContent = content.trim();
    if (htmlContent.startsWith("```")) {
      htmlContent = htmlContent.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
    }

    // Update page with new draft
    await prisma.sitePage.update({
      where: { id: pageId },
      data: {
        htmlDraft: htmlContent,
        status: "DRAFT",
        // Keep htmlEdited intact
      },
    });

    return res.status(200).json({
      status: "ok",
      pageId,
      htmlDraft: htmlContent,
    });
  } catch (err: any) {
    console.error("[regenerate] error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}

