/**
 * PUT /api/v5000/sites/[siteId]/setup
 * 
 * Complete site setup: save domain/phone/WP URL, generate page plan,
 * create skeletons, create Google Sheet, optionally create WP pages.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { SiteStatus } from '@prisma/client';
import { generateSitePages, generateContentSkeletons } from '../../../../../lib/site-setup';
import { 
  createSiteSheet, 
  writeKeywordsTab, 
  writePagePlanTab, 
  writeContentDraftsTab 
} from '@niche-hunter/core';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { siteId } = req.query;

  if (typeof siteId !== 'string') {
    return res.status(400).json({ error: 'Invalid site ID' });
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { domain, phoneNumber, wpBaseUrl } = req.body;

    // Validate inputs
    if (!domain || !phoneNumber || !wpBaseUrl) {
      return res.status(400).json({
        error: 'Missing required fields: domain, phoneNumber, wpBaseUrl',
      });
    }

    // Get site
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: {
        batch: true,
        niche: true,
      },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    if (site.status !== SiteStatus.SETUP) {
      return res.status(400).json({
        error: `Site is not in SETUP status (current: ${site.status})`,
      });
    }

    // Update site with domain, phone, WP URL
    await prisma.site.update({
      where: { id: siteId },
      data: {
        domain,
        phoneNumber,
        wpBaseUrl,
        status: SiteStatus.GENERATING,
      },
    });

    // Generate page plan and create SitePage records
    if (!site.batchId) {
      return res.status(400).json({ error: 'Site has no associated batch' });
    }

    console.log(`[SETUP] Generating page plan for site ${siteId}...`);
    const pageIds = await generateSitePages(siteId, site.batchId, site.city, site.state);
    console.log(`[SETUP] Created ${pageIds.length} pages`);

    // Generate content skeletons
    console.log(`[SETUP] Generating content skeletons...`);
    await generateContentSkeletons(siteId);
    console.log(`[SETUP] Content skeletons generated`);

    // Create Google Sheet with 3 tabs
    console.log(`[SETUP] Creating Google Sheet...`);
    const siteName = `${site.niche.name} - ${site.city}, ${site.state}`;
    const sheetId = await createSiteSheet(siteId, siteName);
    
    // Write data to sheets
    await writeKeywordsTab(siteId, sheetId);
    await writePagePlanTab(siteId, sheetId);
    await writeContentDraftsTab(siteId, sheetId);
    
    // Save sheet ID to site
    await prisma.site.update({
      where: { id: siteId },
      data: { sheetId },
    });
    console.log(`[SETUP] Google Sheet created: ${sheetId}`);

    // TODO: Optionally create placeholder WP pages
    // For now, we'll skip this

    // Update status to DRAFTING
    await prisma.site.update({
      where: { id: siteId },
      data: {
        status: SiteStatus.GENERATING,
      },
    });

    return res.status(200).json({
      message: 'Site setup completed successfully',
      siteId,
      pagesCreated: pageIds.length,
    });
  } catch (error: any) {
    console.error('Error setting up site:', error);
    
    // Update site status to error
    try {
      await prisma.site.update({
        where: { id: siteId as string },
        data: {
          status: SiteStatus.ERROR,
          errorMessage: error.message || 'Unknown error during setup',
        },
      });
    } catch (updateError) {
      console.error('Error updating site status:', updateError);
    }

    return res.status(500).json({
      error: error.message || 'Failed to setup site',
    });
  }
}

