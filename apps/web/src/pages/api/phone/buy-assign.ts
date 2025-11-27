/**
 * POST /api/phone/buy-assign
 * 
 * Purchase a phone number via Twilio and assign to a site.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { PhoneSource } from "@prisma/client";
import { buyPhoneNumber } from "../../../lib/twilioClient";
import { logCost } from "../../../server/costs/logCost";

// Build webhook URL - use env var if set, otherwise construct from request
function getVoiceWebhookUrl(): string {
  const envUrl = process.env.TWILIO_VOICE_WEBHOOK_URL;
  if (envUrl) return envUrl;
  
  // Fallback: construct from Vercel URL or use relative path
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || '';
  
  return baseUrl ? `${baseUrl}/api/webhooks/twilio/voice` : '/api/webhooks/twilio/voice';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { siteId, phoneNumber, forwardToNumber } = req.body as {
      siteId: string;
      phoneNumber: string;
      forwardToNumber: string;
    };

    if (!siteId || !phoneNumber || !forwardToNumber) {
      return res.status(400).json({
        error: "Missing siteId, phoneNumber, or forwardToNumber",
      });
    }

    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    // Purchase phone number with voice webhook
    const voiceWebhookUrl = getVoiceWebhookUrl();
    const result = await buyPhoneNumber(phoneNumber, voiceWebhookUrl);

    // Update site with phone number
    await prisma.site.update({
      where: { id: siteId },
      data: {
        phoneSource: PhoneSource.TWILIO,
        trackingNumber: result.phoneNumber,
        twilioNumber: result.phoneNumber, // Keep for backward compatibility
        twilioNumberSid: result.sid,
        forwardToNumber,
        hasPhone: true,
      },
    });

    // Log cost ($1/month for Twilio)
    await logCost({
      siteId,
      type: 'phone_monthly',
      amountCents: 100, // $1/month
      provider: 'twilio',
      description: `Twilio number: ${result.phoneNumber}`,
    });

    return res.status(200).json({
      status: "ok",
      sid: result.sid,
      phoneNumber: result.phoneNumber,
    });
  } catch (err: any) {
    console.error("[phone-buy-assign] error:", err);
    return res.status(500).json({
      status: "error",
      error: err.message || "Unknown error",
    });
  }
}

