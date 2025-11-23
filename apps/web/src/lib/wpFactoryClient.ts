/**
 * WordPress Factory Client
 * 
 * Client for communicating with the WordPress factory plugin REST API.
 * Includes retry logic and better error handling.
 */

import type { BrandSpec, PageSpec } from "./wpFactoryTypes";

const WP_APP_URL = process.env.WP_APP_URL;
const WP_APP_USER = process.env.WP_APP_USER;
const WP_APP_PASS = process.env.WP_APP_PASS;

if (!WP_APP_URL || !WP_APP_USER || !WP_APP_PASS) {
  console.warn("[wpFactoryClient] Missing WP_* env vars; WordPress deploy will fail.");
}

function getAuthHeader(username?: string, password?: string) {
  const user = username || WP_APP_USER;
  const pass = password || WP_APP_PASS;
  if (!user || !pass) return {};
  const token = Buffer.from(`${user}:${pass}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

/**
 * Sleep helper for retry logic
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Custom error class for WordPress publishing errors
 */
export class WPPublishError extends Error {
  constructor(
    message: string,
    public pageId?: string,
    public wpResponse?: any,
    public statusCode?: number
  ) {
    super(message);
    this.name = "WPPublishError";
  }
}

/**
 * Call with retry logic and exponential backoff
 */
async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on 4xx errors (client errors)
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }

      if (i < retries - 1) {
        const waitTime = delay * Math.pow(2, i); // Exponential backoff
        console.warn(`[wpFactoryClient] Retry ${i + 1}/${retries} after ${waitTime}ms...`);
        await sleep(waitTime);
      }
    }
  }

  throw lastError || new Error("Unknown error in retry logic");
}

/**
 * Call the WordPress plugin to set site-wide options:
 * site title, logo, phone, email, etc.
 */
export async function bootstrapSite(
  brand: BrandSpec,
  wpUrl?: string,
  wpUser?: string,
  wpPass?: string
) {
  const baseUrl = wpUrl || WP_APP_URL;
  if (!baseUrl) throw new Error("WordPress URL not configured");

  return callWithRetry(async () => {
    const res = await fetch(`${baseUrl}/wp-json/nichehunter/v1/bootstrap-site`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(wpUser, wpPass),
      },
      body: JSON.stringify({ brand }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new WPPublishError(
        `bootstrapSite failed: ${res.status} ${text}`,
        undefined,
        text,
        res.status
      );
    }

    return res.json();
  });
}

/**
 * Push a full set of pages to WP using batch-upsert endpoint.
 * WP plugin is responsible for:
 * - creating/updating pages
 * - mapping slug, title, content
 * - applying RankMath meta
 * - replacing tokens such as {{URL_CONTACT}}.
 */
export async function syncPages(
  pages: PageSpec[],
  wpUrl?: string,
  wpUser?: string,
  wpPass?: string
) {
  const baseUrl = wpUrl || WP_APP_URL;
  if (!baseUrl) throw new Error("WordPress URL not configured");

  return callWithRetry(async () => {
    const res = await fetch(`${baseUrl}/wp-json/nichehunter/v1/batch-upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(wpUser, wpPass),
      },
      body: JSON.stringify({
        auth: {
          username: wpUser || WP_APP_USER,
          applicationPassword: wpPass || WP_APP_PASS,
        },
        pages: pages.map((page) => ({
          externalId: page.slug, // Use slug as external ID for now
          slug: page.slug,
          title: page.title,
          contentHtml: page.content,
          status: "draft", // Will be set to publish by caller if needed
          type: "page",
          meta: {
            seo_title: page.seoTitle,
            seo_description: page.seoDescription,
            canonical_url: page.slug ? `${baseUrl}/${page.slug}` : baseUrl,
            rank_math_focus_keyword: page.focusKeyword,
          },
        })),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new WPPublishError(
        `syncPages failed: ${res.status} ${text}`,
        undefined,
        text,
        res.status
      );
    }

    return res.json();
  });
}

/**
 * Publish pages with proper status handling
 */
export async function publishPages(
  pages: Array<PageSpec & { externalId: string; status: "draft" | "publish" }>,
  wpUrl: string,
  wpUser: string,
  wpPass: string
) {
  return callWithRetry(async () => {
    const res = await fetch(`${wpUrl}/wp-json/nichehunter/v1/batch-upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(wpUser, wpPass),
      },
      body: JSON.stringify({
        auth: {
          username: wpUser,
          applicationPassword: wpPass,
        },
        pages: pages.map((page) => ({
          externalId: page.externalId,
          slug: page.slug,
          title: page.title,
          contentHtml: page.content,
          status: page.status,
          type: "page",
          meta: {
            seo_title: page.seoTitle,
            seo_description: page.seoDescription,
            canonical_url: page.slug ? `${wpUrl}/${page.slug}` : wpUrl,
            rank_math_focus_keyword: page.focusKeyword,
          },
        })),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new WPPublishError(
        `publishPages failed: ${res.status} ${text}`,
        undefined,
        text,
        res.status
      );
    }

    return res.json();
  });
}

