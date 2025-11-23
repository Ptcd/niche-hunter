/**
 * POST /api/phone/buy-ringba
 * 
 * Purchase a phone number via Ringba and assign to a site.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { PhoneSource } from "@prisma/client";
import { buyRingbaNumber } from "../../../lib/ringbaClient";
import { logCost } from "../../../server/costs/logCost";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { siteId, numberId } = req.body as {
      siteId: string;
      numberId: string;
    };

    if (!siteId || !numberId) {
      return res.status(400).json({
        error: "Missing siteId or numberId",
      });
    }

    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    // Purchase phone number via Ringba
    const result = await buyRingbaNumber({ numberId });

    // Update site with phone number
    await prisma.site.update({
      where: { id: siteId },
      data: {
        phoneSource: PhoneSource.RINGBA,
        trackingNumber: result.phoneNumber,
        ringbaNumberId: result.id,
        hasPhone: true,
      },
    });

    // Log cost (estimate $2-5/month for Ringba, using $3 as default)
    await logCost({
      siteId,
      type: 'phone_monthly',
      amountCents: 300, // $3/month estimate
      provider: 'ringba',
      description: `Ringba number: ${result.phoneNumber}`,
    });

    return res.status(200).json({
      status: "ok",
      phoneNumber: result.phoneNumber,
      numberId: result.id,
    });
  } catch (err: any) {
    console.error("[phone-buy-ringba] error:", err);
    return res.status(500).json({
      status: "error",
      error: err.message || "Unknown error",
    });
  }
}

