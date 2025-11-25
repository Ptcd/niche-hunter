import { serve } from "inngest/next";
import { inngest } from "../../lib/inngest/client";
import { processBatch } from "../../lib/inngest/functions";

export default serve({
  client: inngest,
  functions: [processBatch],
});

