import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import {
  SerpData,
  SerpResult,
  DifficultySignals,
  CompetitorInfo,
} from '@niche-hunter/core';

// Resolve aggregators.json path - works from both root and when bundled
const getAggregatorsPath = () => {
  // Try multiple possible locations
  const possiblePaths = [
    path.join(process.cwd(), 'config', 'aggregators.json'), // Root when run from CLI
    path.join(process.cwd(), '..', '..', 'config', 'aggregators.json'), // From apps/web/node_modules
    path.join(process.cwd(), '..', '..', '..', 'config', 'aggregators.json'), // From apps/web
  ];
  
  // Try __dirname if available (CommonJS)
  try {
    if (typeof __dirname !== 'undefined') {
      possiblePaths.unshift(
        path.join(__dirname, '..', '..', '..', 'config', 'aggregators.json'),
        path.join(__dirname, '..', '..', '..', '..', 'config', 'aggregators.json')
      );
    }
  } catch (e) {
    // __dirname not available (ES modules)
  }
  
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return p;
      }
    } catch (e) {
      // Continue to next path
    }
  }
  
  // Fallback to root
  return path.join(process.cwd(), 'config', 'aggregators.json');
};

const aggregators = JSON.parse(
  fs.readFileSync(getAggregatorsPath(), 'utf-8')
) as string[];

// Use /tmp in serverless environments (Vercel, AWS Lambda, etc.) since filesystem is read-only
// Otherwise use .screenshots in the current working directory
const SCREENSHOT_DIR = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? path.join('/tmp', 'screenshots')
  : path.join(process.cwd(), 'apps', 'web', '.screenshots');

// Only create directory if we're not in a read-only filesystem environment
// In serverless, /tmp should already exist, but we'll try to create it safely
try {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
} catch (error: any) {
  // If directory creation fails (e.g., in read-only filesystem), log warning but continue
  // Screenshots will fail later, but the app won't crash at startup
  console.warn(`[serp] Could not create screenshot directory ${SCREENSHOT_DIR}:`, error.message);
}

const DIRECTORY_DOMAINS = [
  'yelp.com',
  'bbb.org',
  'manta.com',
  'yellowpages.com',
  'superpages.com',
  'citysearch.com',
];

function isAggregator(url: string): boolean {
  return aggregators.some((agg) => url.includes(agg));
}

function isDirectory(url: string): boolean {
  return DIRECTORY_DOMAINS.some((dir) => url.includes(dir));
}

function isEMD(keyword: string, city: string, url: string): boolean {
  const domain = new URL(url).hostname.toLowerCase();
  const keywordTokens = keyword.toLowerCase().split(/\s+/);
  const cityToken = city.toLowerCase();
  const domainTokens = domain.replace(/\.(com|net|org|co)$/, '').split(/-|_/);

  const hasKeyword = keywordTokens.some((token) => domainTokens.includes(token));
  const hasCity = domainTokens.includes(cityToken);

  return hasKeyword && hasCity;
}

function isPMD(keyword: string, city: string, url: string): boolean {
  const domain = new URL(url).hostname.toLowerCase();
  const keywordTokens = keyword.toLowerCase().split(/\s+/);
  const cityToken = city.toLowerCase();
  const domainText = domain.replace(/\.(com|net|org|co)$/, '');

  const hasKeyword = keywordTokens.some((token) => domainText.includes(token));
  const hasCity = domainText.includes(cityToken);

  return hasKeyword && hasCity && !isEMD(keyword, city, url);
}

function estimateWordCount(snippet: string): number {
  return snippet.split(/\s+/).length;
}

