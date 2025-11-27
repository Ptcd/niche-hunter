/**
 * Namecheap API Client
 * 
 * Client for checking domain availability and registering domains via Namecheap XML API.
 * 
 * Uses a proxy on Cloudways to handle Namecheap's IP whitelist requirement.
 * The proxy forwards requests from Vercel (dynamic IPs) through Cloudways (static IP).
 */

const NAMECHEAP_API_USER = process.env.NAMECHEAP_API_USER;
const NAMECHEAP_API_KEY = process.env.NAMECHEAP_API_KEY;
const NAMECHEAP_USERNAME = process.env.NAMECHEAP_USERNAME || process.env.NAMECHEAP_API_USER;
const NAMECHEAP_CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP;

// Proxy configuration for routing through Cloudways
const NAMECHEAP_PROXY_URL = process.env.NAMECHEAP_PROXY_URL; // e.g., https://your-cloudways.com/namecheap-proxy.php
const NAMECHEAP_PROXY_SECRET = process.env.NAMECHEAP_PROXY_SECRET;

// Check if we're using proxy mode or direct mode
const USE_PROXY = !!NAMECHEAP_PROXY_URL && !!NAMECHEAP_PROXY_SECRET;

if (!USE_PROXY && (!NAMECHEAP_API_USER || !NAMECHEAP_API_KEY || !NAMECHEAP_CLIENT_IP)) {
  console.warn("[namecheapClient] Missing Namecheap env vars; domain operations will fail.");
}

const NAMECHEAP_API_URL = "https://api.namecheap.com/xml.response";

interface NamecheapResponse {
  ApiResponse: {
    Status: string;
    Errors?: {
      Error: string | Array<{ $: { Number: string }; _: string }>;
    };
    CommandResponse?: {
      DomainCheckResult?: {
        $: { Domain: string; Available: string; IsPremiumName?: string; PremiumRegistrationPrice?: string };
      } | Array<{
        $: { Domain: string; Available: string; IsPremiumName?: string; PremiumRegistrationPrice?: string };
      }>;
      DomainCreateResult?: {
        $: { Domain: string; Registered: string; ChargedAmount: string; DomainID: string };
      };
    };
  };
}

/**
 * Make a request to Namecheap API (either directly or through proxy)
 */
async function makeNamecheapRequest(params: URLSearchParams): Promise<string> {
  if (USE_PROXY) {
    // Route through Cloudways proxy
    const response = await fetch(NAMECHEAP_PROXY_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Proxy-Secret': NAMECHEAP_PROXY_SECRET!,
      },
      body: params.toString(),
    });
    
    if (!response.ok) {
      throw new Error(`Proxy request failed: ${response.status} ${response.statusText}`);
    }
    
    return response.text();
  } else {
    // Direct request to Namecheap (requires whitelisted IP)
    const response = await fetch(`${NAMECHEAP_API_URL}?${params.toString()}`);
    return response.text();
  }
}

/**
 * Check domain availability via Namecheap API
 */
export async function checkDomainAvailability(
  domain: string
): Promise<"available" | "taken" | "error"> {
  // Check credentials based on mode
  if (USE_PROXY) {
    if (!NAMECHEAP_PROXY_URL || !NAMECHEAP_PROXY_SECRET) {
      throw new Error("Namecheap proxy not configured");
    }
  } else {
    if (!NAMECHEAP_API_USER || !NAMECHEAP_API_KEY || !NAMECHEAP_CLIENT_IP) {
      throw new Error("Namecheap API credentials not configured");
    }
  }

  // Clean domain (remove protocol, www, etc.)
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();

  const params = new URLSearchParams({
    ApiUser: NAMECHEAP_API_USER || '',
    ApiKey: NAMECHEAP_API_KEY || '',
    UserName: NAMECHEAP_USERNAME || NAMECHEAP_API_USER || '',
    Command: "namecheap.domains.check",
    ClientIp: NAMECHEAP_CLIENT_IP || '',
    DomainList: cleanDomain,
  });

  try {
    const text = await makeNamecheapRequest(params);

    // Parse XML response (simplified - in production, use proper XML parser)
    const availableMatch = text.match(/Available="(true|false)"/);
    if (availableMatch) {
      return availableMatch[1] === "true" ? "available" : "taken";
    }

    // Check for errors
    if (text.includes("<Error>")) {
      console.error("[namecheapClient] API error:", text);
      return "error";
    }

    return "error";
  } catch (err: any) {
    console.error("[namecheapClient] Request failed:", err);
    return "error";
  }
}

