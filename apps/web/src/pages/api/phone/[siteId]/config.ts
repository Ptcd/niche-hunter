/**
 * GET/POST /api/phone/[siteId]/config
 * 
 * Get or update phone routing configuration for a site.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";
import { Prisma } from "@prisma/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { siteId } = req.query;

  if (!siteId || typeof siteId !== "string") {
    return res.status(400).json({ error: "Missing siteId" });
  }

  if (req.method === "GET") {
    try {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        select: {
          trackingNumber: true,
          forwardToNumber: true,
          whisperEnabled: true,
          whisperMessage: true,
          ivrEnabled: true,
          ivrGreeting: true,
          ivrOptions: true,
        },
      });

      if (!site) {
        return res.status(404).json({ error: "Site not found" });
      }

      return res.status(200).json({
        trackingNumber: site.trackingNumber,
        forwardToNumber: site.forwardToNumber,
        whisperEnabled: site.whisperEnabled,
        whisperMessage: site.whisperMessage,
        ivrEnabled: site.ivrEnabled,
        ivrGreeting: site.ivrGreeting,
        ivrOptions: site.ivrOptions,
      });
    } catch (err: any) {
      console.error("[phone-config] GET error:", err);
      return res.status(500).json({ error: err.message || "Unknown error" });
    }
  }

  if (req.method === "POST") {
    try {
      const {
        forwardToNumber,
        whisperEnabled,
        whisperMessage,
        ivrEnabled,
        ivrGreeting,
        ivrOptions,
      } = req.body as {
        forwardToNumber?: string;
        whisperEnabled?: boolean;
        whisperMessage?: string;
        ivrEnabled?: boolean;
        ivrGreeting?: string;
        ivrOptions?: Array<{ digit: string; label: string; forwardTo: string }>;
      };

      // Validate IVR options if IVR is enabled
      if (ivrEnabled) {
        if (!ivrGreeting || !ivrGreeting.trim()) {
          return res.status(400).json({ error: "IVR greeting is required when IVR is enabled" });
        }
        if (!ivrOptions || !Array.isArray(ivrOptions) || ivrOptions.length === 0) {
          return res.status(400).json({ error: "At least one IVR option is required when IVR is enabled" });
        }
        // Validate each option
        for (const opt of ivrOptions) {
          if (!opt.digit || !opt.label || !opt.forwardTo) {
            return res.status(400).json({ error: "Each IVR option must have digit, label, and forwardTo" });
          }
          if (!/^[1-9]$/.test(opt.digit)) {
            return res.status(400).json({ error: "IVR digits must be 1-9" });
          }
        }
        // Check for duplicate digits
        const digits = ivrOptions.map(opt => opt.digit);
        if (new Set(digits).size !== digits.length) {
          return res.status(400).json({ error: "IVR digits must be unique" });
        }
      }

      // Validate whisper if enabled
      if (whisperEnabled && (!whisperMessage || !whisperMessage.trim())) {
        return res.status(400).json({ error: "Whisper message is required when whisper is enabled" });
      }

      // Update site
      const site = await prisma.site.update({
        where: { id: siteId },
        data: {
          forwardToNumber: forwardToNumber !== undefined ? forwardToNumber : undefined,
          whisperEnabled: whisperEnabled !== undefined ? whisperEnabled : false,
          whisperMessage: whisperMessage !== undefined ? whisperMessage : null,
          ivrEnabled: ivrEnabled !== undefined ? ivrEnabled : false,
          ivrGreeting: ivrGreeting !== undefined ? ivrGreeting : null,
          ivrOptions: ivrOptions !== undefined ? ivrOptions : Prisma.JsonNull,
        },
      });

      return res.status(200).json({
        status: "ok",
        config: {
          forwardToNumber: site.forwardToNumber,
          whisperEnabled: site.whisperEnabled,
          whisperMessage: site.whisperMessage,
          ivrEnabled: site.ivrEnabled,
          ivrGreeting: site.ivrGreeting,
          ivrOptions: site.ivrOptions,
        },
      });
    } catch (err: any) {
      console.error("[phone-config] POST error:", err);
      return res.status(500).json({ error: err.message || "Unknown error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

