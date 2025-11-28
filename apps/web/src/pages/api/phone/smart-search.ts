/**
 * POST /api/phone/smart-search
 * 
 * Smart phone number search based on site's location (city/state).
 * Automatically suggests numbers matching the site's location.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { searchPhoneNumbersByAreaCodes, searchPhoneNumbersByLocation } from "../../../lib/twilioClient";
import { getAreaCodesForCityState, getAreaCodesForZip } from "../../../lib/zipToAreaCode";

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
        batchId: true,
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

    let numbers: any[] = [];
    let zip: string | null = null;
    let areaCodes: string[] = [];

    // First, try to get area codes directly from city/state mapping
    areaCodes = getAreaCodesForCityState(site.city, site.state);
    
    if (areaCodes.length > 0) {
      // Search by area codes (prioritized local numbers)
      numbers = await searchPhoneNumbersByAreaCodes(areaCodes, 10);
    }

    // Fallback to location-based search if no area codes found or no numbers returned
    if (numbers.length === 0) {
      numbers = await searchPhoneNumbersByLocation(
        site.city,
        site.state,
        10 // Request 10 numbers
      );
    }

    return res.status(200).json({
      status: "ok",
      city: site.city,
      state: site.state,
      zip: zip || undefined,
      areaCodes: areaCodes.length > 0 ? areaCodes : undefined,
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

