/**
 * POST /api/wp/publish-site
 * 
 * Publish approved pages (or all drafts) to WordPress.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { publishSitePages } from "../../../server/wp/publishPipeline";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { siteId, mode = "approved-only", publishStatus = "publish" } = req.body as {
      siteId: string;
      mode?: "approved-only" | "all-drafts" | "single";
      pageId?: string;
      publishStatus?: "draft" | "publish";
    };

    if (!siteId) {
      return res.status(400).json({ error: "Missing siteId" });
    }

    // Publish using pipeline
    const results = await publishSitePages(siteId, {
      mode: mode as any,
      pageId: req.body.pageId,
      publishStatus: publishStatus as any,
    });

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    return res.status(200).json({
      status: "ok",
      siteId,
      pagesPublished: successCount,
      pagesFailed: errorCount,
      results,
    });
  } catch (err: any) {
    console.error("[publish-site] error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}

