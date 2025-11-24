/**
 * WordPress Publishing Pipeline
 * 
 * Robust publishing system with error handling and retry logic.
 */

import { prisma } from '@niche-hunter/db';
import { PageStatus, SiteStatus } from '@prisma/client';
import { publishPages, WPPublishError } from '../../../lib/wpFactoryClient';
import { buildBrandSpec } from '../../../lib/brandBuilder';
import { mapPageToSpec } from '../../../lib/pageMapper';

export interface PublishResult {
  pageId: string;
  success: boolean;
  wpPageId?: number;
  wpEditUrl?: string;
  wpPermalink?: string;
  error?: string;
}

export interface PublishOptions {
  mode: 'approved-only' | 'all-drafts' | 'single';
  pageId?: string;
  publishStatus?: 'draft' | 'publish';
}

/**
 * Publish pages to WordPress
 */
export async function publishSitePages(
  siteId: string,
  options: PublishOptions
): Promise<PublishResult[]> {
  // Load site with WP credentials
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      niche: true,
      pages: true,
    },
  });

  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }

  if (!site.wpApiBase || !site.wpUser || !site.wpAppPassword) {
    throw new Error('Site missing WordPress configuration (wpApiBase, wpUser, wpAppPassword)');
  }

  // Determine which pages to publish
  let pagesToPublish = site.pages;

  if (options.mode === 'approved-only') {
    pagesToPublish = pagesToPublish.filter((p) => p.status === PageStatus.APPROVED);
  } else if (options.mode === 'all-drafts') {
    pagesToPublish = pagesToPublish.filter((p) =>
      p.status === PageStatus.DRAFT || p.status === PageStatus.APPROVED
    );
  } else if (options.mode === 'single' && options.pageId) {
    const page = pagesToPublish.find((p) => p.id === options.pageId);
    if (!page) {
      throw new Error(`Page ${options.pageId} not found`);
    }
    pagesToPublish = [page];
  }

  if (pagesToPublish.length === 0) {
    return [];
  }

  // Build BrandSpec
  const brand = buildBrandSpec({
    siteName: site.siteName,
    city: site.city,
    state: site.state,
    email: site.email,
    domain: site.domain,
    trackingNumber: site.trackingNumber,
    twilioNumber: site.twilioNumber,
    forwardToNumber: site.forwardToNumber,
    logoUrl: site.logoUrl,
  });

  // Map pages to PageSpec
  const pageSpecs = pagesToPublish.map((page) => {
    const spec = mapPageToSpec({
      pageType: page.pageType,
      slug: page.slug,
      seoTitle: page.seoTitle,
      titleTag: page.titleTag,
      seoDescription: page.seoDescription,
      htmlEdited: page.htmlEdited,
      htmlDraft: page.htmlDraft,
      focusKeyword: page.focusKeyword,
    });

    return {
      ...spec,
      externalId: page.id, // Use page ID as external ID
      status: (options.publishStatus === 'publish' || page.status === PageStatus.APPROVED)
        ? 'publish'
        : 'draft',
    };
  });

  // Publish to WordPress
  let wpResult: any;
  try {
    wpResult = await publishPages(
      pageSpecs,
      site.wpApiBase,
      site.wpUser,
      site.wpAppPassword
    );
  } catch (error: any) {
    // If publishing fails, return error for all pages
    return pagesToPublish.map((page) => ({
      pageId: page.id,
      success: false,
      error: error.message || 'Failed to publish to WordPress',
    }));
  }

  // Process results
  const results: PublishResult[] = [];
  const wpResults = wpResult?.results || [];

  for (const page of pagesToPublish) {
    const wpPageResult = wpResults.find(
      (r: any) => r.externalId === page.id || r.slug === page.slug
    );

    if (wpPageResult && wpPageResult.wpPageId) {
      // Success
      const wpPageId = parseInt(wpPageResult.wpPageId) || wpPageResult.wpPageId;
      const wpPermalink = wpPageResult.permalink || wpPageResult.editUrl?.replace('/wp-admin/post.php?post=', '').split('&')[0] || '';
      const wpEditUrl = wpPageResult.editUrl || `${site.wpApiBase?.replace('/wp-json/nichehunter/v1', '')}/wp-admin/post.php?post=${wpPageId}&action=edit`;

      // Update page record
      await prisma.sitePage.update({
        where: { id: page.id },
        data: {
          wpPageId: typeof wpPageId === 'number' ? wpPageId : parseInt(wpPageId.toString()),
          wpPermalink: wpPermalink || `${site.domain || site.wpApiBase}/${page.slug}`,
          wpEditUrl,
          latestPublishedAt: new Date(),
          status: wpPageResult.status === 'publish' ? PageStatus.PUBLISHED : page.status,
        },
      });

      results.push({
        pageId: page.id,
        success: true,
        wpPageId: typeof wpPageId === 'number' ? wpPageId : parseInt(wpPageId.toString()),
        wpEditUrl,
        wpPermalink,
      });
    } else {
      // Failed
      results.push({
        pageId: page.id,
        success: false,
        error: wpPageResult?.error || 'No response from WordPress',
      });
    }
  }

  // Update site status if all pages published successfully
  const allSuccess = results.every((r) => r.success);
  if (allSuccess && results.length > 0) {
    await prisma.site.update({
      where: { id: siteId },
      data: {
        status: SiteStatus.LIVE,
      },
    });
  }

  return results;
}

