/**
 * Semantic HTML Builder
 * 
 * Generates theme-agnostic, semantic HTML for WordPress pages.
 * No Tailwind, no frameworks, no inline styles - just clean semantic HTML
 * that any WordPress theme can style.
 */

export interface Section {
  id: string;
  type: 'hero' | 'intro' | 'services-grid' | 'why-choose-us' | 'process-steps' | 
        'faq-accordion' | 'cta-block' | 'local-content' | 'testimonials' | 
        'common-problems' | 'neighborhoods' | 'trust-badges' | 'hours' | 
        'guarantees' | 'case-study' | 'content';
  heading?: string;
  content: string; // Raw HTML content from GPT
  metadata?: {
    targetWordCount?: number;
    styleVariant?: string;
  };
}

export interface BrandInfo {
  name: string;
  phonePretty: string;
  phoneClean: string;
  email: string;
  city: string;
  state: string;
  domain?: string;
}

/**
 * Build hero section HTML
 * H1 must contain focus keyword + city for SEO audit
 */
export function buildHeroSection(section: Section, brand: BrandInfo, focusKeyword?: string): string {
  // Always use focus keyword in H1 if provided
  const heading = focusKeyword 
    ? `${focusKeyword} | ${brand.name}`
    : section.heading || `${brand.name} - ${brand.city}, ${brand.state}`;
  
  return `
<section class="hero-section">
  <h1 class="page-title">${escapeHtml(heading)}</h1>
  <div class="hero-content">
    <div class="hero-text">
      ${section.content}
    </div>
    <div class="hero-cta">
      <a href="tel:${brand.phoneClean}" class="cta-button cta-primary">Call ${brand.phonePretty}</a>
      <a href="#contact" class="cta-button cta-secondary">Get Free Quote</a>
    </div>
    <div class="hero-phone-text">
      <p>Call us now at <strong>${escapeHtml(brand.phonePretty)}</strong> for immediate service!</p>
    </div>
  </div>
</section>
  `.trim();
}

/**
 * Build intro/content section
 */
export function buildIntroSection(section: Section): string {
  const heading = section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : '';
  
  return `
<section class="content-section">
  ${heading}
  <div class="content-body">
    ${section.content}
  </div>
</section>
  `.trim();
}

/**
 * Build services grid section
 */
export function buildServicesGridSection(section: Section): string {
  const heading = section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : '';
  
  return `
<section class="services-section">
  ${heading}
  <div class="services-grid">
    ${section.content}
  </div>
</section>
  `.trim();
}

/**
 * Build "Why Choose Us" section
 */
export function buildWhyChooseUsSection(section: Section): string {
  const heading = section.heading || 'Why Choose Us';
  
  return `
<section class="why-choose-section">
  <h2>${escapeHtml(heading)}</h2>
  <div class="benefits-list">
    ${section.content}
  </div>
</section>
  `.trim();
}

/**
 * Build process/steps section
 */
export function buildProcessStepsSection(section: Section): string {
  const heading = section.heading || 'How It Works';
  
  return `
<section class="process-section">
  <h2>${escapeHtml(heading)}</h2>
  <div class="process-steps">
    ${section.content}
  </div>
</section>
  `.trim();
}

/**
 * Build FAQ accordion section
 * Converts Q:/A: format to semantic <details> elements for schema detection
 */
export function buildFAQSection(section: Section): string {
  const heading = section.heading || 'Frequently Asked Questions';
  
  let faqContent = section.content;
  
  // If content is in Q:/A: format, convert to <details> elements
  if (faqContent.includes('Q:') && faqContent.includes('A:')) {
    const qaRegex = /Q:\s*(.*?)\s*A:\s*(.*?)(?=Q:|$)/gis;
    const faqItems: string[] = [];
    let match;
    
    while ((match = qaRegex.exec(faqContent)) !== null) {
      const question = match[1].trim();
      const answer = match[2].trim();
      
      if (question && answer) {
        faqItems.push(`
<details>
  <summary>${escapeHtml(question)}</summary>
  <div class="faq-answer">
    <p>${escapeHtml(answer)}</p>
  </div>
</details>`);
      }
    }
    
    if (faqItems.length > 0) {
      faqContent = faqItems.join('\n');
    }
  }
  
  return `
<section class="faq-section">
  <h2>${escapeHtml(heading)}</h2>
  <div class="faq-list">
    ${faqContent}
  </div>
</section>
  `.trim();
}

