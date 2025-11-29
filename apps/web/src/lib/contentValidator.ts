/**
 * Content Validator
 * 
 * Pre-flight checks before saving generated content to ensure
 * it meets SEO audit requirements.
 */

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  field?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  score: number; // 0-100, estimated audit score
}

/**
 * Validate generated page content against SEO audit requirements
 */
export function validatePageContent(
  html: string,
  titleTag: string | null,
  focusKeyword: string,
  city: string,
  state: string,
  phoneNumber?: string
): ValidationResult {
  const issues: ValidationIssue[] = [];
  let score = 100;

  // Extract text content
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
  const textLower = textContent.toLowerCase();
  const titleLower = (titleTag || '').toLowerCase();
  const keywordLower = focusKeyword.toLowerCase();
  const cityLower = city.toLowerCase();
  const stateLower = state.toLowerCase();

  // Check 1: Title tag contains city
  if (!titleTag || titleTag.trim().length === 0) {
    issues.push({
      severity: 'error',
      message: 'Title tag is missing',
      field: 'titleTag',
    });
    score -= 20;
  } else if (!titleLower.includes(cityLower) && !titleLower.includes(keywordLower)) {
    issues.push({
      severity: 'warning',
      message: `Title tag doesn't include "${city}" or focus keyword`,
      field: 'titleTag',
    });
    score -= 10;
  }

  // Check 2: H1 contains service + city
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (!h1Match) {
    issues.push({
      severity: 'error',
      message: 'H1 tag is missing',
      field: 'h1',
    });
    score -= 15;
  } else {
    const h1Text = h1Match[1].toLowerCase();
    if (!h1Text.includes(keywordLower.split(' ')[0]) || !h1Text.includes(cityLower)) {
      issues.push({
        severity: 'warning',
        message: `H1 doesn't include both service and "${city}"`,
        field: 'h1',
      });
      score -= 10;
    }
  }

  // Check 3: Phone number present
  if (phoneNumber) {
    const phoneClean = phoneNumber.replace(/[^\d]/g, '');
    const phonePattern = new RegExp(phoneClean.replace(/\d/g, '\\d*'), 'i');
    if (!phonePattern.test(html) && !html.includes(`tel:${phoneClean}`)) {
      issues.push({
        severity: 'error',
        message: 'Phone number not found in content',
        field: 'phone',
      });
      score -= 15;
    }
  }

  // Check 4: Minimum word count (1000+)
  if (wordCount < 1000) {
    issues.push({
      severity: 'warning',
      message: `Content is only ${wordCount} words. Target 1000+ words for better SEO.`,
      field: 'wordCount',
    });
    score -= 5;
  }

  // Check 5: FAQ section exists
  if (!textLower.includes('faq') && !textLower.includes('frequently asked') && !html.includes('faq-accordion')) {
    issues.push({
      severity: 'warning',
      message: 'FAQ section not found. FAQ sections help with SERP features.',
      field: 'faq',
    });
    score -= 5;
  }

  // Check 6: City mentions (5+)
  const cityMentions = (textLower.match(new RegExp(cityLower, 'g')) || []).length;
  if (cityMentions < 5) {
    issues.push({
      severity: 'warning',
      message: `Only ${cityMentions} mentions of "${city}". Target 5+ for better local SEO.`,
      field: 'localSignals',
    });
    score -= 5;
  }

  // Check 7: State mentions (2+)
  const stateMentions = (textLower.match(new RegExp(stateLower, 'g')) || []).length;
  if (stateMentions < 2) {
    issues.push({
      severity: 'warning',
      message: `Only ${stateMentions} mentions of "${state}". Target 2+ for better local SEO.`,
      field: 'localSignals',
    });
    score -= 3;
  }

  // Check 8: Primary keyword in first paragraph
  const firstParagraphMatch = html.match(/<p[^>]*>([^<]+)<\/p>/i);
  if (firstParagraphMatch) {
    const firstPara = firstParagraphMatch[1].toLowerCase();
    if (!firstPara.includes(keywordLower.split(' ')[0])) {
      issues.push({
        severity: 'warning',
        message: 'Primary keyword not found in first paragraph',
        field: 'keywordPlacement',
      });
      score -= 5;
    }
  }

  // Check 9: Keyword in subheadings
  const h2h3Matches = html.match(/<h[23][^>]*>([^<]+)<\/h[23]>/gi) || [];
  const hasKeywordInSubheading = h2h3Matches.some(m => {
    const text = m.replace(/<[^>]+>/g, '').toLowerCase();
    return text.includes(keywordLower.split(' ')[0]);
  });
  if (h2h3Matches.length > 0 && !hasKeywordInSubheading) {
    issues.push({
      severity: 'warning',
      message: 'Primary keyword not found in any subheading (H2/H3)',
      field: 'keywordPlacement',
    });
    score -= 5;
  }

  // Check 10: Trust elements (testimonials, badges)
  const hasTestimonials = textLower.includes('testimonial') || textLower.includes('review') || html.includes('testimonials');
  const hasBadges = textLower.includes('licensed') || textLower.includes('insured') || html.includes('trust-badges');
  if (!hasTestimonials && !hasBadges) {
    issues.push({
      severity: 'warning',
      message: 'No trust elements found (testimonials or trust badges)',
      field: 'trustElements',
    });
    score -= 5;
  }

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    score: Math.max(0, score),
  };
}

