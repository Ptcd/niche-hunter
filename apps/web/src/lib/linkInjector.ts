/**
 * Link Injector
 * 
 * Automatically inserts internal links into generated content.
 * Scans content for keyword mentions and links them to relevant pages.
 */

export interface PageLink {
  slug: string;
  title: string;
  focusKeyword: string;
  supportingKeywords: string[];
}

/**
 * Extract keywords from a page (focus + supporting)
 */
function extractPageKeywords(page: PageLink): string[] {
  const keywords = new Set<string>();
  
  // Add focus keyword
  if (page.focusKeyword) {
    keywords.add(page.focusKeyword.toLowerCase());
  }
  
  // Add supporting keywords
  if (page.supportingKeywords) {
    for (const kw of page.supportingKeywords) {
      if (kw) {
        keywords.add(kw.toLowerCase().trim());
      }
    }
  }
  
  // Extract individual words from multi-word keywords
  const expandedKeywords = new Set<string>();
  for (const kw of keywords) {
    expandedKeywords.add(kw);
    // Add individual significant words (length > 3)
    const words = kw.split(/\s+/).filter(w => w.length > 3);
    for (const word of words) {
      expandedKeywords.add(word);
    }
  }
  
  return Array.from(expandedKeywords);
}

/**
 * Find best matching page for a keyword mention
 */
function findBestMatch(
  keywordMention: string,
  pages: PageLink[],
  excludeSlug?: string
): PageLink | null {
  const mentionLower = keywordMention.toLowerCase().trim();
  
  // Score each page
  const scored = pages
    .filter(p => p.slug !== excludeSlug) // Don't link to self
    .map(page => {
      const pageKeywords = extractPageKeywords(page);
      let score = 0;
      
      // Exact match on focus keyword = highest score
      if (page.focusKeyword.toLowerCase() === mentionLower) {
        score += 100;
      }
      
      // Partial match on focus keyword
      if (page.focusKeyword.toLowerCase().includes(mentionLower) || 
          mentionLower.includes(page.focusKeyword.toLowerCase())) {
        score += 50;
      }
      
      // Match on supporting keywords
      for (const kw of pageKeywords) {
        if (kw === mentionLower) {
          score += 30;
        } else if (kw.includes(mentionLower) || mentionLower.includes(kw)) {
          score += 15;
        }
      }
      
      return { page, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  
  return scored.length > 0 ? scored[0].page : null;
}

/**
 * Inject internal links into HTML content
 * 
 * @param content - HTML content string
 * @param pages - Array of pages to link to
 * @param currentPageSlug - Slug of current page (to exclude self-links)
 * @param maxLinks - Maximum number of links to insert (default: 5)
 * @returns HTML content with links inserted
 */
export function injectInternalLinks(
  content: string,
  pages: PageLink[],
  currentPageSlug?: string,
  maxLinks: number = 5
): string {
  if (pages.length === 0) {
    return content;
  }
  
  let modifiedContent = content;
  const linkCount = new Map<string, number>(); // Track links per page to avoid over-linking
  let totalLinksInserted = 0;
  
  // Find keyword mentions in content (avoiding existing links)
  // Look for phrases that match page keywords, but not inside <a> tags
  
  // Strategy: Find text nodes and check for keyword matches
  // For simplicity, we'll use regex to find potential matches, then verify they're not in links
  
  // Extract all page keywords with their target pages
  const keywordMap = new Map<string, PageLink>();
  
  for (const page of pages) {
    const keywords = extractPageKeywords(page);
    for (const kw of keywords) {
      // Only add if keyword is substantial (2+ words or single word > 4 chars)
      if (kw.split(/\s+/).length >= 2 || kw.length > 4) {
        if (!keywordMap.has(kw) || page.focusKeyword.toLowerCase() === kw) {
          keywordMap.set(kw, page);
        }
      }
    }
  }
  
  // Sort keywords by length (longest first) to match longer phrases first
  const sortedKeywords = Array.from(keywordMap.keys()).sort((a, b) => b.length - a.length);
  
  // For each keyword, find and link first occurrence
  for (const keyword of sortedKeywords) {
    if (totalLinksInserted >= maxLinks) break;
    
    const targetPage = keywordMap.get(keyword);
    if (!targetPage || targetPage.slug === currentPageSlug) continue;
    
    // Check if we've already linked to this page too many times
    const linkCountForPage = linkCount.get(targetPage.slug) || 0;
    if (linkCountForPage >= 2) continue; // Max 2 links per page
    
    // Create regex to find keyword (case-insensitive, word boundaries)
    // But exclude if already inside an <a> tag
    const regex = new RegExp(`\\b(${escapeRegex(keyword)})\\b`, 'gi');
    
    // Check if keyword appears in content (not in links)
    const matches = Array.from(modifiedContent.matchAll(regex));
    
    for (const match of matches) {
      if (totalLinksInserted >= maxLinks) break;
      
      const matchIndex = match.index!;
      const beforeMatch = modifiedContent.substring(0, matchIndex);
      const afterMatch = modifiedContent.substring(matchIndex + match[0].length);
      
      // Check if we're inside an <a> tag
      const lastOpenTag = beforeMatch.lastIndexOf('<a');
      const lastCloseTag = beforeMatch.lastIndexOf('</a>');
      
      if (lastOpenTag > lastCloseTag) {
        // We're inside a link, skip
        continue;
      }
      
      // Check if we're inside any HTML tag (to avoid breaking tags)
      const lastTagOpen = beforeMatch.lastIndexOf('<');
      const lastTagClose = beforeMatch.lastIndexOf('>');
      
      if (lastTagOpen > lastTagClose && lastTagOpen > matchIndex - 50) {
        // Might be inside a tag, be more careful
        const tagContent = modifiedContent.substring(lastTagOpen, matchIndex + match[0].length);
        if (tagContent.includes('>')) {
          // Tag is closed, safe to proceed
        } else {
          // Still inside tag, skip
          continue;
        }
      }
      
      // Safe to insert link
      const linkText = match[1]; // Preserve original case
      const linkUrl = `/${targetPage.slug}`;
      const linkHtml = `<a href="${linkUrl}">${linkText}</a>`;
      
      modifiedContent = beforeMatch + linkHtml + afterMatch;
      
      linkCount.set(targetPage.slug, linkCountForPage + 1);
      totalLinksInserted++;
      
      // Only link first occurrence of each keyword
      break;
    }
  }
  
  return modifiedContent;
}

/**
 * Add "Related Services" section with explicit links
 */
export function addRelatedServicesSection(
  pages: PageLink[],
  currentPageSlug?: string,
  maxServices: number = 5
): string {
  const relatedPages = pages
    .filter(p => p.slug !== currentPageSlug && p.slug !== 'home' && p.slug !== 'about' && p.slug !== 'contact')
    .slice(0, maxServices);
  
  if (relatedPages.length === 0) {
    return '';
  }
  
  const linksHtml = relatedPages
    .map(page => `<li><a href="/${page.slug}">${page.title || page.focusKeyword}</a></li>`)
    .join('\n    ');
  
  return `
<section class="related-services-section">
  <h2>Related Services</h2>
  <ul class="related-services-list">
    ${linksHtml}
  </ul>
</section>
  `.trim();
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

