/**
 * PATCH /api/page/[id]
 * 
 * Update a page (seoTitle, seoDescription, htmlEdited, notesForGpt, status).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { PageStatus } from "@prisma/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;
    const { seoTitle, seoDescription, htmlEdited, notesForGpt, status } = req.body as {
      seoTitle?: string;
      seoDescription?: string;
      htmlEdited?: string;
      notesForGpt?: string;
      status?: PageStatus;
    };

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Invalid page ID" });
    }

    // Build update data
    const updateData: any = {};
    if (seoTitle !== undefined) updateData.seoTitle = seoTitle;
    if (seoDescription !== undefined) updateData.seoDescription = seoDescription;
    if (htmlEdited !== undefined) updateData.htmlEdited = htmlEdited;
    if (notesForGpt !== undefined) updateData.notesForGpt = notesForGpt;
    if (status !== undefined) {
      updateData.status = status;
      // Also update contentStatus for backward compatibility
      if (status === PageStatus.PUBLISHED) {
        updateData.contentStatus = "published";
      } else if (status === PageStatus.APPROVED) {
        updateData.contentStatus = "ready_to_publish";
      } else {
        updateData.contentStatus = "draft_generated";
      }
    }

    const page = await prisma.sitePage.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      status: "ok",
      page,
    });
  } catch (err: any) {
    console.error("[page-update] error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}

