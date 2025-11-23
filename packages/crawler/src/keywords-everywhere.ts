import { Browser, Page, ElementHandle } from 'puppeteer';
import { prisma } from '@niche-hunter/db';

// Helper function since Puppeteer doesn't have waitForTimeout
function waitForTimeout(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a keyword is relevant to the niche
 */
function isKeywordRelevant(keyword: string, niche: string, city?: string, state?: string): boolean {
  const keywordLower = keyword.toLowerCase();
  const nicheLower = niche.toLowerCase();
  
  // Extract root word from niche (e.g., "roofing" -> "roof", "plumbing" -> "plumb")
  const nicheRoot = nicheLower.replace(/ing$|er$|s$/, '');
  
  // Check if keyword contains niche-related terms
  const containsNiche = keywordLower.includes(nicheLower) || keywordLower.includes(nicheRoot);
  
  // Check for location-specific terms
  const hasLocation = city ? keywordLower.includes(city.toLowerCase()) : false;
  const hasState = state ? keywordLower.includes(state.toLowerCase()) : false;
  
  // Check for service-related intent words
  const serviceTerms = ['repair', 'service', 'install', 'replace', 'maintenance', 'contractor', 'company'];
  const hasServiceIntent = serviceTerms.some(term => keywordLower.includes(term));
  
  // Check for local service indicators
  const localIndicators = ['near me', 'local', 'nearby'];
  const hasLocalIntent = localIndicators.some(term => keywordLower.includes(term));
  
  // Keyword is relevant if it contains niche terms OR has location/service intent
  return containsNiche || (hasLocation && hasServiceIntent) || (hasLocalIntent && hasServiceIntent);
}

/**
 * Check if a keyword has monetization potential (transactional or service intent)
 */
function isKeywordMonetizable(keyword: string): boolean {
  const keywordLower = keyword.toLowerCase();
  
  // Transactional intent keywords
  const transactionalTerms = [
    'buy', 'purchase', 'hire', 'cost', 'price', 'quote', 
    'free estimate', 'get quote', 'estimate', 'pricing',
    'affordable', 'cheap', 'best price'
  ];
  const hasTransactionalIntent = transactionalTerms.some(term => keywordLower.includes(term));
  
  // Service intent keywords
  const serviceTerms = [
    'repair', 'install', 'replace', 'service', 'contractor', 
    'company', 'professional', 'expert', 'specialist',
    'maintenance', 'upgrade', 'fix', 'restoration'
  ];
  const hasServiceIntent = serviceTerms.some(term => keywordLower.includes(term));
  
  // Emergency keywords (high value)
  const emergencyTerms = [
    'emergency', 'urgent', '24 hour', 'immediate', 
    'same day', 'asap', 'now', 'fast'
  ];
  const hasEmergencyIntent = emergencyTerms.some(term => keywordLower.includes(term));
  
  // Location modifiers that indicate local intent
  const locationModifiers = ['near me', 'local', 'nearby', 'in'];
  const hasLocationModifier = locationModifiers.some(term => keywordLower.includes(term));
  
  // Exclude generic terms
  const genericTerms = ['what', 'how', 'why', 'when', 'where', 'information', 'guide', 'tips'];
  const isGeneric = genericTerms.some(term => keywordLower.includes(term));
  
  // Monetizable if has transactional/service/emergency intent AND not generic
  return (hasTransactionalIntent || hasServiceIntent || hasEmergencyIntent || hasLocationModifier) && !isGeneric;
}

/**
 * Extract similar keywords from Keywords Everywhere extension UI
 * Looks in both sidebar panels and dropdown suggestions
 */
async function extractSimilarKeywords(
  page: Page, 
  niche: string,
  city: string,
  state: string
): Promise<string[]> {
  const discoveredKeywords: Set<string> = new Set();
  
  try {
    // Wait a bit more for extension to fully load all UI elements
    await waitForTimeout(1000);
    
    // Keywords Everywhere typically injects similar keywords in:
    // 1. Sidebar/Panel elements
    // 2. Dropdown/suggestion lists
    // 3. Related keywords sections
    
    // Try multiple selectors for sidebar/panel
    const sidebarSelectors = [
      '[id*="kw-sidebar"]',
      '[id*="ke-sidebar"]',
      '[class*="kw-sidebar"]',
      '[class*="ke-sidebar"]',
      '[class*="kw-panel"]',
      '[class*="ke-panel"]',
      '[class*="kw-suggestions"]',
      '[class*="ke-suggestions"]',
      '[class*="related-keywords"]',
      '[class*="kw-related"]',
      '[class*="ke-related"]',
      '[data-kw-keywords]',
      '[data-ke-keywords]',
      '.kw-sidebar',
      '.ke-sidebar',
      '.kw-panel',
      '.ke-panel'
    ];
    
    // Try multiple selectors for dropdown/suggestions
    const dropdownSelectors = [
      '[class*="kw-dropdown"]',
      '[class*="ke-dropdown"]',
      '[class*="kw-suggestions-list"]',
      '[class*="ke-suggestions-list"]',
      '[class*="kw-autocomplete"]',
      '[class*="ke-autocomplete"]',
      '.kw-dropdown',
      '.ke-dropdown',
      '.kw-suggestions',
      '.ke-suggestions'
    ];
    
    // Combine all selectors
    const allSelectors = [...sidebarSelectors, ...dropdownSelectors];
    
    for (const selector of allSelectors) {
      try {
        const elements = await page.$$(selector);
        
        for (const element of elements) {
          try {
            // Get all text content from the element and its children
            const text = await element.evaluate((el: Element) => el.textContent || '') as string;
            if (!text) continue;
            
            // Extract potential keywords from text
            // Keywords Everywhere often shows them as clickable links or list items
            const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
            
            for (const line of lines) {
              // Clean up the line - remove volume numbers, special chars at start/end
              const cleaned = line
                .replace(/^\d+[,\d]*[KMkm]?\s*/, '') // Remove leading volume numbers
                .replace(/\s*\d+[,\d]*[KMkm]?\s*$/g, '') // Remove trailing volume numbers
                .replace(/^\W+|\W+$/g, '') // Remove leading/trailing non-word chars
                .trim();
              
              if (cleaned.length > 3 && cleaned.length < 100) { // Reasonable keyword length
                // Check for keyword-like patterns (not just random text)
                if (/^[a-zA-Z0-9\s-]+$/.test(cleaned)) {
                  discoveredKeywords.add(cleaned);
                }
              }
            }
            
            // Also try to find link elements within the container (common in Keywords Everywhere)
            const links = await element.$$('a');
            for (const link of links) {
              const linkText = await link.evaluate((el: Element) => el.textContent || '') as string;
              if (linkText) {
                const cleaned = linkText.trim().replace(/^\W+|\W+$/g, '');
                if (cleaned.length > 3 && cleaned.length < 100) {
                  discoveredKeywords.add(cleaned);
                }
              }
            }
            
            // Try list items
            const listItems = await element.$$('li');
            for (const item of listItems) {
              const itemText = await item.evaluate((el: Element) => el.textContent || '') as string;
              if (itemText) {
                const cleaned = itemText
                  .trim()
                  .replace(/^\d+[,\d]*[KMkm]?\s*/, '')
                  .replace(/\s*\d+[,\d]*[KMkm]?\s*$/g, '')
                  .replace(/^\W+|\W+$/g, '');
                if (cleaned.length > 3 && cleaned.length < 100) {
                  discoveredKeywords.add(cleaned);
                }
              }
            }
          } catch (e) {
            // Continue to next element
            continue;
          }
        }
      } catch (e) {
        // Continue to next selector
        continue;
      }
    }
    
    // Also try extracting from page content if we didn't find much
    if (discoveredKeywords.size < 5) {
      try {
        // Look for common Keywords Everywhere patterns in the HTML
        const pageContent = await page.content();
        
        // Look for patterns like "related keywords" or "suggestions" sections
        const relatedPatterns = [
          /related[\s-]?keywords?[^<]*>([^<]+)/gi,
          /suggestions?[^<]*>([^<]+)/gi,
          /similar[\s-]?keywords?[^<]*>([^<]+)/gi,
          /<li[^>]*kw[^>]*>([^<]+)/gi,
          /<li[^>]*ke[^>]*>([^<]+)/gi,
        ];
        
        for (const pattern of relatedPatterns) {
          const matches = pageContent.matchAll(pattern);
          for (const match of matches) {
            if (match[1]) {
              const cleaned = match[1].trim().replace(/^\W+|\W+$/g, '');
              if (cleaned.length > 3 && cleaned.length < 100) {
                discoveredKeywords.add(cleaned);
              }
            }
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Filter keywords for relevance and monetization
    const filteredKeywords: string[] = [];
    for (const kw of discoveredKeywords) {
      if (isKeywordRelevant(kw, niche, city, state) && isKeywordMonetizable(kw)) {
        filteredKeywords.push(kw);
      }
    }
    
    return filteredKeywords;
  } catch (error: any) {
    console.warn(`Error extracting similar keywords: ${error.message}`);
    return [];
  }
}

/**
 * Keywords Everywhere displays volume data directly on Google SERP results.
 * Look for elements with keywords-everywhere related classes or data attributes.
 */
export async function getVolumeFromKeywordsEverywhere(
  keyword: string,
  city: string,
  state: string,
  browser: Browser,
  reusePage?: Page,
  checkCancellation?: () => boolean,
  niche?: string
): Promise<{ volume: number; cpc?: number; similarKeywords: string[] }> {
  // Helper: add random delay to make behavior more human-like
  async function humanDelay(minSeconds: number = 3, maxSeconds: number = 8): Promise<void> {
    const delayMs = (Math.random() * (maxSeconds - minSeconds) + minSeconds) * 1000;
    console.log(`      ⏳ [Human Delay] Waiting ${(delayMs / 1000).toFixed(1)} seconds before next action...`);
    await waitForTimeout(delayMs);
  }
  
  // Helper: add random mouse movements to appear more human
  async function humanMouseMovement(page: Page): Promise<void> {
    try {
      // Random small movements
      const movements = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < movements; i++) {
        const x = Math.floor(Math.random() * 100) + 50;
        const y = Math.floor(Math.random() * 100) + 50;
        await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 1 });
        await waitForTimeout(100 + Math.random() * 200);
      }
    } catch (e) {
      // Ignore mouse movement errors
    }
  }
  
  // Helper: detect if we're on a CAPTCHA page
  async function detectCaptcha(targetPage: Page): Promise<boolean> {
    try {
      const currentUrl = targetPage.url();
      
      // Check URL for CAPTCHA indicators
      if (currentUrl.includes('/sorry/index') || 
          currentUrl.includes('sorry/Index') ||
          currentUrl.includes('captcha') ||
          currentUrl.includes('unusual_traffic')) {
        return true;
      }
      
      // Check page content for CAPTCHA elements
      const captchaSelectors = [
        '#recaptcha',
        '.g-recaptcha',
        '[data-callback*="recaptcha"]',
        'iframe[src*="recaptcha"]',
        'iframe[src*="challenges.cloudflare.com"]',
      ];
      
      for (const selector of captchaSelectors) {
        const element = await targetPage.$(selector).catch(() => null);
        if (element) {
          return true;
        }
      }
      
      // Check for CAPTCHA text
      const pageText = await targetPage.evaluate(() => {
        return document.body.innerText.toLowerCase();
      }).catch(() => '');
      
      const captchaIndicators = [
        "i'm not a robot",
        "unusual traffic",
        "verify you're not a robot",
        "verify you are not a robot",
        "this page checks to see if it's really you",
      ];
      
      for (const indicator of captchaIndicators) {
        if (pageText.includes(indicator)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      // If we can't check, assume no CAPTCHA to avoid false positives
      return false;
    }
  }
  
  // Helper: accept Google consent if shown (handles iframes as well)
  async function acceptGoogleConsent(targetPage: Page): Promise<boolean> {
    try {
      // Try top-level page first - Puppeteer doesn't support :has-text() selector
      const consentSelectors = [
        '#introAgreeButton',
        'button[aria-label*="Accept"]',
        'button[aria-label*="accept"]',
        'button[aria-label*="I agree"]',
        'button[aria-label*="I accept"]',
      ];
      
      // Also try XPath for text-based matching
      const xpathSelectors = [
        '//button[contains(text(), "I agree")]',
        '//button[contains(text(), "Accept all")]',
        '//button[contains(text(), "I accept")]',
      ];
      
      for (const sel of consentSelectors) {
        try {
          const el = await targetPage.$(sel);
          if (el) {
            const isVisible = await el.evaluate((el: Element) => {
              const rect = el.getBoundingClientRect();
              const style = (window as any).getComputedStyle(el);
              return rect.width > 0 && rect.height > 0 && 
                     style.visibility !== 'hidden' &&
                     style.display !== 'none';
            }) as boolean;
            if (isVisible) {
              console.log(`      ✅ [Consent] Clicking ${sel} on top-level page`);
              await el.click().catch(() => {});
              await waitForTimeout(500);
              return true;
            }
          }
        } catch {}
      }
      
      // Try XPath selectors
      for (const xpath of xpathSelectors) {
        try {
          // Puppeteer doesn't have $x, use evaluate with XPath - simplified approach
          const nodeHandle = await targetPage.evaluateHandle((xpath: string) => {
            const result = (document as any).evaluate(xpath, document, null, (window as any).XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return result.singleNodeValue;
          }, xpath);
          const el = nodeHandle.asElement();
          if (el) {
            const isVisible = await el.evaluate((node: Node) => {
              const el = node as Element;
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            }) as boolean;
            if (isVisible) {
              console.log(`      ✅ [Consent] Clicking via XPath: ${xpath}`);
              await (el as any).click().catch(() => {});
              await waitForTimeout(500);
              return true;
            }
          }
        } catch {}
      }
      
      // Try consent iframes
      const frames = targetPage.frames();
      for (const frame of frames) {
        const frameUrl = frame.url();
        if (!/consent|privacy|consent\.google\./i.test(frameUrl)) continue;
        for (const sel of consentSelectors) {
          try {
            const el = await frame.$(sel);
            if (el) {
              console.log(`      ✅ [Consent] Clicking ${sel} inside iframe: ${frameUrl}`);
              await el.click().catch(() => {});
              await waitForTimeout(500);
              return true;
            }
          } catch {}
        }
      }
    } catch (e) {
      console.log(`      ⚠️  [Consent] Error while handling consent: ${(e as Error).message}`);
    }
    return false;
  }
  
  // Reuse page if provided, otherwise create new one
  console.log(`      📄 [Keywords Everywhere] Getting page (reusePage: ${!!reusePage})...`);
  let page: Page;
  if (reusePage) {
    try {
      // Check if page is closed by trying to access url
      reusePage.url();
      page = reusePage;
    } catch {
      // Page is closed, create new one
      page = await browser.newPage();
    }
  } else {
    page = await browser.newPage();
  }
  const shouldClosePage = !reusePage;
  const currentUrl = page.url();
  console.log(`      ✅ [Keywords Everywhere] Got page, current URL: ${currentUrl || '(new page)'}`);

  try {
    // Check cancellation before starting
    if (checkCancellation && checkCancellation()) {
      throw new Error('Analysis cancelled by user');
    }

    // Add human-like delay before starting search (10-15 seconds to reduce CAPTCHA)
    const delaySeconds = 10 + Math.random() * 5; // 10-15 seconds
    console.log(`      ⏳ Waiting ${delaySeconds.toFixed(1)}s before search to reduce CAPTCHA detection...`);
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    
    // Build Google search query with location
    // For local queries, use "keyword city" (no state) as per user requirement
    // State makes queries too specific and often returns 0 or national volumes
    const query = city ? `${keyword} ${city}` : keyword;
    const baseParams = `hl=en&gl=us&pws=0&igu=1`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&${baseParams}`;
    console.log(`      🚀 [Keywords Everywhere] Navigating to Google for: "${query}"`);
    console.log(`      🔗 URL: ${searchUrl.substring(0, 80)}...`);
    console.log(`      📍 Current page URL before navigation: ${page.url()}`);
    
    // Add random mouse movement before navigation
    await humanMouseMovement(page);

    // Use 'load' instead of 'networkidle' - Google has continuous network activity
    console.log(`      ⏳ [Keywords Everywhere] Preparing page and calling page.goto() (with retries)...`);
    let pageLoadSuccess = false;
    const navigationStartTime = Date.now();
    try {
      // If we landed in chrome://newtab or about:blank, go to NCR first to avoid redirects
      const startUrl = page.url();
      if (startUrl.startsWith('chrome://') || startUrl === 'about:blank') {
        console.log(`      🔄 [Keywords Everywhere] On ${startUrl}, navigating to Google NCR first...`);
        await page.goto('https://www.google.com/ncr', { waitUntil: 'load', timeout: 10000 }).catch(() => {});
        await waitForTimeout(500);
      }
      
      // First attempt: direct search URL
      console.log(`      🔄 [Keywords Everywhere] page.goto() starting...`);
      const response = await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const navigationDuration = ((Date.now() - navigationStartTime) / 1000).toFixed(1);
      console.log(`      ✅ [Keywords Everywhere] page.goto() completed in ${navigationDuration}s`);
      console.log(`      ✅ [Keywords Everywhere] Page loaded! Status: ${response?.status() || 'unknown'}`);
      console.log(`      📍 [Keywords Everywhere] Final URL: ${page.url()}`);
      
      // Verify page has actual content (not white screen)
      await waitForTimeout(1000); // Give page time to render
      const hasContent = await page.evaluate(() => {
        const body = document.body;
        if (!body) return false;
        const textLength = body.innerText?.length || 0;
        const hasSearchResults = !!(
          document.querySelector('#search') ||
          document.querySelector('#rso') ||
          document.querySelector('.g') ||
          document.querySelector('[data-ved]')
        );
        return textLength > 100 || hasSearchResults;
      });
      
      if (!hasContent) {
        console.warn(`      ⚠️  [Keywords Everywhere] Page appears blank, waiting longer...`);
        await waitForTimeout(3000);
        const hasContentAfterWait = await page.evaluate(() => {
          const body = document.body;
          if (!body) return false;
          return (body.innerText?.length || 0) > 100;
        });
        if (!hasContentAfterWait) {
          throw new Error('Page loaded but appears blank (white screen)');
        }
      }
      
      pageLoadSuccess = true;
    } catch (error: any) {
      console.error(`      ❌ [Keywords Everywhere] Page navigation error: ${error.message}`);
      if (error.message.includes('timeout') || error.message.includes('Navigation')) {
        console.warn(`      ⚠️  [Keywords Everywhere] Page load timeout, checking if page loaded anyway...`);
        const currentUrl = page.url();
        console.log(`      📍 [Keywords Everywhere] Current URL after timeout: ${currentUrl}`);
        // Check if we're on Google (even if timeout)
        if (currentUrl.includes('google.com')) {
          console.log(`      ✅ [Keywords Everywhere] Page seems loaded (on Google), continuing...`);
          pageLoadSuccess = true;
          // Wait a bit for page to stabilize
          await waitForTimeout(2000);
        } else {
          // Second attempt: go to NCR then search again
          console.log(`      🔁 [Keywords Everywhere] Retrying via NCR then search...`);
          try {
            await page.goto('https://www.google.com/ncr', { waitUntil: 'domcontentloaded', timeout: 10000 });
            await waitForTimeout(1000);
            const response2 = await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
            if (page.url().includes('google.com')) {
              console.log(`      ✅ [Keywords Everywhere] Retry navigation succeeded!`);
              pageLoadSuccess = true;
              await waitForTimeout(1000);
            } else {
              throw new Error(`Retry navigation not on Google. URL: ${page.url()}`);
            }
          } catch (e2: any) {
            throw new Error(`Page navigation failed: ${error.message}. Current URL: ${currentUrl}. Retry error: ${e2.message}`);
          }
        }
      } else {
        throw error;
      }
    }
    
    if (!pageLoadSuccess) {
      // Fallback: Try navigating via about:blank first
      console.log(`      ⚠️  First navigation attempt failed, trying fallback method...`);
      try {
        await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 5000 });
        await waitForTimeout(1000);
        console.log(`      🔄 Navigating to Google again via fallback...`);
        const fallbackResponse = await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const finalUrl = page.url();
        if (finalUrl.includes('google.com')) {
          console.log(`      ✅ Fallback navigation succeeded!`);
          pageLoadSuccess = true;
        } else {
          throw new Error(`Fallback navigation failed. Current URL: ${finalUrl}`);
        }
      } catch (fallbackError: any) {
        throw new Error(`Both navigation attempts failed. Last error: ${fallbackError.message}`);
      }
    }
    
    if (!pageLoadSuccess) {
      throw new Error('Failed to load Google search page after all attempts');
    }
    
    // Check for CAPTCHA IMMEDIATELY after navigation - detect early
    const hasCaptcha = await detectCaptcha(page);
    if (hasCaptcha) {
      console.warn(`      ⚠️  [CAPTCHA] Google CAPTCHA detected for "${query}"`);
      console.warn(`      ⚠️  [CAPTCHA] Skipping this search - cannot proceed with automated search`);
      console.warn(`      💡 [CAPTCHA] Consider: 1) Wait longer between searches, 2) Use a different IP/proxy, 3) Use SearchAtlas API instead`);
      
      // Return zero volume and empty keywords - this is a graceful failure
      return {
        volume: 0,
        cpc: undefined,
        similarKeywords: []
      };
    }
    
    // Try to accept consent if present
    const consentAccepted = await acceptGoogleConsent(page);
    if (consentAccepted) {
      console.log(`      ✅ [Consent] Accepted Google consent dialog`);
      await waitForTimeout(1000);
      
      // Check again for CAPTCHA after consent (sometimes it appears after)
      const captchaAfterConsent = await detectCaptcha(page);
      if (captchaAfterConsent) {
        console.warn(`      ⚠️  [CAPTCHA] Google CAPTCHA appeared after consent for "${query}"`);
        return {
          volume: 0,
          cpc: undefined,
          similarKeywords: []
        };
      }
    }

    // Check cancellation during wait
    if (checkCancellation && checkCancellation()) {
      throw new Error('Analysis cancelled by user');
    }
    
    // Wait for search results to actually appear (not just URL change)
    console.log(`      ⏳ Waiting for search results to appear...`);
    try {
      await page.waitForSelector('#search, #rso, .g, [data-ved]', { timeout: 10000 });
      console.log(`      ✅ Search results detected`);
    } catch (waitError: any) {
      console.warn(`      ⚠️  Search results not found after 10s, checking page content...`);
      const hasResults = await page.evaluate(() => {
        return !!(
          document.querySelector('#search') ||
          document.querySelector('#rso') ||
          document.querySelector('.g') ||
          document.querySelector('[data-ved]')
        );
      });
      if (!hasResults) {
        console.warn(`      ⚠️  No search results found - page may be blank or still loading`);
      }
    }
    
    // Verify search actually executed by checking URL
    const currentUrl = page.url();
    const searchQueryLower = query.toLowerCase();
    const urlContainsQuery = currentUrl.toLowerCase().includes(encodeURIComponent(searchQueryLower).toLowerCase()) || 
                              currentUrl.toLowerCase().includes(searchQueryLower.replace(/\s+/g, '+'));
    
    console.log(`      📍 Current URL after navigation: ${currentUrl}`);
    console.log(`      🔍 URL contains search query: ${urlContainsQuery}`);
    console.log(`      🔍 URL contains /search?: ${currentUrl.includes('/search?')}`);
    
    // ALWAYS ensure we're on a search results page - if not, force navigation or typing
    const currentUrlAfterNav = page.url();
    console.log(`      🔍 Final check: Current URL is "${currentUrlAfterNav}"`);
    
    const isDefinitelyOnResults = urlContainsQuery && currentUrlAfterNav.includes('/search?');
    const isBlankOrNewtab = currentUrlAfterNav.startsWith('chrome://') || 
                             currentUrlAfterNav === 'about:blank' || 
                             currentUrlAfterNav === '' || 
                             currentUrlAfterNav.includes('newtab') ||
                             !currentUrlAfterNav.includes('google.com');
    
    if (!isDefinitelyOnResults || isBlankOrNewtab) {
      const reason = isBlankOrNewtab ? 'blank/newtab/not-google detected' : 'not confirmed on search results';
      console.log(`      ⚠️  ${reason.toUpperCase()} - FORCING typing...`);
      try {
        // If we're on chrome://newtab, about:blank, or blank address, go to Google first
        if (currentUrlAfterNav.startsWith('chrome://') || currentUrlAfterNav === 'about:blank' || currentUrlAfterNav === '' || currentUrlAfterNav.includes('newtab')) {
          console.log(`      🔄 Detected blank/newtab - forcing navigation to Google homepage first...`);
          await page.goto('https://www.google.com/ncr', { waitUntil: 'domcontentloaded', timeout: 15000 });
          await waitForTimeout(2000);
          const newUrl = page.url();
          console.log(`      📍 After NCR navigation, URL is: ${newUrl}`);
          
          // Verify NCR page loaded
          const ncrHasContent = await page.evaluate(() => {
            return (document.body?.innerText?.length || 0) > 50;
          });
          if (!ncrHasContent) {
            console.warn(`      ⚠️  NCR page appears blank, waiting longer...`);
            await waitForTimeout(3000);
          }
        }
        
        // Wait for page to be ready and ensure it's Google
        await waitForTimeout(1000);
        const finalCheckUrl = page.url();
        if (!finalCheckUrl.includes('google.com')) {
          console.log(`      ⚠️  Still not on Google (${finalCheckUrl}), forcing navigation...`);
          await page.goto('https://www.google.com/ncr', { waitUntil: 'domcontentloaded', timeout: 15000 });
          await waitForTimeout(1500);
        }
        
        // Re-run consent just in case it appeared after load
        await acceptGoogleConsent(page);
        console.log(`      ✅ Page ready, now finding search box...`);
        
        // Find Google search box - try multiple selectors
        const searchBoxSelectors = [
          'textarea[name="q"]',
          'input[name="q"]',
          'textarea[aria-label*="Search"]',
          'input[aria-label*="Search"]',
          'textarea[aria-label*="search"]',
          'input[aria-label*="search"]',
          'textarea[type="search"]',
          'input[type="search"]',
          'textarea[role="combobox"]',
          'input[role="combobox"]',
          'form[role="search"] textarea',
          'form[role="search"] input',
          '#APjFqb',
          'input.gLFyf',
          'textarea.gLFyf',
        ];
        
        let searchBox: ElementHandle<Element> | null = null;
        console.log(`      🔍 Trying ${searchBoxSelectors.length} selectors to find search box...`);
        for (let i = 0; i < searchBoxSelectors.length; i++) {
          const selector = searchBoxSelectors[i];
          try {
            console.log(`      🔍 Attempt ${i + 1}/${searchBoxSelectors.length}: ${selector}`);
            const element = await page.$(selector);
            if (element) {
              const isVisible = await element.evaluate((el: Element) => {
                const rect = el.getBoundingClientRect();
                const style = (window as any).getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && 
                       style.visibility !== 'hidden' &&
                       style.display !== 'none';
              }) as boolean;
              if (isVisible) {
                searchBox = element;
                console.log(`      ✅ Found VISIBLE search box with selector: ${selector}`);
                break;
              } else {
                console.log(`      ⚠️  Found search box but not visible: ${selector}`);
              }
            } else {
              console.log(`      ❌ No elements found for: ${selector}`);
            }
          } catch (e: any) {
            console.log(`      ❌ Error with selector ${selector}: ${e.message}`);
            continue;
          }
        }
        
        if (!searchBox) {
          console.log(`      ⚠️  Could not find Google search box with any selector!`);
          console.log(`      🔍 Trying to find search box by visible text...`);
          try {
            const allTextareas = await page.$$('textarea');
            const allInputs = await page.$$('input');
            console.log(`      📊 Found ${allTextareas.length} textareas and ${allInputs.length} inputs on page`);
            
            // Try first textarea that's visible
            for (const textarea of allTextareas) {
              const isVisible = await textarea.evaluate((el: Element) => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
              }) as boolean;
              if (isVisible) {
                searchBox = textarea;
                console.log(`      ✅ Found visible textarea to use as search box`);
                break;
              }
            }
            
            // If no textarea, try first visible input
            if (!searchBox) {
              for (const input of allInputs) {
                const isVisible = await input.evaluate((el: Element) => {
                  const rect = el.getBoundingClientRect();
                  return rect.width > 0 && rect.height > 0;
                }) as boolean;
                if (isVisible) {
                  searchBox = input;
                  console.log(`      ✅ Found visible input to use as search box`);
                  break;
                }
              }
            }
          } catch (e) {
            console.log(`      ⚠️  Error finding search box: ${(e as Error).message}`);
          }
        }
        
        if (!searchBox) {
          console.log(`      ❌ Could not find Google search box at all - cannot perform search`);
          console.log(`      ⚠️  Will attempt direct DOM injection and URL navigation fallback`);
          try {
            await page.evaluate((text: string) => {
              const el = (document as any).querySelector('textarea[name="q"],input[name="q"]') as any;
              if (el) {
                el.focus();
                el.value = text;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                const form = el.form || (document as any).querySelector('form[action="/search"]') as any;
                if (form) form.submit();
              }
            }, query);
            await waitForTimeout(2000);
          } catch {}
          // If still not on results, try hard navigation to search URL
          if (!page.url().includes('/search?')) {
            const hardUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=us`;
            console.log(`      🔁 Hard navigation to: ${hardUrl.substring(0, 100)}...`);
            await page.goto(hardUrl, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
          }
        } else {
          // Clear any existing text and focus
          console.log(`      🔧 Clearing and focusing search box...`);
          try {
            await searchBox.click();
            await waitForTimeout(300);
          } catch (clickErr: any) {
            console.log(`      ⚠️  Click failed, trying focus: ${clickErr.message}`);
            await searchBox.focus();
          }
          
          await waitForTimeout(200);
          
          // Clear existing text
          try {
            await searchBox.evaluate((el: any) => {
              el.select();
              el.value = '';
            });
          } catch (fillErr: any) {
            console.log(`      ⚠️  Clear failed: ${fillErr.message}`);
          }
          await waitForTimeout(200);
          
          // Type the search query character by character
          console.log(`      ⌨️  Typing search query: "${query}"`);
          let typingSuccess = false;
          try {
            await searchBox.type(query, { delay: 50 });
            typingSuccess = true;
            console.log(`      ✅ Typing completed successfully`);
          } catch (typeError: any) {
            console.log(`      ⚠️  Type failed, trying fill + events: ${typeError.message}`);
            try {
              await searchBox.evaluate((el: any, text: string) => {
                el.value = text;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }, query);
              typingSuccess = true;
              console.log(`      ✅ Fill + events completed`);
            } catch (fillError: any) {
              console.log(`      ⚠️  Fill also failed: ${fillError.message}, trying direct DOM manipulation`);
              const finalSelector = searchBoxSelectors.find((s, i) => searchBox && i < 10) || 'textarea[name="q"]';
              await page.evaluate((args: { sel: string; text: string }) => {
                const el = (document as any).querySelector(args.sel) as any;
                if (el) {
                  el.value = args.text;
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }, { sel: finalSelector, text: query });
              typingSuccess = true;
              console.log(`      ✅ Direct DOM manipulation completed`);
            }
          }
          
          if (!typingSuccess) {
            throw new Error('All typing methods failed');
          }
          
          await waitForTimeout(500);
          
          // Press Enter to search - try multiple methods
          console.log(`      ⌨️  Pressing Enter to execute search...`);
          let enterPressed = false;
          try { 
            await searchBox.press('Enter'); 
            enterPressed = true;
          } catch (e1) {
            console.log(`      ⚠️  SearchBox Enter failed, trying keyboard...`);
          }
          if (!enterPressed) {
            try { 
              await page.keyboard.press('Enter'); 
              enterPressed = true;
            } catch (e2) {
              console.log(`      ⚠️  Keyboard Enter failed, trying form submit...`);
            }
          }
          if (!enterPressed) {
            try {
              await page.evaluate(() => {
                const form = (document as any).querySelector('form[action="/search"]') as any;
                if (form) form.submit();
              });
            } catch {}
          }
          
          // Wait for search results to load - manually poll URL
          console.log(`      ⏳ Waiting for search results to load...`);
          let urlMatched = false;
          for (let i = 0; i < 14; i++) { // 7 seconds max (14 * 500ms)
            await waitForTimeout(500);
            const currentUrl = page.url();
            if (/google\.[^/]+\/search.*[?&]q=/.test(currentUrl)) {
              urlMatched = true;
              break;
            }
          }
          if (!urlMatched) {
            await waitForTimeout(3000);
          }
          
          const finalUrl = page.url();
          console.log(`      ✅ Search executed! Final URL: ${finalUrl}`);
          
          // Verify search happened
          if (finalUrl.includes('/search?') || finalUrl.toLowerCase().includes(searchQueryLower.replace(/\s+/g, '+'))) {
            console.log(`      ✅ Search confirmed - results page loaded`);
          } else {
            console.log(`      ⚠️  Search may not have executed. Trying one last hard navigation...`);
            const hardUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=us`;
            await page.goto(hardUrl, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
          }
        }
      } catch (typingError: any) {
        console.log(`      ⚠️  Failed to type search query: ${typingError.message}`);
        console.log(`      ⚠️  Continuing anyway - URL navigation may have worked...`);
      }
    } else {
      console.log(`      ✅ Search query confirmed in URL - navigation worked correctly`);
      // Even if URL looks correct, double-check by verifying we can see search results
      try {
        const hasResults = await page.evaluate(() => {
          return (document as any).querySelector('#search') !== null || 
                 (document as any).querySelector('[id^="rso"]') !== null ||
                 (document as any).querySelector('.g') !== null ||
                 (document as any).querySelector('[data-ved]') !== null;
        }) as boolean;
        if (!hasResults) {
          console.log(`      ⚠️  URL looks correct but no search results found - forcing typing anyway...`);
          throw new Error('No search results found despite correct URL');
        }
      } catch (e) {
        console.log(`      ⚠️  Search results verification failed - will force typing...`);
      }
    }
    
    // Check for CAPTCHA before waiting for Keywords Everywhere
    const captchaBeforeWait = await detectCaptcha(page);
    if (captchaBeforeWait) {
      console.warn(`      ⚠️  [CAPTCHA] Google CAPTCHA detected before extracting data for "${query}"`);
      return {
        volume: 0,
        similarKeywords: []
      };
    }
    
    // Wait a bit for Keywords Everywhere extension to inject data (with random delay)
    const waitTime = 3000 + Math.random() * 2000; // 3-5 seconds
    console.log(`      ⏳ Waiting ${(waitTime / 1000).toFixed(1)} seconds for Keywords Everywhere extension...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Add some human-like mouse movement while waiting
    await humanMouseMovement(page);
    
    console.log(`      ✅ Wait complete, extracting volume data...`);
    
    // Check for CAPTCHA after waiting
    const captchaAfterWait = await detectCaptcha(page);
    if (captchaAfterWait) {
      console.warn(`      ⚠️  [CAPTCHA] Google CAPTCHA appeared while waiting for extension for "${query}"`);
      return {
        volume: 0,
        similarKeywords: []
      };
    }
    
    // Check cancellation after wait
    if (checkCancellation && checkCancellation()) {
      throw new Error('Analysis cancelled by user');
    }

    // Try multiple selectors for Keywords Everywhere volume data
    console.log(`      🔎 [Keywords Everywhere] Searching page for volume data...`);
    console.log(`      📄 Page URL: ${page.url()}`);
    const selectors = [
      '[class*="kw-data"]',
      '[class*="ke-data"]',
      '[class*="keywords-everywhere"]',
      '[class*="kw-volume"]',
      '[class*="ke-volume"]',
      '[data-kw-volume]',
      '[data-ke-volume]',
      '[data-volume]',
      '.kw-data',
      '.ke-data',
    ];

    let volume = 0;
    let cpc: number | undefined = undefined;

    for (const selector of selectors) {
      try {
        // Try to find the volume element
        const elements = await page.$$(selector);
        
        for (const element of elements) {
          try {
            // Get text content
            const text = await element.evaluate((el: Element) => el.textContent || '') as string;
            if (!text) continue;

            // Try to extract volume from text
            // Patterns: "1,200", "1.2K", "1.2K searches/month", etc.
            const volumeMatch = text.match(/(\d{1,3}(?:[.,]\d{3})*(?:[KMkm])?)/);
            if (volumeMatch) {
              let volStr = volumeMatch[1].replace(/,/g, '');
              
              // Handle K/M suffixes
              if (/[KMkm]$/.test(volStr)) {
                const num = parseFloat(volStr.slice(0, -1));
                const suffix = volStr.slice(-1).toUpperCase();
                volume = suffix === 'K' ? Math.round(num * 1000) : Math.round(num * 1000000);
              } else {
                volume = parseInt(volStr, 10);
              }

              if (volume > 0) {
                console.log(`      ✅ [Keywords Everywhere] Found volume ${volume} for "${keyword}" via selector: ${selector}`);
                break;
              }
            }

            // Try data attributes
            const dataVolume = await element.evaluate((el: Element) =>
              el.getAttribute('data-kw-volume') || 
              el.getAttribute('data-ke-volume') ||
              el.getAttribute('data-volume')
            ) as string | null;
            if (dataVolume) {
              volume = parseInt(dataVolume.replace(/,/g, ''), 10);
              if (volume > 0) {
                console.log(`✅ Found volume ${volume} for "${keyword}" via data attribute`);
                break;
              }
            }
          } catch (e) {
            // Continue to next element
            continue;
          }
        }

        if (volume > 0) break;
      } catch (e) {
        // Continue to next selector
        continue;
      }
    }

    // Extract CPC data from Keywords Everywhere
    console.log(`      🔎 [Keywords Everywhere] Searching for CPC data...`);
    const cpcSelectors = [
      '[class*="kw-cpc"]',
      '[class*="ke-cpc"]',
      '[class*="kw-cost"]',
      '[class*="ke-cost"]',
      '[data-kw-cpc]',
      '[data-ke-cpc]',
      '[data-cpc]',
      '.kw-cpc',
      '.ke-cpc',
    ];

    for (const selector of cpcSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          try {
            const text = await element.evaluate((el: Element) => el.textContent || '') as string;
            if (!text) continue;

            // Extract CPC - patterns like "$5.50", "$12.34", "5.50", etc.
            const cpcMatch = text.match(/\$?(\d+\.?\d*)/);
            if (cpcMatch) {
              const cpcValue = parseFloat(cpcMatch[1]);
              if (cpcValue > 0 && cpcValue < 1000) { // Sanity check
                cpc = Math.round(cpcValue * 100) / 100; // Round to 2 decimals
                console.log(`      ✅ [Keywords Everywhere] Found CPC $${cpc} for "${keyword}"`);
                break;
              }
            }

            // Try data attributes
            const dataCpc = await element.evaluate((el: Element) =>
              el.getAttribute('data-kw-cpc') || 
              el.getAttribute('data-ke-cpc') ||
              el.getAttribute('data-cpc')
            ) as string | null;
            if (dataCpc) {
              const cpcValue = parseFloat(dataCpc.replace(/[$,]/g, ''));
              if (cpcValue > 0 && cpcValue < 1000) {
                cpc = Math.round(cpcValue * 100) / 100;
                console.log(`      ✅ [Keywords Everywhere] Found CPC $${cpc} via data attribute`);
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
        if (cpc !== undefined) break;
      } catch (e) {
        continue;
      }
    }

    // If no CPC found via selectors, try page content
    if (cpc === undefined) {
      const pageContent = await page.content();
      const cpcPatterns = [
        /\$(\d+\.?\d*)[\s]*(?:CPC|cost|per click)/i,
        /(?:CPC|cost)[\s:]*\$?(\d+\.?\d*)/i,
      ];

      for (const pattern of cpcPatterns) {
        const match = pageContent.match(pattern);
        if (match) {
          const cpcValue = parseFloat(match[1]);
          if (cpcValue > 0 && cpcValue < 1000) {
            cpc = Math.round(cpcValue * 100) / 100;
            console.log(`      ✅ [Keywords Everywhere] Found CPC $${cpc} via content pattern`);
            break;
          }
        }
      }
    }

    // If no volume found via selectors, try looking at page content for volume patterns
    if (volume === 0) {
      const pageContent = await page.content();
      
      // Look for volume patterns in the HTML
      const volumePatterns = [
        /(\d{1,3}(?:,\d{3})*)[\s]*(?:searches|volume|month)/i,
        /(?:searches|volume)[\s:]*(\d{1,3}(?:,\d{3})*)/i,
        /(\d+\.?\d*)[KMkm][\s]*(?:searches|volume|month)/i,
      ];

      for (const pattern of volumePatterns) {
        const match = pageContent.match(pattern);
        if (match) {
          let volStr = match[1].replace(/,/g, '');
          volume = parseInt(volStr, 10);
          if (volume > 0) {
            console.log(`✅ Found volume ${volume} for "${keyword}" via content pattern`);
            break;
          }
        }
      }
    }

    // If still no volume, check if we can see the keyword in results
    if (volume === 0) {
      console.log(`⚠️  No volume data found for "${keyword}" in ${city}, ${state}`);
      console.log(`   This could mean:`);
      console.log(`   - Keywords Everywhere extension is not installed or enabled`);
      console.log(`   - Volume data is not available for this keyword`);
      console.log(`   - Extension uses different class names than expected`);
    }

    // Extract similar keywords from Keywords Everywhere UI if niche is provided
    let similarKeywords: string[] = [];
    if (niche) {
      try {
        similarKeywords = await extractSimilarKeywords(page, niche, city, state);
        if (similarKeywords.length > 0) {
          console.log(`   🔍 Discovered ${similarKeywords.length} similar keywords from Keywords Everywhere`);
        }
      } catch (error: any) {
        console.warn(`   ⚠️  Could not extract similar keywords: ${error.message}`);
      }
    }

    // Save to cache (only if volume > 0 - don't cache "no data" as 0)
    if (volume > 0) {
      // Helper function to retry Prisma queries with reconnection on prepared statement errors
      const retryPrismaQuery = async <T>(
        queryFn: () => Promise<T>,
        retries: number = 5
      ): Promise<T> => {
        let attempt = 0;
        while (retries > 0) {
          attempt++;
          try {
            return await queryFn();
          } catch (error: any) {
            // Check for prepared statement errors (both "does not exist" and "already exists")
            const isPreparedStatementError = 
              error.code === '26000' || // prepared statement does not exist
              error.code === '42P05' || // prepared statement already exists
              error.message?.includes('prepared statement');
            
            if (isPreparedStatementError && retries > 1) {
              retries--;
              const waitTime = 500 + (attempt * 200); // Progressive backoff: 500ms, 700ms, 900ms, etc.
              console.log(`   ⚠️  [DB_RETRY] Prepared statement error (attempt ${attempt}/${5 - retries + 1}), retrying in ${waitTime}ms...`);
              
              // Wait with progressive backoff
              await new Promise(resolve => setTimeout(resolve, waitTime));
              
              // Disconnect and reconnect Prisma to clear connection state
              try {
                await prisma.$disconnect();
                await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause between disconnect/connect
              } catch (e) {
                // Ignore disconnect errors
              }
              try {
                await prisma.$connect();
              } catch (e) {
                // Ignore connect errors, will retry
              }
              continue;
            }
            throw error;
          }
        }
        throw new Error('Query failed after retries');
      };

      const existing = await retryPrismaQuery(() =>
        prisma.volumeSample.findFirst({
          where: { keyword, city, state },
        })
      );

      if (existing) {
        await retryPrismaQuery(() =>
          prisma.volumeSample.update({
            where: { id: existing.id },
            data: {
              volume,
              source: 'keywords-everywhere',
              capturedAt: new Date(),
            },
          })
        );
      } else {
        await retryPrismaQuery(() =>
          prisma.volumeSample.create({
            data: {
              keyword,
              city,
              state,
              volume,
              source: 'keywords-everywhere',
              capturedAt: new Date(),
            },
          })
        );
      }
    } else {
      console.log(`   ℹ️  Volume is 0 (no data) - not caching to avoid invalid data`);
    }

    // FINAL GUARD: For city queries, verify the search query actually contained the city
    // We searched for "keyword city", so the extension should show data for that exact query
    // If we're getting volume but the query doesn't contain the city, something went wrong
    let finalVolume = volume;
    if (city) {
      // The query variable contains what we actually searched for (e.g., "plumber Morrison")
      const queryLower = query.toLowerCase();
      const cityLower = city.toLowerCase();
      const keywordLower = keyword.toLowerCase();
      
      const queryContainsCity = queryLower.includes(cityLower);
      const queryContainsKeyword = queryLower.includes(keywordLower);
      
      if (!queryContainsCity || !queryContainsKeyword) {
        console.log(`   ⚠️  [LOCAL_VOLUME_REJECT] Search query "${query}" doesn't contain city "${city}" - rejecting volume ${volume}`);
        console.log(`   ⚠️  [LOCAL_VOLUME_REJECT] This suggests the search didn't include the city properly`);
        finalVolume = 0;
      } else {
        // Query contains city - the extension should be showing data for "keyword city"
        // Accept the volume (it should be local data for that city)
        console.log(`   ✅ [LOCAL_VOLUME_ACCEPT] Search query "${query}" contains city "${city}" - accepting volume ${volume}`);
      }
    }

    return { volume: finalVolume, cpc, similarKeywords };
  } catch (error: any) {
    console.error(`\n      ❌ ========================================`);
    console.error(`      ❌ ERROR in getVolumeFromKeywordsEverywhere`);
    console.error(`      ❌ Keyword: "${keyword}"`);
    console.error(`      ❌ Location: ${city}, ${state}`);
    console.error(`      ❌ Error message: ${error.message}`);
    console.error(`      ❌ Error stack: ${error.stack?.substring(0, 300)}`);
    console.error(`      ❌ ========================================\n`);
    // Return 0 volume and empty keywords if we can't get data
    return { volume: 0, cpc: undefined, similarKeywords: [] };
  } finally {
    // Only close page if we created it (not if it was reused)
    if (shouldClosePage) {
      await page.close();
    }
  }
}
