/**
 * POST /api/webhooks/twilio/voice
 * 
 * Main Twilio voice webhook - handles incoming calls and routes based on configuration.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@niche-hunter/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get the phone number that was called
    const calledNumber = req.body.To || req.body.Called;
    const callerNumber = req.body.From || req.body.Caller;

    if (!calledNumber) {
      console.error("[twilio-voice] No called number in request");
      return res.status(400).type("text/xml").send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error: Invalid request</Say></Response>'
      );
    }

    // Find site by tracking number
    const site = await prisma.site.findFirst({
      where: {
        OR: [
          { trackingNumber: calledNumber },
          { twilioNumber: calledNumber },
        ],
      },
    });

    if (!site) {
      console.error("[twilio-voice] Site not found for number:", calledNumber);
      return res.status(404).type("text/xml").send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error: Number not configured</Say></Response>'
      );
    }

    if (!site.forwardToNumber) {
      console.error("[twilio-voice] No forward-to number configured for site:", site.id);
      return res.status(400).type("text/xml").send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error: Forward number not configured</Say></Response>'
      );
    }

    // Route based on configuration
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

    if (site.ivrEnabled && site.ivrGreeting && site.ivrOptions) {
      // IVR Mode: Play greeting and gather digits
      const ivrOptions = Array.isArray(site.ivrOptions) ? site.ivrOptions : [];
      const greeting = site.ivrGreeting;
      
      // Build menu text from options
      const menuText = ivrOptions
        .map((opt: any) => `Press ${opt.digit} for ${opt.label}`)
        .join(". ");

      // Build full URL for IVR route
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || '';
      const ivrRouteUrl = baseUrl 
        ? `${baseUrl}/api/webhooks/twilio/ivr-route?siteId=${site.id}`
        : `/api/webhooks/twilio/ivr-route?siteId=${site.id}`;
      
      twiml += `<Gather numDigits="1" action="${ivrRouteUrl}" method="POST" timeout="10">`;
      twiml += `<Say voice="alice">${greeting}. ${menuText}</Say>`;
      twiml += `</Gather>`;
      
      // If no input, repeat
      const voiceUrl = baseUrl 
        ? `${baseUrl}/api/webhooks/twilio/voice`
        : `/api/webhooks/twilio/voice`;
      twiml += `<Say voice="alice">${greeting}. ${menuText}</Say>`;
      twiml += `<Redirect>${voiceUrl}</Redirect>`;
    } else {
      // Direct or Whisper mode: Forward the call
      // Build base URL for webhooks
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || '';
      const callStatusUrl = baseUrl 
        ? `${baseUrl}/api/webhooks/twilio/call-status`
        : `/api/webhooks/twilio/call-status`;

      if (site.whisperEnabled && site.whisperMessage) {
        // Whisper mode: Play message to agent before connecting
        const whisperUrl = baseUrl 
          ? `${baseUrl}/api/webhooks/twilio/whisper?siteId=${site.id}&message=${encodeURIComponent(site.whisperMessage)}`
          : `/api/webhooks/twilio/whisper?siteId=${site.id}&message=${encodeURIComponent(site.whisperMessage)}`;
        twiml += `<Dial action="${callStatusUrl}" method="POST">`;
        twiml += `<Number url="${whisperUrl}">${site.forwardToNumber}</Number>`;
        twiml += `</Dial>`;
      } else {
        // Direct mode: Simple forward
        twiml += `<Dial action="${callStatusUrl}" method="POST">`;
        twiml += `<Number>${site.forwardToNumber}</Number>`;
        twiml += `</Dial>`;
      }
    }

    twiml += '</Response>';

    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(twiml);
  } catch (err: any) {
    console.error("[twilio-voice] error:", err);
    return res.status(500).type("text/xml").send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error processing call</Say></Response>'
    );
  }
}

