/**
 * Twilio API Client
 * 
 * Client for searching and purchasing phone numbers via Twilio.
 */

import twilio from "twilio";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_DEFAULT_COUNTRY = process.env.TWILIO_DEFAULT_COUNTRY || "US";

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.warn("[twilioClient] Missing Twilio env vars; phone operations will fail.");
}

const client = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
  ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

export interface PhoneNumber {
  phoneNumber: string;
  friendlyName: string;
}

/**
 * Search available phone numbers by area code
 */
export async function searchPhoneNumbers(areaCode: string): Promise<PhoneNumber[]> {
  if (!client) {
    throw new Error("Twilio client not configured");
  }

  try {
    const availableNumbers = await client.availablePhoneNumbers(TWILIO_DEFAULT_COUNTRY)
      .local.list({
        areaCode: parseInt(areaCode, 10),
        limit: 20,
      });

    return availableNumbers.map((number: any) => ({
      phoneNumber: number.phoneNumber || "",
      friendlyName: number.friendlyName || number.phoneNumber || "",
    }));
  } catch (err: any) {
    console.error("[twilioClient] Search failed:", err);
    throw new Error(`Failed to search phone numbers: ${err.message}`);
  }
}

/**
 * Search available phone numbers by multiple area codes
 * Returns numbers prioritized by the order of area codes provided
 */
export async function searchPhoneNumbersByAreaCodes(
  areaCodes: string[],
  limit: number = 10
): Promise<PhoneNumber[]> {
  if (!client) {
    throw new Error("Twilio client not configured");
  }

  if (!areaCodes || areaCodes.length === 0) {
    return [];
  }

  const allNumbers: PhoneNumber[] = [];
  const numbersPerAreaCode = Math.ceil(limit / areaCodes.length);

  try {
    // Search each area code and combine results
    for (const areaCode of areaCodes) {
      if (allNumbers.length >= limit) {
        break;
      }

      try {
        const availableNumbers = await client.availablePhoneNumbers(TWILIO_DEFAULT_COUNTRY)
          .local.list({
            areaCode: parseInt(areaCode, 10),
            limit: numbersPerAreaCode,
          });

        if (availableNumbers && availableNumbers.length > 0) {
          const mapped = availableNumbers.map((number: any) => ({
            phoneNumber: number.phoneNumber || "",
            friendlyName: number.friendlyName || number.phoneNumber || "",
          }));
          allNumbers.push(...mapped);
        }
      } catch (err: any) {
        // Log but continue with other area codes
        console.warn(`[twilioClient] Area code ${areaCode} search failed:`, err.message);
      }
    }

    // Return up to the requested limit, maintaining priority order
    return allNumbers.slice(0, limit);
  } catch (err: any) {
    console.error("[twilioClient] Area code search failed:", err);
    return [];
  }
}

/**
 * Search available phone numbers by city and state (location-based)
 * Falls back to area code search if location search returns no results
 */
export async function searchPhoneNumbersByLocation(
  city: string,
  state: string,
  limit: number = 10
): Promise<PhoneNumber[]> {
  if (!client) {
    throw new Error("Twilio client not configured");
  }

  try {
    // First, try location-based search
    const availableNumbers = await client.availablePhoneNumbers(TWILIO_DEFAULT_COUNTRY)
      .local.list({
        inLocality: city,
        inRegion: state,
        limit,
      });

    if (availableNumbers && availableNumbers.length > 0) {
      return availableNumbers.map((number: any) => ({
        phoneNumber: number.phoneNumber || "",
        friendlyName: number.friendlyName || number.phoneNumber || "",
      }));
    }

    // If no results, try searching by state only
    const stateNumbers = await client.availablePhoneNumbers(TWILIO_DEFAULT_COUNTRY)
      .local.list({
        inRegion: state,
        limit,
      });

    if (stateNumbers && stateNumbers.length > 0) {
      return stateNumbers.map((number: any) => ({
        phoneNumber: number.phoneNumber || "",
        friendlyName: number.friendlyName || number.phoneNumber || "",
      }));
    }

    // If still no results, return empty array
    return [];
  } catch (err: any) {
    console.error("[twilioClient] Location search failed:", err);
    // Don't throw - return empty array so UI can show fallback
    return [];
  }
}

/**
 * Purchase and configure a phone number
 */
export async function buyPhoneNumber(
  phoneNumber: string,
  voiceWebhookUrl: string
): Promise<{ sid: string; phoneNumber: string }> {
  if (!client) {
    throw new Error("Twilio client not configured");
  }

  try {
    // Purchase the number
    const incomingPhoneNumber = await client.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl: voiceWebhookUrl,
      voiceMethod: "POST",
    });

    return {
      sid: incomingPhoneNumber.sid,
      phoneNumber: incomingPhoneNumber.phoneNumber || phoneNumber,
    };
  } catch (err: any) {
    console.error("[twilioClient] Purchase failed:", err);
    throw new Error(`Failed to purchase phone number: ${err.message}`);
  }
}

