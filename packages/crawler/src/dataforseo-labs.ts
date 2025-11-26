/**
 * DataForSEO Labs API integration for bulk keyword difficulty
 * 
 * API Documentation: https://dataforseo.com/apis/google-keyword-difficulty-api
 * 
 * Configuration via environment variables:
 * - DATAFORSEO_LOGIN: Your DataForSEO username
 * - DATAFORSEO_PASSWORD: Your DataForSEO password
 */

// In-memory cache for location codes (city -> location_code)
const locationCodeCache = new Map<string, number>();

interface DataForSEOLocation {
  location_code: number;
  location_name: string;
  location_code_parent: number | null;
  country_iso_code: string;
  location_type: string;
}

interface DataForSEOLocationsResponse {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: any;
    result: DataForSEOLocation[];
  }>;
}

interface DataForSEOLabsResponse {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data?: {
      api: string;
      function: string;
      se_type: string;
      keywords: string[];
      keyword_difficulty?: number[];
      [key: string]: any;
    };
    result?: Array<{
      keyword?: string;
      keyword_difficulty?: number;
      keyword_difficulty_index?: number;
      difficulty?: number;
      kd?: number;
      [key: string]: any;
    }>;
  }>;
}

/**
 * Get DataForSEO credentials from environment
 */
function getDataForSEOCredentials(): { login: string; password: string } {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    throw new Error(
      'DataForSEO credentials not found. Please set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in your .env file.'
    );
  }

  return { login, password };
}

/**
 * Look up DataForSEO location code for a city
 * 
 * @param city City name (e.g., "Wesley Chapel")
 * @param state State name or abbreviation (e.g., "Florida" or "FL")
 * @param country Country code (default: "US")
 * @returns Location code or null if not found
 */
