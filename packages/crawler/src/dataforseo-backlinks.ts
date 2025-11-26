/**
 * DataForSEO Backlinks API integration for page and domain metrics
 * 
 * API Documentation: https://dataforseo.com/apis/backlinks-api
 * 
 * Configuration via environment variables:
 * - DATAFORSEO_LOGIN: Your DataForSEO username
 * - DATAFORSEO_PASSWORD: Your DataForSEO password
 */

export interface PageMetricsData {
  url: string;
  domain: string;
  pageRank: number; // 0-100
  backlinks: number;
  referringDomains: number;
  domainRank: number; // 0-100
}

export interface DomainMetricsData {
  domain: string;
  domainRank: number; // 0-100
}

interface DataForSEOBacklinksResponse {
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
    data?: any;
    result?: Array<{
      target?: string;
      url?: string;
      domain?: string;
      page_rank?: number;
      domain_rank?: number;
      backlinks?: number;
      referring_domains?: number;
      referring_main_domains?: number;
      referring_ip_addresses?: number;
      referring_subnets?: number;
      referring_pages?: number;
      dofollow_backlinks?: number;
      referring_domains_dofollow?: number;
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
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '').toLowerCase();
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
    return match ? match[1].toLowerCase() : url;
  }
}

/**
 * Get page-level metrics (rank, backlinks, referring_domains) for URLs
 * Uses the /backlinks/summary/live endpoint which takes one target per task
 * 
 * @param urls Array of full URLs to check
 * @returns Map of URL -> PageMetricsData
 */
export async function getPageMetrics(urls: string[]): Promise<Map<string, PageMetricsData>> {
  const { login, password } = getDataForSEOCredentials();
  const baseUrl = 'https://api.dataforseo.com/v3/backlinks/summary/live';
  const resultMap = new Map<string, PageMetricsData>();
  
  // DataForSEO allows up to 2000 tasks per request
  const maxBatchSize = 100; // Keep conservative to avoid rate limits
  
  for (let i = 0; i < urls.length; i += maxBatchSize) {
    const batch = urls.slice(i, i + maxBatchSize);
    
    // Each URL becomes a separate task in the request body
    const requestBody = batch.map(url => ({
      target: url,
      include_subdomains: false,
      backlinks_status_type: 'live',
      rank_scale: 'one_hundred', // Use 0-100 scale instead of 0-1000
    }));

    console.log(`[DataForSEO Backlinks] Fetching page metrics for ${batch.length} URLs (batch ${Math.floor(i / maxBatchSize) + 1})`);

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
        console.error(`[DataForSEO Backlinks] HTTP Error ${response.status}:`, errorText.substring(0, 1000));
        // Continue with next batch instead of throwing
        continue;
      }

      const data: DataForSEOBacklinksResponse = await response.json();

      // Each task in the response corresponds to one URL
      if (data.tasks) {
        for (const task of data.tasks) {
          if (task.status_code !== 20000 || !task.result || task.result.length === 0) {
            continue;
          }

          const item = task.result[0];
          const url = item.target;
          if (!url) continue;

          const domain = extractDomain(url);
          const pageRank = item.rank ?? 0; // 'rank' is the target's rank
          const backlinks = item.backlinks ?? 0;
          const referringDomains = item.referring_domains ?? item.referring_main_domains ?? 0;

          resultMap.set(url, {
            url,
            domain,
            pageRank: Math.max(0, Math.min(100, pageRank)),
            backlinks,
            referringDomains,
            domainRank: 0, // Will be filled in later from domain metrics
          });
        }

        console.log(`[DataForSEO Backlinks] Successfully parsed ${resultMap.size} page metrics from ${batch.length} URLs`);
      }
    } catch (error: any) {
      console.error(`[DataForSEO Backlinks] Error fetching page metrics for batch:`, error.message);
      // Continue with next batch
      continue;
    }
  }

  return resultMap;
}

/**
 * Get domain-level metrics (rank) for domains
 * Uses the /backlinks/summary/live endpoint which takes one target per task
 * 
 * @param domains Array of domains to check (e.g., ["example.com"])
 * @returns Map of domain -> DomainMetricsData
 */
export async function getDomainMetrics(domains: string[]): Promise<Map<string, DomainMetricsData>> {
  const { login, password } = getDataForSEOCredentials();
  const baseUrl = 'https://api.dataforseo.com/v3/backlinks/summary/live';
  const resultMap = new Map<string, DomainMetricsData>();
  
  // DataForSEO allows up to 2000 tasks per request
  const maxBatchSize = 100; // Keep conservative to avoid rate limits
  
  for (let i = 0; i < domains.length; i += maxBatchSize) {
    const batch = domains.slice(i, i + maxBatchSize);
    
    // Each domain becomes a separate task in the request body
    const requestBody = batch.map(domain => ({
      target: domain,
      include_subdomains: false,
      backlinks_status_type: 'live',
      rank_scale: 'one_hundred', // Use 0-100 scale instead of 0-1000
    }));

    console.log(`[DataForSEO Backlinks] Fetching domain metrics for ${batch.length} domains (batch ${Math.floor(i / maxBatchSize) + 1})`);

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
        console.error(`[DataForSEO Backlinks] HTTP Error ${response.status}:`, errorText.substring(0, 1000));
        // Continue with next batch instead of throwing
        continue;
      }

      const data: DataForSEOBacklinksResponse = await response.json();

      // Each task in the response corresponds to one domain
      if (data.tasks) {
        for (const task of data.tasks) {
          if (task.status_code !== 20000 || !task.result || task.result.length === 0) {
            continue;
          }

          const item = task.result[0];
          const domain = item.target;
          if (!domain) continue;

          const domainRank = item.rank ?? 0; // 'rank' is the target's rank

          resultMap.set(domain.toLowerCase(), {
            domain: domain.toLowerCase(),
            domainRank: Math.max(0, Math.min(100, domainRank)),
          });
        }

        console.log(`[DataForSEO Backlinks] Successfully parsed ${resultMap.size} domain metrics from ${batch.length} domains`);
      }
    } catch (error: any) {
      console.error(`[DataForSEO Backlinks] Error fetching domain metrics for batch:`, error.message);
      // Continue with next batch
      continue;
    }
  }

  return resultMap;
}

