/**
 * POST /api/phone/search-ringba
 * 
 * Search available phone numbers via Ringba.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { searchRingbaNumbers } from "../../../lib/ringbaClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { areaCode, country = "US" } = req.body as {
      areaCode?: string;
      country?: string;
    };

    const numbers = await searchRingbaNumbers({ areaCode, country });

    return res.status(200).json({
      status: "ok",
      numbers: numbers.map((n) => ({
        id: n.id,
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
      })),
    });
  } catch (err: any) {
    console.error("[phone-search-ringba] error:", err);
    return res.status(500).json({
      status: "error",
      error: err.message || "Unknown error",
      numbers: [],
    });
  }
}
