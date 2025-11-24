/**
 * DataForSEO SERP API integration for organic and local pack results
 * 
 * API Documentation: https://dataforseo.com/apis/google-serp-api
 * 
 * Configuration via environment variables:
 * - DATAFORSEO_LOGIN: Your DataForSEO username
 * - DATAFORSEO_PASSWORD: Your DataForSEO password
 */

// Re-export types from core to maintain backward compatibility
export type { OrganicResult, LocalBusiness } from '@niche-hunter/core';

interface DataForSEOSERPResponse {
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
    result?: Array<{
      items?: Array<{
        type: string;
        title?: string;
        url?: string;
        domain?: string;
        snippet?: string;
        rank_group?: number;
        rank_absolute?: number;
        // Local pack fields
        title_highlighted?: string;
        address?: string;
        rating?: {
          rating_type: string;
          value: number;
          votes_count: number;
        };
        category?: string;
        website?: string;
        [key: string]: any;
      }>;
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
 * Get organic SERP results from DataForSEO
 * 
 * @param keyword Search query
 * @param locationName Location name (e.g., "Milwaukee, Wisconsin, United States") - used for logging only
 * @param locationCode Optional location code (default: 2840 for US)
 * @returns Array of top 10 organic results
 */
export async function getOrganicSERP(
  keyword: string,
  locationName: string,
  locationCode: number = 2840 // Default to US
): Promise<OrganicResult[]> {
  const { login, password } = getDataForSEOCredentials();
  const baseUrl = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced';

  // DataForSEO SERP API requires location_code (numeric), not location_name
  const requestBody = [
    {
      keyword,
      location_code: locationCode,
      language_code: 'en',
      device: 'desktop',
      depth: 10,
    },
  ];

  console.log(`[DataForSEO SERP] Fetching organic results for: "${keyword}"`);
  console.log(`[DataForSEO SERP] Location: ${locationName} (code: ${locationCode})`);
  console.log(`[DataForSEO SERP] Request body:`, JSON.stringify(requestBody));

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`[DataForSEO SERP] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[DataForSEO SERP] HTTP Error:`, errorText.substring(0, 1000));
      throw new Error(
        `DataForSEO SERP API error (${response.status}): ${errorText.substring(0, 500)}`
      );
    }

    const data: DataForSEOSERPResponse = await response.json();
    console.log(`[DataForSEO SERP] Response:`, JSON.stringify(data).substring(0, 1500));

    if (data.tasks && data.tasks.length > 0 && data.tasks[0].result) {
      const results = Array.isArray(data.tasks[0].result) 
        ? data.tasks[0].result 
        : [data.tasks[0].result];

      const organicResults: OrganicResult[] = [];

      for (const result of results) {
        if (result.items && Array.isArray(result.items)) {
          for (const item of result.items) {
            // Only process organic results (type: "organic")
            if (item.type === 'organic' && item.url && item.title) {
              // Extract domain from URL
              let domain = item.domain || '';
              if (!domain && item.url) {
                try {
                  const urlObj = new URL(item.url);
                  domain = urlObj.hostname.replace('www.', '');
                } catch {
                  // Invalid URL, skip
                  continue;
                }
              }

              organicResults.push({
                domain,
                url: item.url,
                title: item.title,
                snippet: item.snippet || '',
                position: item.rank_absolute || item.rank_group || organicResults.length + 1,
              });
            }
          }
        }
      }

      // Sort by position and limit to top 10
      return organicResults
        .sort((a, b) => a.position - b.position)
        .slice(0, 10);
    }

    return [];
  } catch (error: any) {
    console.error(`[DataForSEO SERP] Error fetching organic results:`, error.message);
    throw error;
  }
}

/**
 * Get local pack / maps results from DataForSEO
 * 
 * @param keyword Search query
 * @param locationName Location name (e.g., "Milwaukee, Wisconsin, United States") - used for logging only
 * @param locationCode Optional location code (default: 2840 for US)
 * @returns Array of local pack businesses
 */
export async function getMapsSERP(
  keyword: string,
  locationName: string,
  locationCode: number = 2840 // Default to US
): Promise<LocalBusiness[]> {
  const { login, password } = getDataForSEOCredentials();
  const baseUrl = 'https://api.dataforseo.com/v3/serp/google/maps/live/advanced';

  // DataForSEO SERP API requires location_code (numeric), not location_name
  const requestBody = [
    {
      keyword,
      location_code: locationCode,
      language_code: 'en',
      device: 'desktop',
      depth: 10,
    },
  ];

  console.log(`[DataForSEO Maps] Fetching local pack for: "${keyword}"`);
  console.log(`[DataForSEO Maps] Location: ${locationName} (code: ${locationCode})`);
  console.log(`[DataForSEO Maps] Request body:`, JSON.stringify(requestBody));

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`[DataForSEO Maps] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[DataForSEO Maps] HTTP Error:`, errorText.substring(0, 1000));
      throw new Error(
        `DataForSEO Maps API error (${response.status}): ${errorText.substring(0, 500)}`
      );
    }

    const data: DataForSEOSERPResponse = await response.json();
    console.log(`[DataForSEO Maps] Response:`, JSON.stringify(data).substring(0, 1500));

    if (data.tasks && data.tasks.length > 0 && data.tasks[0].result) {
      const results = Array.isArray(data.tasks[0].result) 
        ? data.tasks[0].result 
        : [data.tasks[0].result];

      const localBusinesses: LocalBusiness[] = [];

      for (const result of results) {
        if (result.items && Array.isArray(result.items)) {
          for (const item of result.items) {
            // Process local pack results (type: "local_pack" or "maps")
            if ((item.type === 'local_pack' || item.type === 'maps') && item.title) {
              // Extract domain from website URL
              let websiteDomain = item.website || null;
              if (websiteDomain) {
                try {
                  const urlObj = new URL(websiteDomain.startsWith('http') ? websiteDomain : `https://${websiteDomain}`);
                  websiteDomain = urlObj.hostname.replace('www.', '');
                } catch {
                  // Invalid URL, keep as-is
                }
              }

              localBusinesses.push({
                name: item.title || item.title_highlighted || '',
                category: item.category || '',
                rating: item.rating?.value || null,
                reviewsCount: item.rating?.votes_count || null,
                websiteDomain,
                address: item.address || undefined,
              });
            }
          }
        }
      }

      return localBusinesses;
    }

    return [];
  } catch (error: any) {
    console.error(`[DataForSEO Maps] Error fetching local pack results:`, error.message);
    throw error;
  }
}


