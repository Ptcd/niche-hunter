/**
 * WordPress UI Helpers
 * 
 * Client-side helper functions for triggering WordPress builds from React components.
 */

/**
 * Trigger a static test build (no GPT, just hard-coded test pages)
 */
export async function triggerWpTestBuild(): Promise<void> {
  const res = await fetch("/api/wp/test-build", {
    method: "POST",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Test build failed");
  }
  console.log("WP test build result:", data);
}

/**
 * Trigger a GPT-powered build with example data
 */
export async function triggerWpGptBuild() {
  const res = await fetch("/api/wp/build-site", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      niche: "hvac",
      city: "Wesley Chapel",
      state: "FL",
      keywords: ["hvac repair wesley chapel", "ac repair wesley chapel"],
      brand: {
        name: "Wesley Chapel HVAC Pros",
        phonePretty: "(813) 555-1234",
        phoneClean: "18135551234",
        email: "info@wchvacpros.com",
        city: "Wesley Chapel",
        state: "FL",
        logoUrl: "https://via.placeholder.com/300x80?text=HVAC+Logo",
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "GPT build failed");
  }
  console.log("WP GPT build result:", data);
}