export async function fetchSerpTop(
  keyword: string,
  city: string,
  state: string,
  browser?: Browser
): Promise<SerpData> {
  // Use provided browser or launch new one
  let page: Page;
  let shouldCloseBrowser = false;
  let browserInstance: Browser | null = null;
  
  if (browser) {
    // Use the provided browser
    page = await browser.newPage();
  } else {
    // Fallback: launch new browser (shouldn't happen in normal flow)
    const puppeteer = require('puppeteer');
    const executablePath = puppeteer.executablePath();
    browserInstance = await puppeteer.launch({ 
      headless: true,
      executablePath: executablePath,
      timeout: 90000,
      protocolTimeout: 120000,
    });
    if (!browserInstance) {
      throw new Error('Failed to launch browser');
    }
    // Verify connection
    if (!browserInstance.isConnected()) {
      throw new Error('Browser launched but not connected');
    }
    page = await browserInstance.newPage();
    shouldCloseBrowser = true;
  }

  let googleFailed = false;
  let googleError: Error | null = null;
  
  try {
    const query = `${keyword} ${city} ${state}`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=us`;

    console.log(`   📊 Analyzing SERP for: "${query}"`);
    console.log(`   🔗 SERP URL: ${searchUrl}`);
    console.log(`   📍 Location: ${city}, ${state}`);
    
    try {
      const response = await page.goto(searchUrl, { waitUntil: 'load', timeout: 15000 });
      const finalUrl = page.url();
      
      // Check if we got redirected to a CAPTCHA or error page
      if (finalUrl.includes('sorry') || finalUrl.includes('captcha') || finalUrl.includes('unusual_traffic')) {
        googleFailed = true;
        googleError = new Error(`Google CAPTCHA detected - URL: ${finalUrl}`);
        console.log(`   ⚠️  [GOOGLE_CAPTCHA] Google is showing CAPTCHA or blocking access`);
        console.log(`   🔗 Final URL: ${finalUrl}`);
        console.log(`   🔄 [SERP_FALLBACK] Trying Bing...`);
      } else if (!response || response.status() !== 200) {
        googleFailed = true;
        googleError = new Error(`Google returned status ${response?.status() || 'unknown'}`);
        console.log(`   ⚠️  [GOOGLE_ERROR] Google returned non-200 status: ${response?.status() || 'unknown'}`);
        console.log(`   🔄 [SERP_FALLBACK] Trying Bing...`);
      } else {
        console.log(`   ✅ Google SERP loaded successfully (status: ${response.status()})`);
      }
    } catch (error: any) {
      googleFailed = true;
      googleError = error;
      const finalUrl = page.url();
      console.log(`   ⚠️  [GOOGLE_ERROR] Google SERP fetch failed: ${error.message}`);
      console.log(`   🔗 Final URL after error: ${finalUrl}`);
      if (finalUrl.includes('sorry') || finalUrl.includes('captcha')) {
        console.log(`   ⚠️  [GOOGLE_CAPTCHA] Google is showing CAPTCHA - this is why it failed`);
      }
      console.log(`   🔄 [SERP_FALLBACK] Trying Bing...`);
      // Skip Google processing, go straight to Bing
    }

    let results: SerpResult[] = [];
    let localPack = false;
    let relatedKeywords: string[] = [];
    
    // Only process Google results if it didn't fail
    if (!googleFailed) {
      // Wait a bit for page to fully render
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check for CAPTCHA or error pages
      const pageContent = await page.evaluate(() => document.body.textContent || '');
      if (pageContent.includes('unusual traffic') || pageContent.includes('automated queries') || pageContent.includes('verify you')) {
        googleFailed = true;
        googleError = new Error('Google CAPTCHA detected in page content');
        console.log(`   ⚠️  [GOOGLE_CAPTCHA] CAPTCHA detected in page content`);
        console.log(`   🔄 [SERP_FALLBACK] Trying Bing...`);
      } else {
        // Check for local pack - look for elements with map/directions/phone text
        const localPackElements = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('[data-ved], .VkpGBb, [jsname]'));
          return elements.filter(el => {
            const text = el.textContent || '';
            return /map|directions|phone/i.test(text);
          }).length;
        });
        localPack = localPackElements > 0;
        console.log(`   📊 Local pack detected: ${localPack}`);

        // Extract organic results with enhanced data
        const resultElements = await page.$$('div[data-sokoban-container] a, div.g a');
        console.log(`   📊 Found ${resultElements.length} potential result elements on Google`);

        if (resultElements.length === 0) {
          console.log(`   ⚠️  [GOOGLE_NO_RESULTS] No result elements found - Google may have blocked the request`);
          googleFailed = true;
        }

        for (let i = 0; i < Math.min(10, resultElements.length); i++) {
          const element = resultElements[i];
          try {
            const href = await element.evaluate((el: Element) => el.getAttribute('href')) as string | null;
            if (!href || !href.startsWith('http')) continue;

            // Extract domain from URL
            let domain = '';
            try {
              const urlObj = new URL(href);
              domain = urlObj.hostname.replace(/^www\./, '');
            } catch {
              // Invalid URL, skip
            }

            // Get title from h3 within the element or parent
            const titleElement = await element.$('h3') || await element.evaluateHandle((el: Element) => {
              const parent = (el as any).closest('div');
              return parent?.querySelector('h3') || null;
            }).then(handle => handle.asElement()).catch(() => null);
            
            const title = titleElement ? await titleElement.evaluate((node: Node) => (node as Element).textContent || '') as string : '';

            // Get snippet and meta description
            const snippetElement = await element.evaluateHandle((el: Element) => {
              const parent = (el as any).closest('div');
              if (!parent) return null;
              const snippet = parent.querySelector('span.VwiC3b') || 
                             Array.from(parent.querySelectorAll('span')).find((s: any) => s.textContent && s.textContent.length > 20);
              return snippet;
            }).then(handle => handle.asElement()).catch(() => null);
            
            const snippet = snippetElement ? await snippetElement.evaluate((node: Node) => (node as Element).textContent || '') as string : '';
            
            // Estimate word count from snippet
            const estimatedWordCount = estimateWordCount(snippet);

            // Check for images/videos in result
            const hasMedia = await element.evaluateHandle((el: Element) => {
              const parent = (el as any).closest('div');
              if (!parent) return { hasImages: false, hasVideos: false };
              const hasImages = parent.querySelector('img') !== null;
              const hasVideos = parent.querySelector('video, [data-ved*="video"]') !== null;
              return { hasImages, hasVideos };
            }).then(handle => handle.jsonValue()).catch(() => ({ hasImages: false, hasVideos: false })) as { hasImages: boolean; hasVideos: boolean };

            results.push({
              title: title as string,
              url: href,
              snippet: snippet as string,
              position: i + 1,
              domain,
              metaDescription: snippet, // Use snippet as meta description estimate
              estimatedWordCount,
              hasImages: hasMedia.hasImages,
              hasVideos: hasMedia.hasVideos,
            });
          } catch (error) {
            // Skip if element is not valid
            continue;
          }
        }

        // Capture screenshot
        const screenshotPath = path.join(
          SCREENSHOT_DIR,
          `${keyword}-${city}-${state}.png`.replace(/[^a-z0-9.-]/gi, '-')
        );
        await page.screenshot({ path: screenshotPath, fullPage: false });

        // Save HTML
        const html = await page.content();

        // Extract related keywords from "People also ask" section
        try {
          // Look for "People also ask" questions
          const paaElements = await page.$$('[data-ved*="PAA"], .related-question-pair, [jsname*="yEVEwb"]');
          for (const element of paaElements) {
            try {
              const text = await element.evaluate((el: Element) => el.textContent || '') as string;
              if (text && text.length > 10 && text.length < 100) {
                // Clean up the question text
                const cleaned = text.trim().replace(/^[?¿]\s*/, '').replace(/\s+/g, ' ');
                if (cleaned.length > 5 && !relatedKeywords.includes(cleaned)) {
                  relatedKeywords.push(cleaned);
                }
              }
            } catch (e) {
              continue;
            }
          }

          // Look for "Related searches" at bottom of page
          const relatedSearches = await page.evaluate(() => {
            const searches: string[] = [];
            // Common selectors for related searches
            const selectors = [
              '[data-ved*="related"]',
              '.brs_col',
              '[class*="related"]',
              '[id*="related"]',
            ];
            
            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              elements.forEach((el) => {
                const text = el.textContent?.trim();
                if (text && text.length > 5 && text.length < 80) {
                  searches.push(text);
                }
              });
            }
            return searches;
          }) as string[];

          relatedKeywords.push(...relatedSearches);
          
          // Remove duplicates and limit
          const uniqueRelated = Array.from(new Set(relatedKeywords)).slice(0, 10);
          if (uniqueRelated.length > 0) {
            console.log(`   🔍 Found ${uniqueRelated.length} related keywords from SERP`);
          }
          relatedKeywords = uniqueRelated;
        } catch (error) {
          // Silently fail - related keywords are nice to have but not critical
          console.log(`   ⚠️  Could not extract related keywords: ${(error as Error).message}`);
        }

        console.log(`   ✅ Extracted ${results.length} organic results from Google`);
        
        if (results.length === 0) {
          console.log(`   ⚠️  [GOOGLE_NO_RESULTS] Google returned 0 results - may be blocked or CAPTCHA`);
          googleFailed = true;
        }
      } // End of else block (if no CAPTCHA detected)
    } // End of if (!googleFailed) block

    // If Google failed or returned 0 results, try Bing fallback
    if (googleFailed || results.length === 0) {
      if (googleFailed) {
        console.log(`   ⚠️  [SERP_FALLBACK] Google failed: ${googleError?.message || 'Unknown error'}`);
      } else {
        console.log(`   ⚠️  [SERP_FALLBACK] Google returned 0 results`);
      }
      console.log(`   🔄 [SERP_FALLBACK] Trying Bing...`);
      try {
        const bingQuery = `${keyword} ${city} ${state}`;
        const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(bingQuery)}`;
        console.log(`   🔗 Bing URL: ${bingUrl}`);
        
        await page.goto(bingUrl, { waitUntil: 'load', timeout: 15000 });
        
        // Extract Bing results (similar structure to Google)
        const bingResults: SerpResult[] = [];
        const bingElements = await page.$$('ol#b_results > li.b_algo, li.b_algo');
        
        for (let i = 0; i < Math.min(10, bingElements.length); i++) {
          const element = bingElements[i];
          try {
            const linkElement = await element.$('h2 a, a');
            if (!linkElement) continue;
            
            const href = await linkElement.evaluate((el: Element) => el.getAttribute('href')) as string | null;
            if (!href || !href.startsWith('http')) continue;
            
            let domain = '';
            try {
              const urlObj = new URL(href);
              domain = urlObj.hostname.replace(/^www\./, '');
            } catch {
              continue;
            }
            
            const titleElement = await element.$('h2, h2 a');
            const title = titleElement ? await titleElement.evaluate((node: Node) => (node as Element).textContent || '') as string : '';
            
            const snippetElement = await element.$('p, .b_caption p');
            const snippet = snippetElement ? await snippetElement.evaluate((node: Node) => (node as Element).textContent || '') as string : '';
            
            bingResults.push({
              position: i + 1,
              title,
              url: href,
              domain,
              snippet,
              estimatedWordCount: estimateWordCount(snippet),
            });
          } catch (e) {
            continue;
          }
        }
        
        if (bingResults.length > 0) {
          console.log(`   ✅ [SERP_FALLBACK] Bing returned ${bingResults.length} results`);
          return {
            query: bingQuery,
            results: bingResults,
            hasLocalPack: false, // Bing doesn't have local pack in same format
            relatedKeywords: undefined,
          };
        } else {
          console.log(`   ⚠️  [SERP_FALLBACK] Bing also returned 0 results`);
        }
      } catch (bingError: any) {
        console.log(`   ⚠️  [SERP_FALLBACK] Bing fetch failed: ${bingError.message}`);
      }
    }
    
    const serpData = {
      query,
      results,
      hasLocalPack: localPack,
      localPackCount: localPack ? 3 : undefined,
      relatedKeywords: relatedKeywords.length > 0 ? relatedKeywords : undefined,
    };
    
    console.log(`   ✅ Found ${results.length} results, local pack: ${localPack ? 'Yes' : 'No'}`);
    
    return serpData;
  } finally {
    await page.close();
    // Only close browser if we launched it (not if using provided browser)
    if (shouldCloseBrowser && browserInstance) {
      await browserInstance.close();
    }
  }
}

