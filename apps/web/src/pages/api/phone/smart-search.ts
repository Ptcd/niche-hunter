/**
 * POST /api/phone/smart-search
 * 
 * Smart phone number search based on site's location (city/state).
 * Automatically suggests numbers matching the site's location.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { searchPhoneNumbersByLocation } from "../../../lib/twilioClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { siteId } = req.body as {
      siteId: string;
    };

    if (!siteId) {
      return res.status(400).json({ error: "Missing siteId" });
    }

    // Look up site to get city and state
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: {
        city: true,
        state: true,
      },
    });

    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    if (!site.city || !site.state) {
      return res.status(400).json({ 
        error: "Site missing city or state information" 
      });
    }

    // Search for numbers matching the location
    const numbers = await searchPhoneNumbersByLocation(
      site.city,
      site.state,
      10 // Request 10 numbers
    );

    return res.status(200).json({
      status: "ok",
      city: site.city,
      state: site.state,
      numbers,
    });
  } catch (err: any) {
    console.error("[phone-smart-search] error:", err);
    return res.status(500).json({
      status: "error",
      error: err.message || "Unknown error",
    });
  }
}