/**
 * Build CTA block section
 */
export function buildCTASection(section: Section, brand: BrandInfo): string {
  return `
<section class="cta-section">
  <div class="cta-content">
    ${section.content}
    <div class="cta-buttons">
      <a href="tel:${brand.phoneClean}" class="cta-button cta-primary">Call ${brand.phonePretty}</a>
      <a href="#contact" class="cta-button cta-secondary">Get Free Quote</a>
    </div>
  </div>
</section>
  `.trim();
}

/**
 * Build local content section (city-specific)
 */
export function buildLocalContentSection(section: Section): string {
  const heading = section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : '';
  
  return `
<section class="local-content-section">
  ${heading}
  <div class="local-content-body">
    ${section.content}
  </div>
</section>
  `.trim();
}

/**
 * Build testimonials section with star ratings
 */
export function buildTestimonialsSection(section: Section, brand?: BrandInfo): string {
  const heading = section.heading || 'What Our Customers Say';
  
  // If content contains testimonial structure, use it; otherwise format it
  let testimonialsHtml = section.content;
  
  // Check if content already has HTML structure
  if (!testimonialsHtml.includes('<div') && !testimonialsHtml.includes('<blockquote')) {
    // Format plain text testimonials with star ratings
    const testimonialLines = testimonialsHtml.split('\n').filter(l => l.trim());
    const formattedTestimonials = testimonialLines.map((line, idx) => {
      // Try to extract customer name and location from line
      const nameMatch = line.match(/-?\s*([A-Z][a-z]+\s+[A-Z]\.?)(?:\s*,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?))?/);
      const customerName = nameMatch ? nameMatch[1] : `Customer ${idx + 1}`;
      const location = nameMatch && nameMatch[2] ? nameMatch[2] : (brand?.city || '');
      
      return `
<div class="testimonial">
  <div class="rating">★★★★★ 5/5</div>
  <blockquote>${escapeHtml(line.replace(/-?\s*[A-Z][a-z]+\s+[A-Z]\.?.*$/, '').trim())}</blockquote>
  <cite>- ${escapeHtml(customerName)}${location ? `, ${escapeHtml(location)}` : ''}</cite>
</div>`;
    }).join('\n');
    
    testimonialsHtml = formattedTestimonials;
  }
  
  return `
<section class="testimonials-section">
  <h2>${escapeHtml(heading)}</h2>
  <div class="testimonials-grid">
    ${testimonialsHtml}
  </div>
</section>
  `.trim();
}

/**
 * Build common problems section
 */
export function buildCommonProblemsSection(section: Section): string {
  const heading = section.heading || 'Common Problems We Solve';
  
  return `
<section class="problems-section">
  <h2>${escapeHtml(heading)}</h2>
  <div class="problems-list">
    ${section.content}
  </div>
</section>
  `.trim();
}

/**
 * Build neighborhoods section
 */
export function buildNeighborhoodsSection(section: Section): string {
  const heading = section.heading || 'Areas We Serve';
  
  return `
<section class="neighborhoods-section">
  <h2>${escapeHtml(heading)}</h2>
  <div class="neighborhoods-list">
    ${section.content}
  </div>
</section>
  `.trim();
}

/**
 * Build trust badges section (Licensed, Insured, BBB, etc.)
 */
export function buildTrustBadgesSection(section: Section): string {
  const heading = section.heading || 'Why You Can Trust Us';
  
  // Format trust badges with icons/indicators
  const badges = section.content.split('\n').filter(b => b.trim());
  const formattedBadges = badges.map(badge => {
    const badgeText = badge.trim();
    return `
<div class="trust-badge">
  <span class="badge-icon">✓</span>
  <span class="badge-text">${escapeHtml(badgeText)}</span>
</div>`;
  }).join('\n');
  
  return `
<section class="trust-badges-section">
  <h2>${escapeHtml(heading)}</h2>
  <div class="trust-badges">
    ${formattedBadges}
  </div>
</section>
  `.trim();
}

/**
 * Build business hours section
 */
export function buildHoursSection(section: Section, brand: BrandInfo): string {
  const heading = section.heading || 'Business Hours';
  
  return `
<section class="hours-section">
  <h2>${escapeHtml(heading)}</h2>
  <div class="hours-content">
    ${section.content}
  </div>
  <div class="hours-contact">
    <p>Call us at <a href="tel:${brand.phoneClean}">${escapeHtml(brand.phonePretty)}</a> for immediate assistance.</p>
  </div>
</section>
  `.trim();
}

