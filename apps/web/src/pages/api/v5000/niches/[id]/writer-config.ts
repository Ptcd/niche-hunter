/**
 * GET/PUT /api/v5000/niches/[id]/writer-config
 * 
 * Get or update content writer configuration for a niche.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid niche ID' });
  }

  if (req.method === 'GET') {
    try {
      const config = await prisma.contentWriterConfig.findUnique({
        where: { nicheId: id },
      });

      return res.status(200).json(config || null);
    } catch (error: any) {
      console.error('Error fetching writer config:', error);
      return res.status(500).json({
        error: error.message || 'Failed to fetch writer config',
      });
    }
  }

  if (req.method === 'PUT') {
    try {
      const {
        systemPrompt,
        tone,
        styleRules,
        brandVoice,
        terminology,
        thingsToAvoid,
        externalLinkDomains,
      } = req.body;

      // Upsert config
      const config = await prisma.contentWriterConfig.upsert({
        where: { nicheId: id },
        update: {
          systemPrompt,
          tone,
          styleRules,
          brandVoice,
          terminology,
          thingsToAvoid,
          externalLinkDomains: externalLinkDomains || [],
        },
        create: {
          nicheId: id,
          systemPrompt,
          tone,
          styleRules,
          brandVoice,
          terminology,
          thingsToAvoid,
          externalLinkDomains: externalLinkDomains || [],
        },
      });

      return res.status(200).json(config);
    } catch (error: any) {
      console.error('Error updating writer config:', error);
      return res.status(500).json({
        error: error.message || 'Failed to update writer config',
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

