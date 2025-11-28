/**
 * POST /api/v5000/sites/[siteId]/pages/[pageId]/rebuild-skeletons
 * 
 * Rebuild content skeletons for a page from blueprints
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { buildSkeletonsForPage } from "../../../../../../../lib/site-setup";

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

    // Build skeletons
    await buildSkeletonsForPage(pageId);

    // Get count of skeletons created
    const skeletonCount = await prisma.contentSkeleton.count({
      where: { sitePageId: pageId },
    });

    return res.status(200).json({
      status: "ok",
      pageId,
      skeletonsCreated: skeletonCount,
    });
  } catch (err: any) {
    console.error("[rebuild-skeletons] error:", err);
    return res.status(500).json({
      error: err.message || "Unknown error",
    });
  }
}

