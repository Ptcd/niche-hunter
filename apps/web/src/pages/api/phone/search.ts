/**
 * POST /api/phone/search
 * 
 * Search available phone numbers via Twilio.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { searchPhoneNumbers } from "../../../lib/twilioClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { areaCode } = req.body as {
      areaCode: string;
    };

    if (!areaCode) {
      return res.status(400).json({ error: "Missing areaCode" });
    }

    const numbers = await searchPhoneNumbers(areaCode);

    return res.status(200).json({
      status: "ok",
      numbers,
    });
  } catch (err: any) {
    console.error("[phone-search] error:", err);
    return res.status(500).json({
      status: "error",
      error: err.message || "Unknown error",
    });
  }
}

