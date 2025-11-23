/**
 * POST /api/wp/test-build
 * 
 * Static test endpoint to verify WordPress integration.
 * Creates/updates a Home + Contact page with hard-coded test content.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { bootstrapSite, syncPages } from "../../../lib/wpFactoryClient";
import type { BrandSpec, PageSpec } from "../../../lib/wpFactoryTypes";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Temporary hard-coded brand for smoke test
    const brand: BrandSpec = {
      name: "Wesley Chapel HVAC Pros",
      phonePretty: "(813) 555-1234",
      phoneClean: "18135551234",
      email: "info@wchvacpros.com",
      city: "Wesley Chapel",
      state: "FL",
      logoUrl: "https://via.placeholder.com/300x80?text=HVAC+Logo",
    };

    // 1) Bootstrap site (title, phone, logo, etc.)
    await bootstrapSite(brand);

    // 2) Simple homepage + contact page
    const pages: PageSpec[] = [
      {
        type: "home",
        slug: "",
        title: "HVAC Repair in Wesley Chapel, FL | Wesley Chapel HVAC Pros",
        content: `
          <h1>HVAC Repair in Wesley Chapel, FL</h1>
          <p>This is a test homepage pushed from Niche Hunter to WordPress.</p>
          <p><a href="tel:${brand.phoneClean}" class="btn-primary">Call ${brand.phonePretty}</a></p>
          <p><a href="{{URL_CONTACT}}" class="btn-secondary">Go to Contact Page</a></p>
        `,
        seoTitle: "HVAC Repair in Wesley Chapel, FL | Test Site",
        seoDescription: "Test homepage for HVAC site built by Niche Hunter.",
        focusKeyword: "hvac repair wesley chapel",
      },
      {
        type: "contact",
        slug: "contact",
        title: "Contact Wesley Chapel HVAC Pros (Test)",
        content: `
          <h1>Contact Wesley Chapel HVAC Pros</h1>
          <p>This is a test contact page sent from Niche Hunter.</p>
          <p><strong>Phone:</strong> <a href="tel:${brand.phoneClean}">${brand.phonePretty}</a></p>
          <p><strong>Email:</strong> <a href="mailto:${brand.email}">${brand.email}</a></p>
        `,
        seoTitle: "Contact HVAC Contractor in Wesley Chapel, FL | Test",
        seoDescription: "Test contact page built by Niche Hunter.",
        focusKeyword: "contact hvac wesley chapel",
      },
    ];

    const wpResult = await syncPages(pages);

    return res.status(200).json({
      status: "ok",
      message: "Test pages sent to WordPress",
      wpResult,
    });
  } catch (err: any) {
    console.error("[test-build] error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}

