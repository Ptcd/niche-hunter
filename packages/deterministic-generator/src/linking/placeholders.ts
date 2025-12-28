/**
 * Placeholder token definitions and utilities
 */

export const PLACEHOLDER_PATTERNS = {
  INTERNAL: /\[\[INTERNAL:([^\]]+)\]\]/g,
  EXTERNAL_STATE: /\[\[EXTERNAL:STATE_RESOURCE\]\]/g,
  EXTERNAL_WIKI: /\[\[EXTERNAL:WIKI_SERVICE\]\]/g,
  EXTERNAL_CUSTOM: /\[\[EXTERNAL:([^\]]+)\]\]/g,
} as const;

/**
 * Find all internal link placeholders in HTML
 */
export function findInternalPlaceholders(html: string): string[] {
  const matches: string[] = [];
  let match;
  
  while ((match = PLACEHOLDER_PATTERNS.INTERNAL.exec(html)) !== null) {
    matches.push(match[1]); // Extract the slug
  }
  
  return matches;
}

/**
 * Find all external link placeholders in HTML
 */
export function findExternalPlaceholders(html: string): string[] {
  const matches: string[] = [];
  let match;
  
  // Check for STATE_RESOURCE
  if (PLACEHOLDER_PATTERNS.EXTERNAL_STATE.test(html)) {
    matches.push('STATE_RESOURCE');
  }
  
  // Reset regex
  PLACEHOLDER_PATTERNS.EXTERNAL_STATE.lastIndex = 0;
  
  // Check for WIKI_SERVICE
  if (PLACEHOLDER_PATTERNS.EXTERNAL_WIKI.test(html)) {
    matches.push('WIKI_SERVICE');
  }
  
  // Reset regex
  PLACEHOLDER_PATTERNS.EXTERNAL_WIKI.lastIndex = 0;
  
  // Check for custom external placeholders
  while ((match = PLACEHOLDER_PATTERNS.EXTERNAL_CUSTOM.exec(html)) !== null) {
    if (match[1] !== 'STATE_RESOURCE' && match[1] !== 'WIKI_SERVICE') {
      matches.push(match[1]);
    }
  }
  
  return matches;
}

/**
 * Check if HTML contains any placeholders
 */
export function hasPlaceholders(html: string): boolean {
  return (
    PLACEHOLDER_PATTERNS.INTERNAL.test(html) ||
    PLACEHOLDER_PATTERNS.EXTERNAL_STATE.test(html) ||
    PLACEHOLDER_PATTERNS.EXTERNAL_WIKI.test(html) ||
    PLACEHOLDER_PATTERNS.EXTERNAL_CUSTOM.test(html)
  );
}

/**
 * Count internal placeholders
 */
export function countInternalPlaceholders(html: string): number {
  const matches = html.match(PLACEHOLDER_PATTERNS.INTERNAL);
  return matches ? matches.length : 0;
}

/**
 * Count external placeholders
 */
export function countExternalPlaceholders(html: string): number {
  let count = 0;
  
  if (PLACEHOLDER_PATTERNS.EXTERNAL_STATE.test(html)) count++;
  PLACEHOLDER_PATTERNS.EXTERNAL_STATE.lastIndex = 0;
  
  if (PLACEHOLDER_PATTERNS.EXTERNAL_WIKI.test(html)) count++;
  PLACEHOLDER_PATTERNS.EXTERNAL_WIKI.lastIndex = 0;
  
  const customMatches = html.match(PLACEHOLDER_PATTERNS.EXTERNAL_CUSTOM);
  if (customMatches) {
    count += customMatches.filter(m => !m.includes('STATE_RESOURCE') && !m.includes('WIKI_SERVICE')).length;
  }
  
  return count;
}

