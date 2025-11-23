/**
 * POST /api/webhooks/lead
 * 
 * Webhook endpoint for capturing leads from WordPress forms or other sources.
 * Creates Lead record and updates SiteMetrics.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma, LeadType } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { siteId, type, contactName, contactPhone, contactEmail, message, source } = req.body;

    if (!siteId || !type) {
      return res.status(400).json({ error: 'Missing siteId or type' });
    }

    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        siteId,
        type: type as LeadType,
        contactName,
        contactPhone,
        contactEmail,
        message,
        source,
      },
    });

    // Update metrics for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.siteMetrics.upsert({
      where: {
        siteId_date: { siteId, date: today },
      },
      update: {
        formLeads: { increment: type === 'FORM' ? 1 : 0 },
      },
      create: {
        siteId,
        date: today,
        formLeads: type === 'FORM' ? 1 : 0,
      },
    });

    return res.status(201).json({ leadId: lead.id });
  } catch (error: any) {
    console.error('[lead-webhook] error:', error);
    return res.status(500).json({ error: error.message });
  }
}