/**
 * Identify competitor type based on URL and content patterns
 */
function identifyCompetitorType(
  url: string,
  title: string,
  domain: string
): 'local-business' | 'aggregator' | 'directory' | 'lead-gen' | 'unknown' {
  // Check for aggregators
  if (isAggregator(url)) {
    return 'aggregator';
  }

  // Check for directories
  if (isDirectory(url)) {
    return 'directory';
  }

  // Check for lead gen patterns
  const leadGenPatterns = [
    /get.*quote/i,
    /free.*estimate/i,
    /find.*contractor/i,
    /compare.*prices/i,
    /top.*companies/i,
    /best.*services/i,
  ];
  const titleLower = title.toLowerCase();
  const urlLower = url.toLowerCase();
  if (leadGenPatterns.some(pattern => pattern.test(titleLower) || pattern.test(urlLower))) {
    return 'lead-gen';
  }

  // Check for local business patterns (phone numbers, addresses, local indicators)
  const localBusinessPatterns = [
    /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/, // Phone number
    /\b(call|phone|address|location)\b/i,
  ];
  if (localBusinessPatterns.some(pattern => pattern.test(titleLower) || pattern.test(urlLower))) {
    return 'local-business';
  }

  return 'unknown';
}

/**
 * Assess content quality based on snippet and metadata
 */
