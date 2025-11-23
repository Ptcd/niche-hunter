/**
 * POST /api/domain/check
 * 
 * Check domain availability via Namecheap.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { checkDomainAvailability } from "../../../lib/namecheapClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { domain } = req.body as {
      domain: string;
    };

    if (!domain) {
      return res.status(400).json({ error: "Missing domain" });
    }

    const status = await checkDomainAvailability(domain);

    return res.status(200).json({
      status,
      domain,
    });
  } catch (err: any) {
    console.error("[domain-check] error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}

