import { serve } from "inngest/next";
import { inngest } from "../../lib/inngest/client";
import { processBatch } from "../../lib/inngest/functions";

// Serve Inngest functions - this endpoint handles:
// - Function registration/discovery (GET)
// - Function execution (POST)
export default serve({
  client: inngest,
  functions: [processBatch],
  // Explicitly set the serve path for pages router
  servePath: "/api/inngest",
});

