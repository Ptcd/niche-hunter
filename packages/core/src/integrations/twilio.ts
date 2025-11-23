/**
 * Twilio Integration
 * 
 * Functions for searching and purchasing phone numbers.
 */

import twilio from 'twilio';

let twilioClient: twilio.Twilio | null = null;

/**
 * Get Twilio client
 */
function getTwilioClient(): twilio.Twilio {
  if (twilioClient) {
    return twilioClient;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
  }

  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

/**
 * Search for available phone numbers
 */
export async function searchAvailableNumbers(
  areaCode?: string,
  state?: string,
  country: string = 'US'
): Promise<Array<{
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
}>> {
  const client = getTwilioClient();

  try {
    let numbers;
    
    if (areaCode) {
      numbers = await client.availablePhoneNumbers(country)
        .local
        .list({ areaCode: parseInt(areaCode), limit: 20 });
    } else if (state) {
      // Map state to area code (simplified - in production, use a proper mapping)
      numbers = await client.availablePhoneNumbers(country)
        .local
        .list({ inRegion: state, limit: 20 });
    } else {
      numbers = await client.availablePhoneNumbers(country)
        .local
        .list({ limit: 20 });
    }

    return numbers.map(num => ({
      phoneNumber: num.phoneNumber || '',
      friendlyName: num.friendlyName || '',
      locality: num.locality,
      region: num.region,
    }));
  } catch (error: any) {
    throw new Error(`Twilio API error: ${error.message}`);
  }
}

/**
 * Purchase a phone number
 */
export async function purchasePhoneNumber(phoneNumber: string): Promise<{
  phoneNumber: string;
  sid: string;
}> {
  const client = getTwilioClient();

  try {
    const incomingPhoneNumber = await client.incomingPhoneNumbers.create({
      phoneNumber,
    });

    return {
      phoneNumber: incomingPhoneNumber.phoneNumber || phoneNumber,
      sid: incomingPhoneNumber.sid,
    };
  } catch (error: any) {
    throw new Error(`Failed to purchase number: ${error.message}`);
  }
}

/**
 * Release a phone number
 */
export async function releasePhoneNumber(phoneNumberSid: string): Promise<void> {
  const client = getTwilioClient();

  try {
    await client.incomingPhoneNumbers(phoneNumberSid).remove();
  } catch (error: any) {
    throw new Error(`Failed to release number: ${error.message}`);
  }
}