export async function getLocationCode(
  city: string,
  state: string,
  country: string = 'US'
): Promise<number | null> {
  // Normalize the cache key
  const cacheKey = `${city.toLowerCase()},${state.toLowerCase()},${country.toLowerCase()}`;
  
  // Check cache first
  if (locationCodeCache.has(cacheKey)) {
    return locationCodeCache.get(cacheKey)!;
  }

  const { login, password } = getDataForSEOCredentials();
  const baseUrl = 'https://api.dataforseo.com/v3/serp/google/locations';

  console.log(`[DataForSEO Locations] Looking up location code for: ${city}, ${state}, ${country}`);

  try {
    const response = await fetch(baseUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[DataForSEO Locations] HTTP Error ${response.status}:`, errorText.substring(0, 500));
      return null;
    }

    const data: DataForSEOLocationsResponse = await response.json();

    if (data.tasks && data.tasks.length > 0 && data.tasks[0].result) {
      const locations = data.tasks[0].result;
      
      // Normalize state name (handle abbreviations)
      const stateAbbreviations: Record<string, string> = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
        'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
        'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
        'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
        'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
        'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
        'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
        'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
        'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
        'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
        'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia',
      };
      
      const stateFull = stateAbbreviations[state.toUpperCase()] || state;
      
      // Search for exact city match within the state
      // DataForSEO location_name format: "City,State,United States"
      const cityLower = city.toLowerCase();
      const stateLower = stateFull.toLowerCase();
      
      for (const loc of locations) {
        if (loc.country_iso_code !== country) continue;
        if (loc.location_type !== 'City') continue;
        
        const nameParts = loc.location_name.toLowerCase().split(',').map(p => p.trim());
        if (nameParts.length >= 2) {
          const locCity = nameParts[0];
          const locState = nameParts[1];
          
          if (locCity === cityLower && locState === stateLower) {
            console.log(`[DataForSEO Locations] Found: ${loc.location_name} -> ${loc.location_code}`);
            locationCodeCache.set(cacheKey, loc.location_code);
            return loc.location_code;
          }
        }
      }
      
      // Try partial match (city name contains)
      for (const loc of locations) {
        if (loc.country_iso_code !== country) continue;
        if (loc.location_type !== 'City') continue;
        
        const nameLower = loc.location_name.toLowerCase();
        if (nameLower.includes(cityLower) && nameLower.includes(stateLower)) {
          console.log(`[DataForSEO Locations] Found (partial): ${loc.location_name} -> ${loc.location_code}`);
          locationCodeCache.set(cacheKey, loc.location_code);
          return loc.location_code;
        }
      }
      
      console.log(`[DataForSEO Locations] No match found for ${city}, ${state}`);
    }

    return null;
  } catch (error: any) {
    console.error(`[DataForSEO Locations] Error looking up location:`, error.message);
    return null;
  }
}

/**
 * Bulk lookup location codes for multiple cities
 * More efficient than calling getLocationCode for each city
 * 
 * @param cities Array of {city, state} objects
 * @param country Country code (default: "US")
 * @returns Map of "city,state" -> location_code
 */
export async function getBulkLocationCodes(
  cities: Array<{ city: string; state: string }>,
  country: string = 'US'
): Promise<Map<string, number>> {
  const { login, password } = getDataForSEOCredentials();
  const baseUrl = 'https://api.dataforseo.com/v3/serp/google/locations';
  const resultMap = new Map<string, number>();

  // Check cache first and collect cities that need lookup
  const citiesToLookup: Array<{ city: string; state: string; cacheKey: string }> = [];
  
  for (const { city, state } of cities) {
    const cacheKey = `${city.toLowerCase()},${state.toLowerCase()},${country.toLowerCase()}`;
    if (locationCodeCache.has(cacheKey)) {
      resultMap.set(`${city},${state}`, locationCodeCache.get(cacheKey)!);
    } else {
      citiesToLookup.push({ city, state, cacheKey });
    }
  }

  if (citiesToLookup.length === 0) {
    console.log(`[DataForSEO Locations] All ${cities.length} cities found in cache`);
    return resultMap;
  }

  console.log(`[DataForSEO Locations] Looking up ${citiesToLookup.length} cities (${resultMap.size} cached)`);

  try {
    const response = await fetch(baseUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[DataForSEO Locations] HTTP Error ${response.status}`);
      return resultMap;
    }

    const data: DataForSEOLocationsResponse = await response.json();

    if (data.tasks && data.tasks.length > 0 && data.tasks[0].result) {
      const locations = data.tasks[0].result;
      
      // Build a lookup map for faster searching
      const locationsByCity = new Map<string, DataForSEOLocation[]>();
      
      for (const loc of locations) {
        if (loc.country_iso_code !== country) continue;
        if (loc.location_type !== 'City') continue;
        
        const nameParts = loc.location_name.toLowerCase().split(',').map(p => p.trim());
        if (nameParts.length >= 1) {
          const cityName = nameParts[0];
          if (!locationsByCity.has(cityName)) {
            locationsByCity.set(cityName, []);
          }
          locationsByCity.get(cityName)!.push(loc);
        }
      }

      // State abbreviation map
      const stateAbbreviations: Record<string, string> = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
        'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
        'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
        'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
        'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
        'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
        'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
        'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
        'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
        'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
        'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia',
      };

      // Look up each city
      for (const { city, state, cacheKey } of citiesToLookup) {
        const cityLower = city.toLowerCase();
        const stateFull = stateAbbreviations[state.toUpperCase()] || state;
        const stateLower = stateFull.toLowerCase();
        
        const candidates = locationsByCity.get(cityLower) || [];
        
        for (const loc of candidates) {
          const nameParts = loc.location_name.toLowerCase().split(',').map(p => p.trim());
          if (nameParts.length >= 2 && nameParts[1] === stateLower) {
            resultMap.set(`${city},${state}`, loc.location_code);
            locationCodeCache.set(cacheKey, loc.location_code);
            break;
          }
        }
      }

      console.log(`[DataForSEO Locations] Found ${resultMap.size} location codes out of ${cities.length} cities`);
    }

    return resultMap;
  } catch (error: any) {
    console.error(`[DataForSEO Locations] Error in bulk lookup:`, error.message);
    return resultMap;
  }
}

/**
 * Get bulk keyword difficulty from DataForSEO Labs
 * Can fetch up to 1000 keywords at once
 * 
 * @param keywords Array of keywords to check
 * @param locationCode DataForSEO location code (default: 2840 for US)
 * @returns Map of keyword -> KD (0-100)
 */
