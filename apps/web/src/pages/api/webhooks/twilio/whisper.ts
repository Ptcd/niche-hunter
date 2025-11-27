/**
 * GET /api/webhooks/twilio/whisper
 * 
 * Plays a whisper message to the agent before connecting the call.
 * This is called as a URL parameter in the <Number> tag.
 */

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const message = req.query.message as string || req.body.message as string || "New lead calling";

    // Return TwiML that plays the whisper message
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${message}</Say>
  <Pause length="1"/>
</Response>`;

    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(twiml);
  } catch (err: any) {
    console.error("[twilio-whisper] error:", err);
    res.setHeader("Content-Type", "text/xml");
    return res.status(500).send(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    );
  }
}