/**
 * Register a domain via Namecheap API
 */
export async function registerDomain(
  domain: string,
  years: number = 1,
  contactInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  }
): Promise<{ success: boolean; raw: any }> {
  // Check credentials based on mode
  if (USE_PROXY) {
    if (!NAMECHEAP_PROXY_URL || !NAMECHEAP_PROXY_SECRET) {
      throw new Error("Namecheap proxy not configured");
    }
  } else {
    if (!NAMECHEAP_API_USER || !NAMECHEAP_API_KEY || !NAMECHEAP_CLIENT_IP) {
      throw new Error("Namecheap API credentials not configured");
    }
  }

  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();

  const params = new URLSearchParams({
    ApiUser: NAMECHEAP_API_USER || '',
    ApiKey: NAMECHEAP_API_KEY || '',
    UserName: NAMECHEAP_USERNAME || NAMECHEAP_API_USER || '',
    Command: "namecheap.domains.create",
    ClientIp: NAMECHEAP_CLIENT_IP || '',
    DomainName: cleanDomain,
    Years: years.toString(),
    // Contact info (simplified - Namecheap requires multiple contact types)
    RegistrantFirstName: contactInfo.firstName,
    RegistrantLastName: contactInfo.lastName,
    RegistrantEmailAddress: contactInfo.email,
    RegistrantPhone: contactInfo.phone,
    RegistrantAddress1: contactInfo.address1,
    RegistrantCity: contactInfo.city,
    RegistrantStateProvince: contactInfo.state,
    RegistrantPostalCode: contactInfo.zip,
    RegistrantCountry: contactInfo.country,
    // Use same for Admin, Tech, AuxBilling (Namecheap requirement)
    AdminFirstName: contactInfo.firstName,
    AdminLastName: contactInfo.lastName,
    AdminEmailAddress: contactInfo.email,
    AdminPhone: contactInfo.phone,
    AdminAddress1: contactInfo.address1,
    AdminCity: contactInfo.city,
    AdminStateProvince: contactInfo.state,
    AdminPostalCode: contactInfo.zip,
    AdminCountry: contactInfo.country,
    TechFirstName: contactInfo.firstName,
    TechLastName: contactInfo.lastName,
    TechEmailAddress: contactInfo.email,
    TechPhone: contactInfo.phone,
    TechAddress1: contactInfo.address1,
    TechCity: contactInfo.city,
    TechStateProvince: contactInfo.state,
    TechPostalCode: contactInfo.zip,
    TechCountry: contactInfo.country,
    AuxBillingFirstName: contactInfo.firstName,
    AuxBillingLastName: contactInfo.lastName,
    AuxBillingEmailAddress: contactInfo.email,
    AuxBillingPhone: contactInfo.phone,
    AuxBillingAddress1: contactInfo.address1,
    AuxBillingCity: contactInfo.city,
    AuxBillingStateProvince: contactInfo.state,
    AuxBillingPostalCode: contactInfo.zip,
    AuxBillingCountry: contactInfo.country,
  });

  try {
    const text = await makeNamecheapRequest(params);

    // Check for success
    if (text.includes('Registered="true"')) {
      return { success: true, raw: text };
    }

    // Check for errors
    if (text.includes("<Error>")) {
      console.error("[namecheapClient] Registration error:", text);
      return { success: false, raw: text };
    }

    return { success: false, raw: text };
  } catch (err: any) {
    console.error("[namecheapClient] Registration request failed:", err);
    return { success: false, raw: err.message };
  }
}

