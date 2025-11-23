/**
 * POST /api/wp/build-site
 * 
 * Build a complete WordPress site using GPT-generated content.
 * Accepts niche, city, state, keywords, and brand info.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import type { BrandSpec } from "../../../lib/wpFactoryTypes";
import { bootstrapSite, syncPages } from "../../../lib/wpFactoryClient";
import { generatePagesForNicheLocation } from "../../../lib/gptPageGenerator";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      niche,
      city,
      state,
      keywords = [],
      brand,
    } = req.body as {
      niche: string;
      city: string;
      state: string;
      keywords?: string[];
      brand: BrandSpec;
    };

    if (!niche || !city || !state || !brand?.name) {
      return res.status(400).json({ error: "Missing niche, city, state or brand" });
    }

    // 1) Configure WP site
    await bootstrapSite(brand);

    // 2) Generate pages via OpenAI
    const pages = await generatePagesForNicheLocation({
      niche,
      city,
      state,
      keywords,
      brand,
    });

    // 3) Push pages to WordPress
    const wpResult = await syncPages(pages);

    return res.status(200).json({
      status: "ok",
      message: `Built site for ${niche} in ${city}, ${state}`,
      pagesCount: pages.length,
      wpResult,
    });
  } catch (err: any) {
    console.error("[build-site] error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}