export async function getBulkKeywordDifficulty(
  keywords: string[],
  locationCode: number = 2840 // US default
): Promise<Map<string, number>> {
  const { login, password } = getDataForSEOCredentials();
  const baseUrl = 'https://api.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live';
  
  // DataForSEO bulk_keyword_difficulty has a limit - use smaller batches
  const maxBatchSize = 100; // Reduced from 1000 to avoid API limits
  const resultMap = new Map<string, number>();

  // Process in batches of 100
  for (let i = 0; i < keywords.length; i += maxBatchSize) {
    const batch = keywords.slice(i, i + maxBatchSize);

    // DataForSEO expects an array in the POST body, not wrapped in an object
    const requestBody = [
      {
        keywords: batch,
        location_code: locationCode,
        language_code: 'en',
      },
    ];

    console.log(`[DataForSEO Labs] Fetching KD for ${batch.length} keywords (batch ${Math.floor(i / maxBatchSize) + 1})`);
    console.log(`[DataForSEO Labs] Request URL: ${baseUrl}`);
    console.log(`[DataForSEO Labs] Request body:`, JSON.stringify(requestBody).substring(0, 500));
    console.log(`[DataForSEO Labs] Location code: ${locationCode}, Type: ${typeof locationCode}`);
    console.log(`[DataForSEO Labs] Sample keywords:`, batch.slice(0, 3));

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error(`[DataForSEO Labs] HTTP Error ${response.status}:`, errorText.substring(0, 1000));
        throw new Error(
          `DataForSEO Labs API error (${response.status}): ${errorText.substring(0, 500)}`
        );
      }

      const data: DataForSEOLabsResponse = await response.json();

      console.log(`[DataForSEO Labs] Response status:`, data.status_message || data.status_code);
      console.log(`[DataForSEO Labs] Tasks count: ${data.tasks_count}, Tasks error: ${data.tasks_error}`);
      
      // Log task errors if any
      if (data.tasks && data.tasks.length > 0) {
        for (const task of data.tasks) {
          if (task.status_code !== 20000) {
            console.error(`[DataForSEO Labs] Task error ${task.status_code}: ${task.status_message}`);
            console.error(`[DataForSEO Labs] Task path:`, task.path);
            if (task.data) {
              console.error(`[DataForSEO Labs] Task data:`, JSON.stringify(task.data).substring(0, 500));
            }
          }
        }
      }
      
      // Parse response - DataForSEO returns array of task results
      if (data.tasks && data.tasks.length > 0) {
        const task = data.tasks[0];
        
        // Log full task structure for debugging (first 5000 chars)
        console.log(`[DataForSEO Labs] Full task structure:`, JSON.stringify(task, null, 2).substring(0, 5000));
        
        // Check if data is in task.data.keywords + task.data.keyword_difficulty arrays
        if (task.data && task.data.keywords && Array.isArray(task.data.keywords)) {
          const keywordsArray = task.data.keywords;
          const difficultyArray = task.data.keyword_difficulty || task.data.difficulty || task.data.kd;
          
          console.log(`[DataForSEO Labs] Found ${keywordsArray.length} keywords in data.keywords`);
          console.log(`[DataForSEO Labs] Difficulty array type:`, Array.isArray(difficultyArray) ? 'array' : typeof difficultyArray);
          if (difficultyArray) {
            console.log(`[DataForSEO Labs] Difficulty array sample:`, JSON.stringify(difficultyArray).substring(0, 500));
          }
          
          if (Array.isArray(difficultyArray) && difficultyArray.length === keywordsArray.length) {
            // Match by index
            for (let j = 0; j < keywordsArray.length; j++) {
              const keyword = keywordsArray[j];
              const kd = difficultyArray[j];
              if (keyword && typeof kd === 'number') {
                resultMap.set(keyword, Math.round(kd));
                if (j < 3) console.log(`[DataForSEO Labs] Matched: "${keyword}" -> KD: ${kd}`);
              }
            }
          } else if (typeof difficultyArray === 'number' && keywordsArray.length === 1) {
            // Single keyword result
            resultMap.set(keywordsArray[0], Math.round(difficultyArray));
          }
        }
        
        // Check if data is in task.result array (bulk_keyword_difficulty returns items array)
        if (task.result && Array.isArray(task.result) && task.result.length > 0) {
          console.log(`[DataForSEO Labs] Found ${task.result.length} results in task.result`);
          
          const firstResult = task.result[0];
          console.log(`[DataForSEO Labs] First result structure:`, JSON.stringify(firstResult, null, 2).substring(0, 3000));
          
          // Check if result has items array (common in DataForSEO bulk APIs)
          if (firstResult.items && Array.isArray(firstResult.items)) {
            console.log(`[DataForSEO Labs] Found ${firstResult.items.length} items in result.items`);
            for (const item of firstResult.items) {
              // Try multiple possible field names for keyword
              const keyword = item.keyword || item.key || item.target || item.query;
              // Try multiple possible field names for KD
              const kd = item.keyword_difficulty || item.difficulty || item.kd || item.keyword_difficulty_index || item.se_difficulty;
              
              if (keyword && typeof kd === 'number') {
                resultMap.set(keyword, Math.round(kd));
                if (resultMap.size <= 3) console.log(`[DataForSEO Labs] Matched (items array): "${keyword}" -> KD: ${kd}`);
              } else {
                if (resultMap.size === 0 && firstResult.items.indexOf(item) < 3) {
                  console.log(`[DataForSEO Labs] Item structure:`, JSON.stringify(item, null, 2).substring(0, 500));
                  console.log(`[DataForSEO Labs] Skipping item - keyword: ${keyword}, kd: ${kd}, kd type: ${typeof kd}`);
                }
              }
            }
          }
          
          // Also check if result itself has keyword/difficulty fields (for single result format)
          if (resultMap.size === 0) {
            for (const item of task.result) {
              // Try multiple possible field names for keyword
              const keyword = item.keyword || item.key || item.target || item.query;
              // Try multiple possible field names for KD
              const kd = item.keyword_difficulty || item.difficulty || item.kd || item.keyword_difficulty_index || item.se_difficulty;
              
              if (keyword && typeof kd === 'number') {
                resultMap.set(keyword, Math.round(kd));
                console.log(`[DataForSEO Labs] Matched (result array): "${keyword}" -> KD: ${kd}`);
              } else {
                // Log first few items for debugging
                if (task.result.indexOf(item) < 3) {
                  console.log(`[DataForSEO Labs] Result item keys:`, Object.keys(item));
                  console.log(`[DataForSEO Labs] Result item sample:`, JSON.stringify(item, null, 2).substring(0, 500));
                }
              }
            }
          }
        }
        
        // If no results found, log the structure for debugging
        if (resultMap.size === 0) {
          console.log(`[DataForSEO Labs] No results parsed. Full task structure:`, JSON.stringify(task, null, 2).substring(0, 5000));
        }
      } else {
        console.log(`[DataForSEO Labs] No tasks in response`);
      }

      console.log(`[DataForSEO Labs] Successfully parsed ${resultMap.size} KD values from ${batch.length} keywords`);
    } catch (error: any) {
      console.error(`[DataForSEO Labs] Error fetching KD for batch:`, error.message);
      // Continue with next batch, but log the error
      throw error;
    }
  }

  return resultMap;
}

