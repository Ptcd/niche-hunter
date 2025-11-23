/**
 * DataForSEO Labs API integration for bulk keyword difficulty
 * 
 * API Documentation: https://dataforseo.com/apis/google-keyword-difficulty-api
 * 
 * Configuration via environment variables:
 * - DATAFORSEO_LOGIN: Your DataForSEO username
 * - DATAFORSEO_PASSWORD: Your DataForSEO password
 */

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


