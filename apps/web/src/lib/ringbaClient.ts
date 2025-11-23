/**
 * Ringba API Client
 * 
 * Client for searching and purchasing phone numbers via Ringba API.
 */

const RINGBA_API_TOKEN = process.env.RINGBA_API_TOKEN;
const RINGBA_ACCOUNT_ID = process.env.RINGBA_ACCOUNT_ID;

if (!RINGBA_API_TOKEN) {
  console.warn("[ringbaClient] Missing RINGBA_API_TOKEN; Ringba operations will fail.");
}

export type RingbaNumber = {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
};

/**
 * Search available phone numbers via Ringba API
 */
export async function searchRingbaNumbers(params: {
  areaCode?: string;
  country?: string;
}): Promise<RingbaNumber[]> {
  if (!RINGBA_API_TOKEN) {
    throw new Error("Ringba API token not configured");
  }

  // Ringba API endpoint (adjust based on actual Ringba API documentation)
  const baseUrl = "https://api.ringba.com/v2";
  const headers = {
    Authorization: `Bearer ${RINGBA_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  try {
    // Ringba API typically uses /numbers/search or similar endpoint
    // This is a placeholder implementation - adjust based on actual Ringba API docs
    const searchParams = new URLSearchParams();
    if (params.areaCode) {
      searchParams.append("areaCode", params.areaCode);
    }
    if (params.country) {
      searchParams.append("country", params.country);
    } else {
      searchParams.append("country", "US");
    }

    const url = `${baseUrl}/numbers/search?${searchParams.toString()}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ringba API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Adjust based on actual Ringba API response structure
    // This assumes an array of number objects with id, phoneNumber, friendlyName
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        id: item.id || item.numberId || item.phoneNumber,
        phoneNumber: item.phoneNumber || item.number,
        friendlyName: item.friendlyName || item.name,
      }));
    }

    // If response is wrapped in a data/numbers property
    if (data.numbers && Array.isArray(data.numbers)) {
      return data.numbers.map((item: any) => ({
        id: item.id || item.numberId || item.phoneNumber,
        phoneNumber: item.phoneNumber || item.number,
        friendlyName: item.friendlyName || item.name,
      }));
    }

    return [];
  } catch (err: any) {
    console.error("[ringbaClient] Search failed:", err);
    throw new Error(`Failed to search Ringba numbers: ${err.message}`);
  }
}

/**
 * Purchase/assign a phone number via Ringba API
 */
export async function buyRingbaNumber(params: {
  numberId: string;
}): Promise<RingbaNumber> {
  if (!RINGBA_API_TOKEN) {
    throw new Error("Ringba API token not configured");
  }

  const baseUrl = "https://api.ringba.com/v2";
  const headers = {
    Authorization: `Bearer ${RINGBA_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  try {
    // Ringba API endpoint for purchasing/assigning numbers
    // Adjust based on actual Ringba API documentation
    const url = `${baseUrl}/numbers/${params.numberId}/purchase`;
    
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        accountId: RINGBA_ACCOUNT_ID,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ringba API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    return {
      id: data.id || data.numberId || params.numberId,
      phoneNumber: data.phoneNumber || data.number,
      friendlyName: data.friendlyName || data.name,
    };
  } catch (err: any) {
    console.error("[ringbaClient] Purchase failed:", err);
    throw new Error(`Failed to purchase Ringba number: ${err.message}`);
  }
}
