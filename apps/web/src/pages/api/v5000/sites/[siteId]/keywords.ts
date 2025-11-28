/**
 * GET /api/v5000/sites/[siteId]/keywords
 * 
 * Returns all keywords for a site's batch with volumes
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { siteId } = req.query;

    if (typeof siteId !== "string") {
      return res.status(400).json({ error: "Invalid siteId" });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: {
        batch: true,
      },
    });

    if (!site || !site.batch?.id) {
      return res.status(404).json({ error: "Site or batch not found" });
    }

    // Get city record for this site
    const cityRecord = await prisma.cityV5000.findFirst({
      where: { 
        city: site.city, 
        state: site.state 
      },
    });

    // Get all keywords for this batch and city
    const batchKeywords = await prisma.keywordV5000.findMany({
      where: { 
        batchId: site.batch.id,
        cityId: cityRecord?.id,
        isSkipped: false 
      },
      include: {
        nicheKeyword: { 
          select: { keyword: true } 
        },
        metrics: { 
          select: { searchVolume: true } 
        },
        city: {
          select: { city: true, state: true }
        }
      },
      orderBy: {
        metrics: {
          searchVolume: 'desc'
        }
      }
    });

    // Build keyword list with volumes
    const keywordsMap = new Map<string, { keyword: string; volume: number; localizedQuery: string }>();
    
    for (const kw of batchKeywords) {
      const baseKeyword = kw.nicheKeyword?.keyword || '';
      const localizedQuery = kw.localizedQuery || baseKeyword;
      const volume = kw.metrics?.searchVolume || 0;
      
      // Use localized query as key to show city-specific versions
      if (!keywordsMap.has(localizedQuery)) {
        keywordsMap.set(localizedQuery, {
          keyword: baseKeyword,
          volume: 0,
          localizedQuery
        });
      }
      
      // Sum volumes for same localized query
      const existing = keywordsMap.get(localizedQuery)!;
      existing.volume += volume;
    }

    const keywords = Array.from(keywordsMap.values())
      .sort((a, b) => b.volume - a.volume);

    return res.status(200).json({
      keywords,
      total: keywords.length,
    });
  } catch (err: any) {
    console.error("[get-site-keywords] error:", err);
    return res.status(500).json({
      error: err.message || "Unknown error",
    });
  }
}

