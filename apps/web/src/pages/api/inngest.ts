import { serve } from "inngest/next";
import { inngest } from "../../lib/inngest/client";
import { processBatch } from "../../lib/inngest/functions";

// Get the base URL - use custom domain in production
const getBaseUrl = () => {
  // Check for explicit host override first
  if (process.env.INNGEST_SERVE_HOST) {
    return process.env.INNGEST_SERVE_HOST;
  }
  // Use custom domain in production
  if (process.env.NODE_ENV === "production") {
    return "https://app.cudahyjunkcarremoval.com";
  }
  // Fallback for local dev
  return process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : "http://localhost:3000";
};

// Serve Inngest functions - this endpoint handles:
// - Function registration/discovery (GET)
// - Function execution (POST)
export default serve({
  client: inngest,
  functions: [processBatch],
  // Explicitly set the serve path and base URL
  servePath: "/api/inngest",
  baseUrl: getBaseUrl(),
});