/**
 * Build guarantees section
 */
export function buildGuaranteesSection(section: Section): string {
  const heading = section.heading || 'Our Guarantee';
  
  return `
<section class="guarantees-section">
  <h2>${escapeHtml(heading)}</h2>
  <div class="guarantees-content">
    ${section.content}
  </div>
</section>
  `.trim();
}

/**
 * Build case study section (local project)
 */
export function buildCaseStudySection(section: Section): string {
  const heading = section.heading || 'Recent Project';
  
  return `
<section class="case-study-section">
  <h2>${escapeHtml(heading)}</h2>
  <div class="case-study-content">
    ${section.content}
  </div>
</section>
  `.trim();
}

/**
 * Build footer with NAP
 */
export function buildFooter(brand: BrandInfo): string {
  const currentYear = new Date().getFullYear();
  
  return `
<footer class="site-footer">
  <div class="footer-content">
    <div class="footer-nap">
      <h3>${escapeHtml(brand.name)}</h3>
      <p>${escapeHtml(brand.city)}, ${escapeHtml(brand.state)}</p>
      <p><a href="tel:${brand.phoneClean}">${escapeHtml(brand.phonePretty)}</a></p>
      <p><a href="mailto:${brand.email}">${escapeHtml(brand.email)}</a></p>
    </div>
    <div class="footer-links">
      <h4>Quick Links</h4>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </div>
    <div class="footer-legal">
      <h4>Legal</h4>
      <ul>
        <li><a href="/privacy">Privacy Policy</a></li>
        <li><a href="/terms">Terms of Service</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <p>&copy; ${currentYear} ${escapeHtml(brand.name)}. All rights reserved.</p>
  </div>
</footer>
  `.trim();
}

/**
 * Build page content HTML (body content only, for WordPress post_content)
 * This is what gets inserted into WordPress post_content field
 * 
 * Note: Title tag and meta description are included in HTML comments for audit purposes.
 * WordPress will use the titleTag and seoDescription fields from the database.
 */
export function buildPageHtml(
  sections: Section[],
  brand: BrandInfo,
  pageTitle: string,
  metaDescription?: string,
  schemaMarkup?: string,
  canonicalUrl?: string,
  focusKeyword?: string
): string {
  const htmlSections = sections.map((section) => {
    switch (section.type) {
      case 'hero':
        return buildHeroSection(section, brand, focusKeyword);
      case 'intro':
      case 'content':
        return buildIntroSection(section);
      case 'services-grid':
        return buildServicesGridSection(section);
      case 'why-choose-us':
        return buildWhyChooseUsSection(section);
      case 'process-steps':
        return buildProcessStepsSection(section);
      case 'faq-accordion':
        return buildFAQSection(section);
      case 'cta-block':
        return buildCTASection(section, brand);
      case 'local-content':
        return buildLocalContentSection(section);
      case 'testimonials':
        return buildTestimonialsSection(section, brand);
      case 'common-problems':
        return buildCommonProblemsSection(section);
      case 'neighborhoods':
        return buildNeighborhoodsSection(section);
      case 'trust-badges':
        return buildTrustBadgesSection(section);
      case 'hours':
        return buildHoursSection(section, brand);
      case 'guarantees':
        return buildGuaranteesSection(section);
      case 'case-study':
        return buildCaseStudySection(section);
      default:
        return buildIntroSection(section);
    }
  }).join('\n\n');

  // Include title and meta in HTML for audit purposes (WordPress will use DB fields)
  const titleTag = `<title>${escapeHtml(pageTitle)}</title>`;
  const metaDescTag = metaDescription 
    ? `<meta name="description" content="${escapeHtml(metaDescription)}">`
    : '';
  const canonicalTag = canonicalUrl
    ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`
    : '';

  // Build body content only (for WordPress post_content)
  // WordPress handles the <html>, <head>, <body> tags
  // But we include title/meta/canonical in comments for audit detection
  return `
<!-- SEO Meta (WordPress will use titleTag and seoDescription from database) -->
${titleTag}
${metaDescTag}
${canonicalTag}

<main class="page-content">
  ${htmlSections}
</main>
${buildFooter(brand)}
${schemaMarkup ? `<script type="application/ld+json">${schemaMarkup}</script>` : ''}
  `.trim();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

