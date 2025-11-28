/**
 * POST /api/webhooks/twilio/dial-action
 * 
 * Handles Dial action callbacks to play whisper when call is answered.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";

// Escape XML special characters for TwiML
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { DialCallStatus, DialCallSid, siteId } = req.body;
    
    // Only play whisper if call was answered
    if (DialCallStatus === "answered" && siteId) {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        select: {
          whisperEnabled: true,
          whisperMessage: true,
        },
      });

      if (site?.whisperEnabled && site.whisperMessage) {
        const message = escapeXml(site.whisperMessage);
        // Play whisper message - this will play to the agent (the dialed party)
        // The call is already connected, so this plays in the context of the dialed leg
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="0.5"/>
  <Say voice="alice">${message}</Say>
</Response>`;
        
        res.setHeader("Content-Type", "text/xml");
        return res.status(200).send(twiml);
      }
    }

    // If not answered or no whisper, return empty response
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    );
  } catch (err: any) {
    console.error("[twilio-dial-action] error:", err);
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    );
  }
}

