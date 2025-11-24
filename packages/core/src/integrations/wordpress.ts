/**
 * WordPress Integration
 * 
 * Functions for creating and updating WordPress pages via REST API.
 */

interface WordPressConfig {
  baseUrl: string;
  username: string;
  password: string; // Application password
}

/**
 * Create a WordPress page
 */
export async function createWPPage(
  config: WordPressConfig,
  slug: string,
  title: string,
  content: string,
  status: 'draft' | 'publish' = 'draft'
): Promise<string> {
  const url = `${config.baseUrl}/wp-json/wp/v2/pages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
    },
    body: JSON.stringify({
      title,
      slug,
      content,
      status,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WordPress API error: ${response.status} - ${error}`);
  }

  const page: any = await response.json();
  return String(page.id);
}

/**
 * Update a WordPress page
 */
export async function updateWPPage(
  config: WordPressConfig,
  pageId: string,
  content: string,
  title?: string,
  slug?: string
): Promise<void> {
  const url = `${config.baseUrl}/wp-json/wp/v2/pages/${pageId}`;
  
  const body: any = { content };
  if (title) body.title = title;
  if (slug) body.slug = slug;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WordPress API error: ${response.status} - ${error}`);
  }
}

/**
 * Get all pages from WordPress
 */
export async function getWPPages(config: WordPressConfig): Promise<any[]> {
  const url = `${config.baseUrl}/wp-json/wp/v2/pages?per_page=100`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WordPress API error: ${response.status} - ${error}`);
  }

  const pages: any[] = await response.json();
  return pages;
}

/**
 * Add JSON-LD schema to content
 */
export function addJSONLD(
  content: string,
  schema: {
    type: string;
    name: string;
    description?: string;
    address?: {
      streetAddress?: string;
      addressLocality: string;
      addressRegion: string;
      postalCode?: string;
    };
    telephone?: string;
    url?: string;
    [key: string]: any;
  }
): string {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': schema.type,
    ...schema,
  };

  const scriptTag = `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>`;
  return `${content}\n\n${scriptTag}`;
}

/**
 * Generate LocalBusiness schema for a site
 */
export function generateLocalBusinessSchema(site: {
  domain?: string | null;
  phoneNumber?: string | null;
  city: string;
  state: string;
  niche: { name: string };
}): any {
  return {
    type: 'LocalBusiness',
    name: site.niche.name,
    address: {
      addressLocality: site.city,
      addressRegion: site.state,
      addressCountry: 'US',
    },
    telephone: site.phoneNumber || undefined,
    url: site.domain ? `https://${site.domain}` : undefined,
  };
}