/**
 * Get keyword suggestions for a seed keyword
 * 
 * @param seed Seed keyword to get suggestions for
 * @param locationCode DataForSEO location code (default: 2840 for US)
 * @returns Array of related keywords with volume and KD
 */
export async function getKeywordSuggestions(
  seed: string,
  locationCode: number = 2840
): Promise<Array<{ keyword: string; volume: number; kd: number }>> {
  const { login, password } = getDataForSEOCredentials();
  const baseUrl = 'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live';

  const requestBody = {
    data: [
      {
        keyword: seed,
        location_code: locationCode,
        language_code: 'en',
        limit: 100,
      },
    ],
  };

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(
        `DataForSEO Labs API error (${response.status}): ${errorText.substring(0, 500)}`
      );
    }

    const data: DataForSEOLabsResponse = await response.json();

    if (data.tasks && data.tasks.length > 0 && data.tasks[0].result) {
      const results = Array.isArray(data.tasks[0].result) 
        ? data.tasks[0].result 
        : [data.tasks[0].result];

      return results
        .map((item: any) => ({
          keyword: item.keyword || item.key || '',
          volume: item.search_volume || item.volume || 0,
          kd: item.keyword_difficulty || item.difficulty || item.kd || 0,
        }))
        .filter((item: any) => item.keyword && item.volume > 0);
    }

    return [];
  } catch (error: any) {
    console.error(`[DataForSEO Labs] Error fetching keyword suggestions:`, error.message);
    throw error;
  }
}


