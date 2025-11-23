/**
 * GET /api/v5000/control-tower
 * 
 * Returns summary of all sites with metrics, pages, and alerts.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { SiteStatus } from "@prisma/client";
import { withAuth } from "../../../lib/auth/withAuth";

async function handler(req: NextApiRequest & { auth: any }, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get all sites with related data, filtered by accountId
    const sites = await prisma.site.findMany({
      where: {
        accountId: req.auth.currentAccountId,
      },
      include: {
        niche: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        pages: {
          select: {
            id: true,
            status: true,
          },
        },
        metrics: {
          where: {
            date: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        },
        citations: {
          select: {
            updatedAt: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
        },
        alerts: {
          where: {
            dismissed: false,
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform data for frontend
    const sitesData = sites.map((site) => {
      const totalPages = site.pages.length;
      const publishedPages = site.pages.filter(
        (p) => p.status === "PUBLISHED"
      ).length;
      const coverage = totalPages > 0 ? publishedPages / totalPages : 0;

      // Aggregate metrics for last 7 days
      const calls7d = site.metrics.reduce((sum, m) => sum + m.calls, 0);
      const views7d = site.metrics.reduce((sum, m) => sum + m.pageViews, 0);
      const clicks7d = site.metrics.reduce((sum, m) => sum + m.clicks, 0);
      const impressions7d = site.metrics.reduce(
        (sum, m) => sum + m.impressions,
        0
      );

      // Calculate average position
      const positions = site.metrics
        .filter((m) => m.avgPosition !== null)
        .map((m) => m.avgPosition!);
      const avgPosition7d =
        positions.length > 0
          ? positions.reduce((sum, p) => sum + p, 0) / positions.length
          : null;

      // Get last citation update
      const lastCitationUpdate =
        site.citations.length > 0 ? site.citations[0].updatedAt : null;

      // Calculate monthly costs and profit
      const monthlyCost = ((site.domainCostCents || 0) / 100 / 12) 
        + ((site.phoneCostCents || 0) / 100) 
        + ((site.hostingCostCents || 0) / 100);
      const monthlyRevenue = (site.monthlyRevenueCents || 0) / 100;
      const monthlyProfit = monthlyRevenue - monthlyCost;

      // Calculate leads (calls + forms) for last 30 days
      const leads30d = site.metrics.reduce((sum: number, m: any) => 
        sum + m.calls + m.formLeads, 0);

      return {
        id: site.id,
        name: site.siteName || `${site.city}, ${site.state}`,
        domain: site.domain,
        status: site.status,
        niche: {
          name: site.niche.name,
          slug: site.niche.slug,
        },
        city: site.city,
        state: site.state,
        trackingNumber: site.trackingNumber || site.twilioNumber || null,
        metrics: {
          totalPages,
          publishedPages,
          coverage,
          calls7d,
          views7d,
          clicks7d,
          impressions7d,
          avgPosition7d,
        },
        monthlyCost,
        monthlyRevenue,
        monthlyProfit,
        leads30d,
        healthStatus: site.healthStatus || 'unknown',
        alerts: site.alerts.length,
        lastCitationUpdate,
        createdAt: site.createdAt,
        updatedAt: site.updatedAt,
      };
    });

    // Calculate summary stats
    const totalSites = sitesData.length;
    const liveSites = sitesData.filter((s) => s.status === SiteStatus.LIVE).length;
    const totalCalls7d = sitesData.reduce((sum, s) => sum + s.metrics.calls7d, 0);
    const avgCoverage =
      sitesData.length > 0
        ? sitesData.reduce((sum, s) => sum + s.metrics.coverage, 0) /
          sitesData.length
        : 0;

    return res.status(200).json({
      sites: sitesData,
      summary: {
        totalSites,
        liveSites,
        totalCalls7d,
        avgCoverage,
      },
    });
  } catch (error: any) {
    console.error("[control-tower] error:", error);
    return res.status(500).json({
      error: error.message || "Unknown error",
    });
  }
}

export default withAuth(handler);

