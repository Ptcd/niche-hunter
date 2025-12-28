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

// In-memory cache for local context (can be replaced with DB cache)
interface CachedContext {
  context: LocalContext;
  expiresAt: number;
}

const contextCache = new Map<string, CachedContext>();
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Get cache key for city/state
 */
function getCacheKey(city: string, state: string): string {
  return `${city.toLowerCase()}-${state.toLowerCase()}`;
}

/**
 * Check if cached context is still valid
 */
function isCacheValid(cached: CachedContext): boolean {
  return Date.now() < cached.expiresAt;
}

/**
 * Generate local context using LLM (cached per city/state)
 */
export async function generateLocalContext(
  targetCity: string,
  state: string,
  useDbForCities: boolean = true
): Promise<LocalContext> {
  const cacheKey = getCacheKey(targetCity, state);
  
  // Check cache first
  const cached = contextCache.get(cacheKey);
  if (cached && isCacheValid(cached)) {
    console.log(`[LocalContext] Using cached context for ${targetCity}, ${state}`);
    return cached.context;
  }

  // Try to get nearby cities from database first (if available)
  let nearbyCities: string[] = [];
  
  if (useDbForCities) {
    try {
      // TODO: Integrate with DB cache table when available
      // const dbCache = await prisma.localContextCache.findUnique({
      //   where: { cityState: cacheKey }
      // });
      // if (dbCache && !isExpired(dbCache)) {
      //   return dbCache.data as LocalContext;
      // }
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
  
  const context: LocalContext = {
    nearby_cities: nearbyCities,
    landmarks,
  };

  // Cache the result
  contextCache.set(cacheKey, {
    context,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  // TODO: Save to DB cache when available
  // await prisma.localContextCache.upsert({
  //   where: { cityState: cacheKey },
  //   create: { cityState: cacheKey, data: context, expiresAt: new Date(Date.now() + CACHE_TTL_MS) },
  //   update: { data: context, expiresAt: new Date(Date.now() + CACHE_TTL_MS) },
  // });

  return context;
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

