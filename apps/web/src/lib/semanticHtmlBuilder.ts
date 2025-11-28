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
        'common-problems' | 'neighborhoods' | 'content';
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
 */
export function buildHeroSection(section: Section, brand: BrandInfo): string {
  const heading = section.heading || `${brand.name} - ${brand.city}, ${brand.state}`;
  
  return `
<section class="hero-section">
  <div class="hero-content">
    <h1>${escapeHtml(heading)}</h1>
    <div class="hero-text">
      ${section.content}
    </div>
    <div class="hero-cta">
      <a href="tel:${brand.phoneClean}" class="cta-button cta-primary">Call ${brand.phonePretty}</a>
      <a href="#contact" class="cta-button cta-secondary">Get Free Quote</a>
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
 */
export function buildFAQSection(section: Section): string {
  const heading = section.heading || 'Frequently Asked Questions';
  
  return `
<section class="faq-section">
  <h2>${escapeHtml(heading)}</h2>
  <div class="faq-list">
    ${section.content}
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
 * Build testimonials section
 */
export function buildTestimonialsSection(section: Section): string {
  const heading = section.heading || 'What Our Customers Say';
  
  return `
<section class="testimonials-section">
  <h2>${escapeHtml(heading)}</h2>
  <div class="testimonials-grid">
    ${section.content}
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
 */
export function buildPageHtml(
  sections: Section[],
  brand: BrandInfo,
  pageTitle: string,
  metaDescription?: string,
  schemaMarkup?: string
): string {
  const htmlSections = sections.map((section) => {
    switch (section.type) {
      case 'hero':
        return buildHeroSection(section, brand);
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
        return buildTestimonialsSection(section);
      case 'common-problems':
        return buildCommonProblemsSection(section);
      case 'neighborhoods':
        return buildNeighborhoodsSection(section);
      default:
        return buildIntroSection(section);
    }
  }).join('\n\n');

  // Build body content only (for WordPress post_content)
  // WordPress handles the <html>, <head>, <body> tags
  return `
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

