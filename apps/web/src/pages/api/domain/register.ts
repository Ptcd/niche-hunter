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
    const { siteId, domain, contactInfo: providedContactInfo } = req.body as {
      siteId: string;
      domain: string;
      contactInfo?: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        address1: string;
        city: string;
        state: string;
        zip: string;
        country: string;
      };
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

    // Use provided contact info or fall back to default (Colin Merrill)
    const contactInfo = providedContactInfo || {
      firstName: "Colin",
      lastName: "Merrill",
      email: "colin.merrill1@gmail.com",
      phone: "+1.2627770909",
      address1: "12605 w north ave",
      city: "brookfield",
      state: "wi",
      zip: "53005",
      country: "US",
    };

    const result = await registerDomain(domain, 1, contactInfo);

    if (!result.success) {
      // Use the error message from registerDomain (already parsed)
      const errorMessage = result.error || "Domain registration failed";

      console.error("[domain-register] Registration failed:", {
        domain,
        error: errorMessage,
        raw: result.raw,
      });

      return res.status(500).json({
        status: "error",
        domain,
        error: errorMessage,
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

