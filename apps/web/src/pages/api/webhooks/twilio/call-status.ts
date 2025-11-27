/**
 * POST /api/webhooks/twilio/call-status
 * 
 * Handles call status updates (optional - for logging/analytics).
 */

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // This is a callback endpoint - just acknowledge
  // In the future, we could log call duration, status, etc.
  return res.status(200).type("text/xml").send(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
  );
}

