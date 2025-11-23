/**
 * POST /api/phone/set-manual
 * 
 * Set a manual tracking number for a site.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { PhoneSource } from "@prisma/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { siteId, trackingNumber, forwardToNumber } = req.body as {
      siteId: string;
      trackingNumber: string;
      forwardToNumber?: string;
    };

    if (!siteId || !trackingNumber) {
      return res.status(400).json({
        error: "Missing siteId or trackingNumber",
      });
    }

    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    // Update site with manual phone number
    await prisma.site.update({
      where: { id: siteId },
      data: {
        phoneSource: PhoneSource.MANUAL,
        trackingNumber,
        forwardToNumber: forwardToNumber || null,
        hasPhone: true,
      },
    });

    return res.status(200).json({
      status: "ok",
      phoneNumber: trackingNumber,
    });
  } catch (err: any) {
    console.error("[phone-set-manual] error:", err);
    return res.status(500).json({
      status: "error",
      error: err.message || "Unknown error",
    });
  }
}
