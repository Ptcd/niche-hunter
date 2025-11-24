/**
 * POST /api/v5000/sites/[siteId]/pages/[pageId]/regenerate
 * 
 * Regenerate a single page's content using GPT.
 * Uses page's notesForGpt field for custom instructions.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { PageStatus } from "@prisma/client";
import { generatePageContent } from "../../../../../../../server/ai/contentGenerator";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { siteId, pageId } = req.query;

    if (typeof siteId !== "string" || typeof pageId !== "string") {
      return res.status(400).json({ error: "Invalid siteId or pageId" });
    }

    // Verify page exists and belongs to site
    const page = await prisma.sitePage.findUnique({
      where: { id: pageId },
      include: {
        site: true,
      },
    });

    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }

    if (page.siteId !== siteId) {
      return res.status(400).json({ error: "Page does not belong to this site" });
    }

    // Generate new content
    const generated = await generatePageContent(pageId);

    // Update page with new content
    // Preserve humanNotes and htmlEdited
    await prisma.sitePage.update({
      where: { id: pageId },
      data: {
        htmlDraft: generated.html,
        aiDraftJson: generated.sections as any,
        targetWordCount: generated.wordCount,
        latestGenerationAt: new Date(),
        // If status was NEEDS_REWRITE, change back to DRAFT
        status: page.status === PageStatus.NEEDS_REWRITE 
          ? PageStatus.DRAFT 
          : page.status,
        contentStatus: "draft_generated",
      },
    });

    return res.status(200).json({
      status: "ok",
      pageId,
      html: generated.html,
      wordCount: generated.wordCount,
      sections: generated.sections,
    });
  } catch (err: any) {
    console.error("[regenerate-page] error:", err);
    return res.status(500).json({
      error: err.message || "Unknown error",
    });
  }
}