function assessContentQuality(
  snippet: string,
  estimatedWordCount: number,
  hasImages: boolean,
  hasVideos: boolean
): 'high' | 'medium' | 'low' {
  let score = 0;

  // Word count scoring
  if (estimatedWordCount > 150) score += 3;
  else if (estimatedWordCount > 100) score += 2;
  else if (estimatedWordCount > 50) score += 1;

  // Media presence
  if (hasImages) score += 1;
  if (hasVideos) score += 2;

  // Snippet quality (check for specific details)
  const snippetLower = snippet.toLowerCase();
  if (snippetLower.includes('price') || snippetLower.includes('cost')) score += 1;
  if (snippetLower.includes('service') || snippetLower.includes('professional')) score += 1;
  if (snippetLower.length > 100) score += 1;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

/**
 * Extract competitor information from SERP results
 */
export function extractCompetitorInfo(
  serpData: SerpData
): CompetitorInfo[] {
  const competitors: CompetitorInfo[] = [];

  for (const result of serpData.results) {
    if (!result.domain) continue;

    const competitorType = identifyCompetitorType(
      result.url,
      result.title,
      result.domain
    );

    const contentQuality = assessContentQuality(
      result.snippet,
      result.estimatedWordCount || 0,
      result.hasImages || false,
      result.hasVideos || false
    );

    competitors.push({
      domain: result.domain,
      title: result.title,
      url: result.url,
      position: result.position,
      type: competitorType,
      contentQuality,
    });
  }

  return competitors;
}

export function extractSignals(
  serpData: SerpData,
  keyword: string,
  city: string
): DifficultySignals {
  let aggregatorCount = 0;
  let directoryCount = 0;
  let emdCount = 0;
  let pmdCount = 0;
  let totalWordCount = 0;
  let titlesWithCity = 0;

  for (const result of serpData.results) {
    const url = result.url;

    if (isAggregator(url)) {
      aggregatorCount++;
    }

    if (isDirectory(url)) {
      directoryCount++;
    }

    if (isEMD(keyword, city, url)) {
      emdCount++;
    } else if (isPMD(keyword, city, url)) {
      pmdCount++;
    }

    totalWordCount += result.estimatedWordCount || estimateWordCount(result.snippet);

    if (result.title.toLowerCase().includes(city.toLowerCase())) {
      titlesWithCity++;
    }
  }

  const avgWordCount = serpData.results.length > 0 ? totalWordCount / serpData.results.length : 0;
  const thinPageRatio = avgWordCount < 50 ? 1 : avgWordCount < 100 ? 0.5 : 0;
  const avgTitleContainsCity = serpData.results.length > 0 ? titlesWithCity / serpData.results.length : 0;

  return {
    hasLocalPack: serpData.hasLocalPack,
    aggregatorCount,
    directoryCount,
    emdCount,
    pmdCount,
    thinPageRatio,
    avgTitleContainsCity,
  };
}

/**
 * Enhance competitor information with additional metadata
 */
export function enhanceCompetitorInfo(competitors: CompetitorInfo[]): CompetitorInfo[] {
  return competitors.map(competitor => {
    // Add flags based on competitor type
    const isAggregator = competitor.type === 'aggregator';
    const isDirectory = competitor.type === 'directory';
    const isLeadGenSite = competitor.type === 'lead-gen';
    const isLocalBusiness = competitor.type === 'local-business';
    
    // Estimate domain authority (simplified - would need actual DA API in production)
    const estimatedDA = isAggregator ? 80 : isDirectory ? 70 : isLocalBusiness ? 50 : 40;
    
    return {
      ...competitor,
      isAggregator,
      isDirectory,
      isLeadGenSite,
      isLocalBusiness,
      estimatedDA,
    } as any;
  });
}

/**
 * Calculate competition strength score (0-10)
 */
export function calculateCompetitionStrength(competitors: CompetitorInfo[]): number {
  if (competitors.length === 0) return 0;
  
  let strength = 0;
  
  for (const competitor of competitors) {
    // Aggregators are strongest competitors
    if ((competitor as any).isAggregator) {
      strength += 2;
    } else if ((competitor as any).isDirectory) {
      strength += 1.5;
    } else if ((competitor as any).isLeadGenSite) {
      strength += 1;
    } else if ((competitor as any).isLocalBusiness) {
      strength += 0.5;
    }
    
    // Higher domain authority = stronger competitor
    const da = (competitor as any).estimatedDA || 50;
    strength += (da / 100) * 0.5;
    
    // Better content quality = stronger competitor
    const quality = competitor.contentQuality || 'medium';
    if (quality === 'high') {
      strength += 0.5;
    } else if (quality === 'medium') {
      strength += 0.25;
    }
  }
  
  // Normalize to 0-10 scale
  const normalized = Math.min(10, strength / competitors.length * 2);
  return Math.round(normalized * 10) / 10;
}
