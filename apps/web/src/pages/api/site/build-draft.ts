/**
 * POST /api/site/build-draft
 * 
 * Generate draft pages for a site using GPT.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { PageStatus, SiteStatus } from "@prisma/client";
import { generateAllPagesForSite } from "../../../server/ai/contentGenerator";
import { logCost } from "../../../server/costs/logCost";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { siteId, keywords = [] } = req.body as {
      siteId: string;
      keywords?: string[];
    };

    if (!siteId) {
      return res.status(400).json({ error: "Missing siteId" });
    }

    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    // Generate all pages using new content generator
    const generatedPages = await generateAllPagesForSite(siteId);

    // Update SitePage records with generated content
    let pagesCreated = 0;
    let pagesUpdated = 0;

    for (const generated of generatedPages) {
      const page = await prisma.sitePage.findUnique({
        where: { id: generated.pageId },
      });

      if (page) {
        // Update existing page
        await prisma.sitePage.update({
          where: { id: generated.pageId },
          data: {
            htmlDraft: generated.html,
            aiDraftJson: generated.sections as any,
            targetWordCount: generated.wordCount,
            status: PageStatus.DRAFT,
            latestGenerationAt: new Date(),
            contentStatus: "draft_generated",
            // Keep htmlEdited intact if it exists
          },
        });
        pagesUpdated++;
      } else {
        pagesCreated++;
      }
    }

    // Update site status
    await prisma.site.update({
      where: { id: siteId },
      data: {
        status: SiteStatus.GENERATING,
      },
    });

    // Estimate and log AI costs (rough estimate: $0.10 per page for GPT-4o)
    const estimatedCostCents = Math.ceil(generatedPages.length * 10); // $0.10 per page
    await logCost({
      siteId,
      type: 'ai_generation',
      amountCents: estimatedCostCents,
      provider: 'openai',
      description: `Generated ${generatedPages.length} pages`,
    });

    return res.status(200).json({
      status: "ok",
      siteId,
      pagesCreated,
      pagesUpdated,
      totalPages: generatedPages.length,
    });
  } catch (err: any) {
    console.error("[build-draft] error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}

