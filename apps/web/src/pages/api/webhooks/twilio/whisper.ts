/**
 * GET /api/webhooks/twilio/whisper
 * 
 * Plays a whisper message to the agent before connecting the call.
 * This is called as a URL parameter in the <Number> tag.
 */

import type { NextApiRequest, NextApiResponse } from "next";

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
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // The url on <Number> is called when the call to that number is answered
    // Check CallStatus to ensure call is actually answered (not ringing)
    const callStatus = req.body.CallStatus || req.query.CallStatus;
    
    // Only play whisper if call is answered (or if status is not provided, assume answered since url is called on answer)
    // CallStatus can be: queued, ringing, in-progress, completed, busy, failed, no-answer, canceled
    // When url on Number is called, status should be "in-progress" (answered)
    if (callStatus && callStatus !== "in-progress" && callStatus !== "answered") {
      // Call not answered yet, return empty response
      res.setHeader("Content-Type", "text/xml");
      return res.status(200).send(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
      );
    }

    const rawMessage = req.query.message as string || req.body.message as string || "New lead calling";
    const message = escapeXml(rawMessage);

    // Return TwiML that plays the whisper message with a half-second pause before
    // This plays on the dialed leg (agent's side) when the call is answered
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="0.5"/>
  <Say voice="alice">${message}</Say>
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

