/**
 * POST /api/v5000/sites/[siteId]/pages/[pageId]/audit
 * 
 * Audit a SitePage using its stored HTML
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { runPageAudit, AuditContext } from "@niche-hunter/core";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { siteId, pageId } = req.query;

    if (typeof siteId !== "string" || typeof pageId !== "string") {
      return res.status(400).json({ error: "Invalid siteId or pageId" });
    }

    // Load page with site data
    const page = await prisma.sitePage.findUnique({
      where: { id: pageId },
      include: {
        site: {
          include: {
            niche: true,
            pages: {
              where: {
                id: { not: pageId },
              },
              select: {
                slug: true,
                htmlDraft: true,
              },
            },
          },
        },
      },
    });

    if (!page || !page.site) {
      return res.status(404).json({ error: "Page not found" });
    }

    if (page.siteId !== siteId) {
      return res.status(400).json({ error: "Page does not belong to this site" });
    }

    // Get HTML (prefer published, fallback to draft)
    const html = page.htmlPublished || page.htmlDraft || '';
    
    if (!html) {
      return res.status(400).json({ error: "Page has no HTML content to audit" });
    }

    // Build page URL
    const site = page.site;
    const baseUrl = site.domain ? `https://${site.domain}` : `https://example.com`;
    const pageUrl = `${baseUrl}/${page.slug || ''}`;

    // Build audit input
    const pageInput = {
      url: pageUrl,
      html,
      businessType: (site.businessType || 'service_area') as 'storefront' | 'service_area',
      businessName: site.siteName || undefined,
      primaryPhone: site.trackingNumber || site.twilioNumber || '',
      targetCity: site.city,
      targetState: site.state,
      targetCountry: 'US',
      primaryService: site.niche.name,
      primaryKeyword: page.focusKeyword || '',
      additionalKeywords: page.supportingKeywords || undefined,
    };

    // Get site-wide location pages for duplicate detection
    const siteWidePages = site.pages
      .filter(p => p.htmlDraft)
      .map(p => ({
        url: `${baseUrl}/${p.slug || ''}`,
        html: p.htmlDraft || '',
      }));

    // Build audit context
    const context: AuditContext = {
      page: pageInput,
      siteWideLocationPages: siteWidePages.length > 0 ? siteWidePages : undefined,
      // TODO: Add competitive data from DataForSEO SERP analysis
    };

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

