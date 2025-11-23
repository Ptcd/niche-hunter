/**
 * POST /api/twilio/voice
 * 
 * Twilio webhook handler for incoming voice calls.
 * Stub implementation - forwards calls to the configured number.
 */

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get the phone number that was called (from Twilio request)
    const calledNumber = req.body.Called || req.body.To;
    
    // Look up the site by twilioNumber to get forwardToNumber
    // For now, this is a stub - in production, you'd query the database
    // const site = await prisma.site.findUnique({ where: { twilioNumber: calledNumber } });
    // const forwardTo = site?.forwardToNumber || "+1234567890";

    // Return TwiML to forward the call
    // This is a stub - replace with actual forwardToNumber lookup
    const forwardTo = "+1234567890"; // Placeholder

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>${forwardTo}</Dial>
</Response>`;

    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(twiml);
  } catch (err: any) {
    console.error("[twilio-voice] error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}

