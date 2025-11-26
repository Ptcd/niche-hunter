/**
 * Internal Link Generator
 * 
 * Generates recommended internal links for each page based on page type
 * and cluster relationships. Implements rule-based linking strategy.
 */

import { PagePlanRow } from './page-plan-builder';

/**
 * Generate internal link targets for a page based on its type and cluster
 * 
 * @param page - The page to generate links for
 * @param allPages - All pages in the site plan
 * @returns Array of URL slugs to link to
 */
export function getInternalLinksForPage(
  page: PagePlanRow,
  allPages: PagePlanRow[]
): string[] {
  const links: string[] = [];

  const homePage = allPages.find((p) => p.pageType === 'Home');
  const contactPage = allPages.find((p) => p.pageType === 'Contact');
  const aboutPage = allPages.find((p) => p.pageType === 'About');

  // Home page: link to top services + city pages
  if (page.pageType === 'Home') {
    const topServices = allPages
      .filter((p) => p.pageType === 'Service')
      .slice(0, 5);
    const cityPages = allPages.filter((p) => p.pageType === 'City').slice(0, 3);
    return [...topServices, ...cityPages]
      .map((p) => p.urlSlug)
      .filter(Boolean);
  }

  // About/Contact: link to home + top services
  if (page.pageType === 'About' || page.pageType === 'Contact') {
    if (homePage) links.push(homePage.urlSlug);
    const topServices = allPages
      .filter((p) => p.pageType === 'Service')
      .slice(0, 3);
    return [...links, ...topServices.map((p) => p.urlSlug)].filter(Boolean);
  }

  // Service pages: home, contact, + same cluster
  if (page.pageType === 'Service') {
    if (homePage) links.push(homePage.urlSlug);
    if (contactPage) links.push(contactPage.urlSlug);

    const clusterMates = allPages.filter(
      (p) =>
        p.clusterKey === page.clusterKey &&
        p.urlSlug !== page.urlSlug &&
        p.pageType === 'Service'
    ).slice(0, 4);

    return [...links, ...clusterMates.map((p) => p.urlSlug)].filter(Boolean);
  }

  // City pages: home, contact, + top services
  if (page.pageType === 'City') {
    if (homePage) links.push(homePage.urlSlug);
    if (contactPage) links.push(contactPage.urlSlug);
    const topServices = allPages
      .filter((p) => p.pageType === 'Service')
      .slice(0, 5);
    return [...links, ...topServices.map((p) => p.urlSlug)].filter(Boolean);
  }

  // Blog pages: home, contact, + related cluster service
  if (page.pageType === 'Blog') {
    if (homePage) links.push(homePage.urlSlug);
    if (contactPage) links.push(contactPage.urlSlug);

    const relatedService = allPages.find(
      (p) => p.pageType === 'Service' && p.clusterKey === page.clusterKey
    );
    if (relatedService) links.push(relatedService.urlSlug);

    return links.filter(Boolean);
  }

  return [];
}


