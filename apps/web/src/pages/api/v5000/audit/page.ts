/**
 * POST /api/v5000/audit/page
 * 
 * Run a page audit and return results
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { runPageAudit, AuditContext } from "@niche-hunter/core";
import { prisma } from "@niche-hunter/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      url,
      html,
      businessType,
      businessName,
      primaryPhone,
      targetCity,
      targetState,
      targetCountry = "US",
      primaryService,
      primaryKeyword,
      additionalKeywords,
      pageId, // Optional: if auditing a SitePage, we can fetch competitive data
      siteId, // Optional: for fetching site-wide location pages
    } = req.body;

    // Validate required fields
    if (!url || !html || !businessType || !primaryPhone || !targetCity || !targetState || !primaryService || !primaryKeyword) {
      return res.status(400).json({
        error: "Missing required fields: url, html, businessType, primaryPhone, targetCity, targetState, primaryService, primaryKeyword",
      });
    }

    // Build audit input
    const pageInput = {
      url,
      html,
      businessType: businessType as 'storefront' | 'service_area',
      businessName,
      primaryPhone,
      targetCity,
      targetState,
      targetCountry,
      primaryService,
      primaryKeyword,
      additionalKeywords,
    };

    // Build audit context
    const context: AuditContext = {
      page: pageInput,
    };

    // If pageId provided, try to fetch competitive data
    if (pageId) {
      const page = await prisma.sitePage.findUnique({
        where: { id: pageId },
        include: {
          site: {
            include: {
              batch: true,
            },
          },
        },
      });

      if (page) {
        // TODO: Fetch SERP data from DataForSEO for competitive analysis
        // For now, we'll skip competitive data if not provided
        // This can be enhanced later with actual SERP fetching
      }
    }

    // If siteId provided, fetch site-wide location pages for duplicate detection
    if (siteId) {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        include: {
          pages: {
            where: {
              id: pageId ? { not: pageId } : undefined,
            },
            select: {
              slug: true,
            },
          },
        },
      });

      if (site) {
        // Note: We'd need to fetch HTML for other pages to do duplicate detection
        // For now, we'll skip this unless HTML is provided
        // This can be enhanced later
      }
    }

    // Run the audit
    const result = await runPageAudit(context);

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[audit-page] error:", err);
    return res.status(500).json({
      error: err.message || "Unknown error",
    });
  }
}

