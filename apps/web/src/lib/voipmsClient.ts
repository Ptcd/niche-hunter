/**
 * VoIP.ms API Client
 * 
 * Client for listing phone numbers and fetching call detail records (CDRs).
 */

const VOIPMS_API_USER = process.env.VOIPMS_API_USER;
const VOIPMS_API_PASSWORD = process.env.VOIPMS_API_PASSWORD;
const VOIPMS_BASE_URL = 'https://voip.ms/api/v1/rest.php';

if (!VOIPMS_API_USER || !VOIPMS_API_PASSWORD) {
  console.warn('[voipmsClient] Missing VOIPMS_API_USER or VOIPMS_API_PASSWORD');
}

export interface VoipmsNumber {
  did: string; // phone number
  routing: string;
  pop: string;
  dialtime_seconds: number;
  billing_type: string;
}

export interface VoipmsCall {
  date: string;
  callerid: string;
  destination: string;
  description: string;
  duration: number; // seconds
  seconds_charged: number;
  rate: string;
  total: string;
}

/**
 * List all DIDs (phone numbers) on the account
 */
export async function listVoipmsNumbers(): Promise<VoipmsNumber[]> {
  if (!VOIPMS_API_USER || !VOIPMS_API_PASSWORD) {
    throw new Error('VoIP.ms API credentials not configured');
  }

  const params = new URLSearchParams({
    api_username: VOIPMS_API_USER,
    api_password: VOIPMS_API_PASSWORD,
    method: 'getDIDsInfo',
    client: '0', // all clients
  });

  try {
    const response = await fetch(`${VOIPMS_BASE_URL}?${params.toString()}`);
    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(`VoIP.ms API error: ${data.status} - ${data.error || 'Unknown error'}`);
    }

    return data.dids || [];
  } catch (error: any) {
    console.error('[voipmsClient] listVoipmsNumbers error:', error);
    throw new Error(`Failed to list VoIP.ms numbers: ${error.message}`);
  }
}

/**
 * Get call detail records (CDRs) for a specific DID
 */
export async function getVoipmsCalls(
  did: string,
  dateFrom: string, // YYYY-MM-DD
  dateTo: string
): Promise<VoipmsCall[]> {
  if (!VOIPMS_API_USER || !VOIPMS_API_PASSWORD) {
    throw new Error('VoIP.ms API credentials not configured');
  }

  const params = new URLSearchParams({
    api_username: VOIPMS_API_USER,
    api_password: VOIPMS_API_PASSWORD,
    method: 'getCallDetailRecords',
    date_from: dateFrom,
    date_to: dateTo,
    answered: '1', // only answered calls
    noanswer: '0',
    busy: '0',
    failed: '0',
  });

  try {
    const response = await fetch(`${VOIPMS_BASE_URL}?${params.toString()}`);
    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(`VoIP.ms API error: ${data.status} - ${data.error || 'Unknown error'}`);
    }

    // Filter to only calls TO this DID
    const allCalls = data.cdr || [];
    return allCalls.filter((call: any) => {
      const dest = call.destination || '';
      return dest.includes(did) || dest === did;
    });
  } catch (error: any) {
    console.error('[voipmsClient] getVoipmsCalls error:', error);
    throw new Error(`Failed to fetch VoIP.ms calls: ${error.message}`);
  }
}

