/**
 * Brand Builder Utilities
 * 
 * Utilities for converting Site records to BrandSpec and formatting phone numbers.
 */

import type { BrandSpec } from "./wpFactoryTypes";

/**
 * Format phone number to pretty format: "(813) 555-1234"
 */
export function formatPhonePretty(phone: string | null | undefined): string {
  if (!phone) return "";
  
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, "");
  
  // Format US numbers (10 digits)
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // Format with country code (11 digits starting with 1)
  if (cleaned.length === 11 && cleaned[0] === "1") {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  // Return as-is if doesn't match expected format
  return phone;
}

/**
 * Clean phone number to digits only: "18135551234"
 */
export function cleanPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

/**
 * Build BrandSpec from Site record
 */
export function buildBrandSpec(site: {
  siteName: string | null;
  city: string;
  state: string;
  email: string | null;
  domain: string | null;
  trackingNumber: string | null;
  twilioNumber: string | null; // Legacy field
  forwardToNumber: string | null;
  logoUrl: string | null;
}): BrandSpec {
  // Use trackingNumber as primary source, fallback to legacy fields for backward compatibility
  const tracking = site.trackingNumber || site.twilioNumber || site.forwardToNumber || "";
  
  return {
    name: site.siteName || `${site.city} Service`,
    phonePretty: formatPhonePretty(tracking),
    phoneClean: cleanPhone(tracking),
    email: site.email || `info@${site.domain || "example.com"}`,
    city: site.city,
    state: site.state,
    logoUrl: site.logoUrl || undefined,
  };
}

