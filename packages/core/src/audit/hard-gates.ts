/**
 * Hard Gates Evaluation (G1-G4)
 * 
 * Determines if a page is viable to score.
 * A single FAIL = overall status = "BROKEN"
 */

import { GateStatus, PageAuditInput, HardGatesResult, SiteWideLocationPage } from './types';

/**
 * G1 - Indexability Gate
 * Checks: HTTP 200, no noindex, canonical OK, robots.txt
 */
export function evaluateG1Indexability(
  html: string,
  url: string,
  httpStatus?: number
): GateStatus {
  // Check HTTP status (if provided)
  if (httpStatus !== undefined && httpStatus !== 200) {
    return 'FAIL';
  }

  // Check robots meta tag
  const robotsMetaRegex = /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i;
  const robotsMatch = html.match(robotsMetaRegex);
  if (robotsMatch) {
    const content = robotsMatch[1].toLowerCase();
    if (content.includes('noindex')) {
      return 'FAIL';
    }
  }

  // Check canonical
  const canonicalRegex = /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i;
  const canonicalMatch = html.match(canonicalRegex);
  
  if (!canonicalMatch) {
    return 'WARN'; // Canonical missing
  }

  const canonicalUrl = canonicalMatch[1];
  const pageUrlObj = new URL(url);
  const canonicalUrlObj = new URL(canonicalUrl, url); // Resolve relative URLs

  // If canonical points to different URL (but same domain), warn
  if (canonicalUrlObj.href !== pageUrlObj.href && 
      canonicalUrlObj.hostname === pageUrlObj.hostname) {
    return 'WARN';
  }

  // Note: robots.txt check would require HTTP fetch, skip for now
  // Could be added later with fetch capability

  return 'PASS';
}

/**
 * G2 - Page Hygiene Gate
 * Checks: Title, H1, meta description, minimum word count, no placeholder content
 */
export function evaluateG2PageHygiene(html: string): GateStatus {
  const flags: { fail: boolean; warn: boolean } = { fail: false, warn: false };

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!titleMatch || !titleMatch[1].trim()) {
    flags.fail = true;
  }

  // Extract H1 (allow nested content like spans)
  const h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi);
  if (!h1Matches || h1Matches.length === 0) {
    flags.warn = true;
  } else if (h1Matches.length > 1) {
    flags.warn = true; // Multiple H1s
  } else {
    // Check that H1 has actual text content
    const h1Content = h1Matches[0].replace(/<[^>]+>/g, '').trim();
    if (!h1Content || h1Content.length === 0) {
      flags.warn = true;
    }
  }

  // Extract meta description
  const metaDescRegex = /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i;
  const metaDescMatch = html.match(metaDescRegex);
  if (!metaDescMatch) {
    flags.warn = true;
  } else {
    const descLength = metaDescMatch[1].length;
    if (descLength < 50 || descLength > 180) {
      flags.warn = true;
    }
  }

  // Extract visible text and count words
  // Works with both full HTML documents and partial HTML (like WordPress post_content)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const mainMatch = html.match(/<main[^>]*>([\s\S]*)<\/main>/i);
  const contentHtml = bodyMatch ? bodyMatch[1] : (mainMatch ? mainMatch[1] : html);
  
  const bodyText = contentHtml
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;
  
  if (wordCount < 400) {
    flags.warn = true;
  }

  // Check for placeholder content
  const placeholderPatterns = [
    /lorem\s+ipsum/i,
    /coming\s+soon/i,
    /under\s+construction/i,
    /placeholder/i,
    /sample\s+text/i,
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(html)) {
      flags.fail = true;
      break;
    }
  }

  if (flags.fail) return 'FAIL';
  if (flags.warn) return 'WARN';
  return 'PASS';
}

/**
 * G3 - Local Presence Gate (NAP)
 * Behavior differs for storefront vs service_area
 */
export function evaluateG3LocalPresence(
  html: string,
  input: PageAuditInput
): GateStatus {
  const flags: { fail: boolean; warn: boolean } = { fail: false, warn: false };

  // Check for phone number
  const phonePatterns = [
    new RegExp(input.primaryPhone.replace(/[^\d]/g, '\\d*'), 'i'),
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/,
  ];

  let phoneFound = false;
  for (const pattern of phonePatterns) {
    if (pattern.test(html)) {
      phoneFound = true;
      break;
    }
  }

  if (!phoneFound) {
    return 'FAIL'; // Phone is required for both types
  }

  // Check for city/state mention
  const cityStatePattern = new RegExp(
    `(${input.targetCity}|${input.targetState})`,
    'i'
  );
  const mentionsCityState = cityStatePattern.test(html);

  if (!mentionsCityState) {
    flags.warn = true;
  }

  if (input.businessType === 'storefront') {
    // Storefront requires address or map
    const hasAddress = /(\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|way|lane|ln))/i.test(html);
    const hasMap = /maps\.google|google.*maps|iframe.*maps/i.test(html);
    
    if (!hasAddress && !hasMap) {
      flags.warn = true;
    }
  }
  // Service area: address is optional, just need city mention

  if (flags.fail) return 'FAIL';
  if (flags.warn) return 'WARN';
  return 'PASS';
}

/**
 * G4 - Duplicate Content Gate
 * Compares page against other location pages using shingle similarity
 */
export function evaluateG4DuplicateContent(
  html: string,
  siteWideLocationPages?: SiteWideLocationPage[]
): GateStatus {
  if (!siteWideLocationPages || siteWideLocationPages.length === 0) {
    return 'PASS'; // No other pages to compare
  }

  // Extract main content (remove nav, footer, scripts)
  const normalizeText = (html: string): string => {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (!bodyMatch) return '';
    
    return bodyMatch[1]
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
  };

  const thisPageText = normalizeText(html);
  const thisPageWords = thisPageText.split(/\s+/).filter(w => w.length > 2);

  if (thisPageWords.length < 400) {
    return 'WARN'; // Thin content
  }

  // Generate 3-word shingles
  const generateShingles = (words: string[]): Set<string> => {
    const shingles = new Set<string>();
    for (let i = 0; i < words.length - 2; i++) {
      shingles.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
    return shingles;
  };

  const thisShingles = generateShingles(thisPageWords);

  let maxSimilarity = 0;

  for (const otherPage of siteWideLocationPages) {
    const otherText = normalizeText(otherPage.html);
    const otherWords = otherText.split(/\s+/).filter(w => w.length > 2);
    const otherShingles = generateShingles(otherWords);

    // Jaccard similarity
    const intersection = new Set(
      [...thisShingles].filter(s => otherShingles.has(s))
    );
    const union = new Set([...thisShingles, ...otherShingles]);
    const similarity = union.size > 0 ? intersection.size / union.size : 0;

    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  // Thresholds
  if (maxSimilarity >= 0.95) {
    return 'FAIL'; // Near-clone / doorway
  }
  if (maxSimilarity >= 0.80) {
    return 'WARN'; // Heavy boilerplate
  }

  return 'PASS';
}

/**
 * Evaluate all hard gates
 */
export function evaluateHardGates(
  input: PageAuditInput,
  html: string,
  httpStatus?: number,
  siteWideLocationPages?: SiteWideLocationPage[]
): HardGatesResult {
  return {
    G1_indexability: evaluateG1Indexability(html, input.url, httpStatus),
    G2_page_hygiene: evaluateG2PageHygiene(html),
    G3_local_presence: evaluateG3LocalPresence(html, input),
    G4_duplicate_content: evaluateG4DuplicateContent(html, siteWideLocationPages),
  };
}

