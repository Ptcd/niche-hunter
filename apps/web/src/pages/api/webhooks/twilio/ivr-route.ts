/**
 * POST /api/webhooks/twilio/ivr-route
 * 
 * Handles IVR digit selection and routes to the appropriate number.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const siteId = req.query.siteId as string;
    const digits = req.body.Digits || req.body.digits;

    if (!siteId) {
      return res.status(400).type("text/xml").send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error: Site ID required</Say></Response>'
      );
    }

    if (!digits) {
      // No digits pressed, redirect back to main voice handler
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || '';
      const voiceUrl = baseUrl 
        ? `${baseUrl}/api/webhooks/twilio/voice`
        : `/api/webhooks/twilio/voice`;
      return res.status(200).type("text/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect>${voiceUrl}</Redirect></Response>`
      );
    }

    // Get site configuration
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return res.status(404).type("text/xml").send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error: Site not found</Say></Response>'
      );
    }

    // Parse IVR options
    const ivrOptions = Array.isArray(site.ivrOptions) ? site.ivrOptions : [];
    const selectedOption = ivrOptions.find((opt: any) => opt.digit === digits);

    if (!selectedOption || !selectedOption.forwardTo) {
      // Invalid selection, play error and redirect
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || '';
      const voiceUrl = baseUrl 
        ? `${baseUrl}/api/webhooks/twilio/voice`
        : `/api/webhooks/twilio/voice`;
      let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
      twiml += '<Say voice="alice">Invalid selection. Please try again.</Say>';
      twiml += `<Redirect>${voiceUrl}</Redirect>`;
      twiml += '</Response>';
      return res.status(200).type("text/xml").send(twiml);
    }

    // Route to the selected number
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    // Build base URL for webhooks
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || '';
    const callStatusUrl = baseUrl 
      ? `${baseUrl}/api/webhooks/twilio/call-status`
      : `/api/webhooks/twilio/call-status`;

    // Check if whisper is enabled
    if (site.whisperEnabled && site.whisperMessage) {
      const whisperUrl = baseUrl 
        ? `${baseUrl}/api/webhooks/twilio/whisper?siteId=${site.id}&message=${encodeURIComponent(site.whisperMessage)}`
        : `/api/webhooks/twilio/whisper?siteId=${site.id}&message=${encodeURIComponent(site.whisperMessage)}`;
      twiml += `<Dial action="${callStatusUrl}" method="POST">`;
      twiml += `<Number url="${whisperUrl}">${selectedOption.forwardTo}</Number>`;
      twiml += `</Dial>`;
    } else {
      twiml += `<Dial action="${callStatusUrl}" method="POST">`;
      twiml += `<Number>${selectedOption.forwardTo}</Number>`;
      twiml += `</Dial>`;
    }

    twiml += '</Response>';

    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(twiml);
  } catch (err: any) {
    console.error("[twilio-ivr-route] error:", err);
    return res.status(500).type("text/xml").send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error processing selection</Say></Response>'
    );
  }
}

