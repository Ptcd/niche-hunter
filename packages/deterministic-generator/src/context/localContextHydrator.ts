/**
 * Local Context Hydrator
 * 
 * Generates nearby cities and landmarks for a target city/state
 * Uses LLM to extract real, well-known locations
 */

import OpenAI from 'openai';
import { LocalContext } from '../types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate local context using LLM (cached per city/state)
 */
export async function generateLocalContext(
  targetCity: string,
  state: string,
  useDbForCities: boolean = true
): Promise<LocalContext> {
  // Try to get nearby cities from database first (if available)
  let nearbyCities: string[] = [];
  
  if (useDbForCities) {
    try {
      // This requires a cityId - we'd need to look it up
      // For now, we'll use LLM for both
      // TODO: Integrate with geo-utils when cityId is available
    } catch (error) {
      // Fall back to LLM
    }
  }
  
  // Generate via LLM if DB lookup not available
  if (nearbyCities.length === 0) {
    nearbyCities = await generateNearbyCitiesViaLLM(targetCity, state);
  }
  
  // Always generate landmarks via LLM (they're city-specific)
  const landmarks = await generateLandmarksViaLLM(targetCity, state);
  
  return {
    nearby_cities: nearbyCities,
    landmarks,
  };
}

/**
 * Generate nearby cities using LLM
 */
async function generateNearbyCitiesViaLLM(targetCity: string, state: string): Promise<string[]> {
  const prompt = `You are a geographic data extractor.

Task: produce nearby cities for the given U.S. city.

ABSOLUTE RULES:
- Output JSON only (no markdown, no commentary)
- Do NOT write descriptions
- Do NOT invent places
- Only include commonly known real cities
- Nearby cities must be within ~25 miles of the target city
- Max 6 nearby cities
- Avoid duplicates and avoid the target city appearing in nearby_cities

INPUT:
Target City: ${targetCity}
State: ${state}

OUTPUT FORMAT:
{
  "nearby_cities": []
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a geographic data extractor. Output only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    
    if (Array.isArray(parsed.nearby_cities)) {
      return parsed.nearby_cities.slice(0, 6);
    }
    
    return [];
  } catch (error) {
    console.error('Error generating nearby cities:', error);
    return [];
  }
}

/**
 * Generate landmarks using LLM
 */
async function generateLandmarksViaLLM(targetCity: string, state: string): Promise<string[]> {
  const prompt = `You are a geographic data extractor.

Task: produce well-known public landmarks for the given U.S. city.

ABSOLUTE RULES:
- Output JSON only (no markdown, no commentary)
- Do NOT write descriptions
- Do NOT invent places
- Only include commonly known real locations
- Landmarks must be public and well-known and in/near the target city
- Max 4 landmarks
- Avoid duplicates

INPUT:
Target City: ${targetCity}
State: ${state}

OUTPUT FORMAT:
{
  "landmarks": []
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a geographic data extractor. Output only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    
    if (Array.isArray(parsed.landmarks)) {
      return parsed.landmarks.slice(0, 4);
    }
    
    return [];
  } catch (error) {
    console.error('Error generating landmarks:', error);
    return [];
  }
}

