/**
 * POST /api/domain/register
 * 
 * Register a domain via Namecheap and assign to a site.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { registerDomain } from "../../../lib/namecheapClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { siteId, domain } = req.body as {
      siteId: string;
      domain: string;
    };

    if (!siteId || !domain) {
      return res.status(400).json({ error: "Missing siteId or domain" });
    }

    // Load site to get contact info
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    // For now, use default contact info (should be configurable)
    // In production, you'd want to store contact info per site or use a default
    const contactInfo = {
      firstName: "Admin",
      lastName: "User",
      email: site.email || "admin@example.com",
      phone: "+1234567890",
      address1: "123 Main St",
      city: site.city,
      state: site.state,
      zip: "12345",
      country: "US",
    };

    const result = await registerDomain(domain, 1, contactInfo);

    if (!result.success) {
      return res.status(500).json({
        status: "error",
        domain,
        error: "Domain registration failed",
        raw: result.raw,
      });
    }

    // Update site with domain
    await prisma.site.update({
      where: { id: siteId },
      data: {
        domain,
        registrar: "namecheap",
      },
    });

    return res.status(200).json({
      status: "ok",
      domain,
      raw: result.raw,
    });
  } catch (err: any) {
    console.error("[domain-register] error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}

