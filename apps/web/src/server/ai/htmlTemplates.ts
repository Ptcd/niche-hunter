/**
 * HTML Template Builder
 * 
 * Converts AI-generated sections into proper HTML with Tailwind CSS.
 */

export interface Section {
  id: string;
  type: 'hero' | 'services' | 'faq' | 'trust' | 'contact' | 'footer' | 'content';
  heading?: string;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Build hero section HTML
 */
export function buildHeroSection(section: Section, brand: {
  name: string;
  phonePretty: string;
  city: string;
  state: string;
}): string {
  return `
    <section class="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16 px-4">
      <div class="max-w-6xl mx-auto text-center">
        <h1 class="text-4xl md:text-5xl font-bold mb-4">${section.heading || brand.name}</h1>
        <p class="text-xl mb-8 text-blue-100">${section.content}</p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="#contact" class="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition">
            Get Free Quote
          </a>
          <a href="tel:${brand.phonePretty.replace(/\D/g, '')}" class="bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-600 transition">
            Call ${brand.phonePretty}
          </a>
        </div>
      </div>
    </section>
  `;
}

/**
 * Build services grid section
 */
export function buildServicesSection(section: Section): string {
  // Parse services from content (assuming markdown or structured text)
  const services = section.content.split('\n').filter(line => line.trim());
  
  return `
    <section class="py-12 px-4 bg-gray-50">
      <div class="max-w-6xl mx-auto">
        ${section.heading ? `<h2 class="text-3xl font-bold text-center mb-8">${section.heading}</h2>` : ''}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${services.map((service, idx) => `
            <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
              <div class="text-blue-600 text-4xl mb-4">${getServiceIcon(idx)}</div>
              <h3 class="text-xl font-semibold mb-2">${service}</h3>
              <p class="text-gray-600">Professional ${service.toLowerCase()} services in your area.</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

/**
 * Build FAQ accordion section
 */
export function buildFAQSection(section: Section): string {
  // Parse FAQ items (assuming Q: ... A: ... format)
  const faqItems = parseFAQItems(section.content);
  
  return `
    <section class="py-12 px-4">
      <div class="max-w-4xl mx-auto">
        ${section.heading ? `<h2 class="text-3xl font-bold text-center mb-8">${section.heading}</h2>` : ''}
        <div class="space-y-4">
          ${faqItems.map((item, idx) => `
            <details class="bg-white p-6 rounded-lg shadow-md">
              <summary class="font-semibold text-lg cursor-pointer">${item.question}</summary>
              <p class="mt-4 text-gray-700">${item.answer}</p>
            </details>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

/**
 * Build trust badges section
 */
export function buildTrustSection(): string {
  return `
    <section class="py-12 px-4 bg-gray-100">
      <div class="max-w-6xl mx-auto">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div class="text-3xl font-bold text-blue-600">100%</div>
            <div class="text-gray-600">Satisfaction</div>
          </div>
          <div>
            <div class="text-3xl font-bold text-blue-600">24/7</div>
            <div class="text-gray-600">Available</div>
          </div>
          <div>
            <div class="text-3xl font-bold text-blue-600">Licensed</div>
            <div class="text-gray-600">& Insured</div>
          </div>
          <div>
            <div class="text-3xl font-bold text-blue-600">Local</div>
            <div class="text-gray-600">Experts</div>
          </div>
        </div>
      </div>
    </section>
  `;
}

/**
 * Build contact form section
 */
export function buildContactSection(brand: {
  phonePretty: string;
  email: string;
}): string {
  return `
    <section id="contact" class="py-12 px-4 bg-blue-600 text-white">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-3xl font-bold text-center mb-8">Get Your Free Quote Today</h2>
        <div class="grid md:grid-cols-2 gap-8">
          <div>
            <h3 class="text-xl font-semibold mb-4">Contact Us</h3>
            <p class="mb-4">Call us at <a href="tel:${brand.phonePretty.replace(/\D/g, '')}" class="underline">${brand.phonePretty}</a></p>
            <p>Email: <a href="mailto:${brand.email}" class="underline">${brand.email}</a></p>
          </div>
          <form class="space-y-4">
            <input type="text" placeholder="Your Name" class="w-full p-3 rounded text-gray-900" required>
            <input type="email" placeholder="Your Email" class="w-full p-3 rounded text-gray-900" required>
            <input type="tel" placeholder="Your Phone" class="w-full p-3 rounded text-gray-900" required>
            <textarea placeholder="Tell us about your project" class="w-full p-3 rounded text-gray-900" rows="4" required></textarea>
            <button type="submit" class="w-full bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition">
              Send Message
            </button>
          </form>
        </div>
      </div>
    </section>
  `;
}

/**
 * Build footer with NAP
 */
export function buildFooter(brand: {
  name: string;
  phonePretty: string;
  email: string;
  city: string;
  state: string;
}): string {
  return `
    <footer class="bg-gray-900 text-white py-8 px-4">
      <div class="max-w-6xl mx-auto">
        <div class="grid md:grid-cols-3 gap-8">
          <div>
            <h3 class="text-xl font-semibold mb-4">${brand.name}</h3>
            <p>${brand.city}, ${brand.state}</p>
            <p><a href="tel:${brand.phonePretty.replace(/\D/g, '')}" class="hover:underline">${brand.phonePretty}</a></p>
            <p><a href="mailto:${brand.email}" class="hover:underline">${brand.email}</a></p>
          </div>
          <div>
            <h4 class="font-semibold mb-4">Quick Links</h4>
            <ul class="space-y-2">
              <li><a href="/" class="hover:underline">Home</a></li>
              <li><a href="/about" class="hover:underline">About</a></li>
              <li><a href="/contact" class="hover:underline">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-semibold mb-4">Legal</h4>
            <ul class="space-y-2">
              <li><a href="/privacy" class="hover:underline">Privacy Policy</a></li>
              <li><a href="/terms" class="hover:underline">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div class="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
          <p>&copy; ${new Date().getFullYear()} ${brand.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  `;
}

/**
 * Build full page HTML from sections
 */
export function buildPageHtml(
  sections: Section[],
  brand: {
    name: string;
    phonePretty: string;
    email: string;
    city: string;
    state: string;
  },
  pageTitle: string,
  metaDescription?: string
): string {
  const htmlSections = sections.map((section) => {
    switch (section.type) {
      case 'hero':
        return buildHeroSection(section, brand);
      case 'services':
        return buildServicesSection(section);
      case 'faq':
        return buildFAQSection(section);
      case 'trust':
        return buildTrustSection();
      case 'contact':
        return buildContactSection(brand);
      case 'footer':
        return buildFooter(brand);
      default:
        return `
          <section class="py-12 px-4">
            <div class="max-w-4xl mx-auto">
              ${section.heading ? `<h2 class="text-3xl font-bold mb-6">${section.heading}</h2>` : ''}
              <div class="prose max-w-none">${section.content}</div>
            </div>
          </section>
        `;
    }
  }).join('\n');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  ${metaDescription ? `<meta name="description" content="${metaDescription}">` : ''}
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white">
  ${htmlSections}
</body>
</html>
  `.trim();
}

// Helper functions

function getServiceIcon(index: number): string {
  const icons = ['🔧', '⚡', '🏠', '🛠️', '💡', '🔨'];
  return icons[index % icons.length];
}

function parseFAQItems(content: string): Array<{ question: string; answer: string }> {
  const items: Array<{ question: string; answer: string }> = [];
  const lines = content.split('\n');
  
  let currentQ = '';
  let currentA = '';
  
  for (const line of lines) {
    if (line.trim().startsWith('Q:') || line.trim().startsWith('Question:')) {
      if (currentQ && currentA) {
        items.push({ question: currentQ, answer: currentA });
      }
      currentQ = line.replace(/^Q:\s*|^Question:\s*/i, '').trim();
      currentA = '';
    } else if (line.trim().startsWith('A:') || line.trim().startsWith('Answer:')) {
      currentA = line.replace(/^A:\s*|^Answer:\s*/i, '').trim();
    } else if (currentQ && line.trim()) {
      currentA += (currentA ? ' ' : '') + line.trim();
    }
  }
  
  if (currentQ && currentA) {
    items.push({ question: currentQ, answer: currentA });
  }
  
  // Fallback: if no structured format, split by paragraphs
  if (items.length === 0) {
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    for (let i = 0; i < paragraphs.length; i += 2) {
      if (paragraphs[i] && paragraphs[i + 1]) {
        items.push({
          question: paragraphs[i].trim(),
          answer: paragraphs[i + 1].trim(),
        });
      }
    }
  }
  
  return items;
}

