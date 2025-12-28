/**
 * POST /api/v2/sites/[siteId]/build-deterministic
 * 
 * Build a complete site using deterministic generator (v2 pipeline)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { generateSiteDeterministic } from '@niche-hunter/deterministic-generator';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { siteId } = req.query;
  const { publishMode = 'skip', model = 'gpt-4o-mini', temperature = 0.7 } = req.body;

  if (typeof siteId !== 'string') {
    return res.status(400).json({ error: 'Invalid site ID' });
  }

  try {
    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Create temporary output directory
    const outputDirectory = join(os.tmpdir(), `niche-hunter-sites`, siteId, Date.now().toString());

    // Run deterministic generator
    console.log(`[API] Starting deterministic generation for site ${siteId}`);
    const manifest = await generateSiteDeterministic(siteId, {
      model,
      temperature,
      seed: undefined,
      prompt_version: 'v1.3',
      strictness_level: 'strict',
      output_directory: outputDirectory,
    });

    // Optionally publish to WordPress
    let publishResult = null;
    if (publishMode !== 'skip' && site.wpApiBase && site.wpUser && site.wpAppPassword) {
      try {
        const { publishFromArtifacts } = await import('@niche-hunter/deterministic-generator');
        const { publishPages } = await import('../../../lib/wpFactoryClient');
        
        // Create publish function adapter
        const publishFn = async (
          pages: any[],
          wpApiBase: string,
          wpUser: string,
          wpPassword: string
        ) => {
          const results = await publishPages(pages, wpApiBase, wpUser, wpPassword);
          return { results: results.results || [] };
        };

        publishResult = await publishFromArtifacts(
          siteId,
          outputDirectory,
          JSON.parse(await fs.readFile(join(outputDirectory, 'blueprint.json'), 'utf-8')),
          publishFn,
          publishMode === 'publish' ? 'publish' : 'draft'
        );
      } catch (error: any) {
        console.error('[API] Publishing failed:', error);
        publishResult = { error: error.message };
      }
    }

    return res.status(200).json({
      status: 'ok',
      manifest,
      publishResult,
      outputDirectory,
    });
  } catch (error: any) {
    console.error('[API] Deterministic generation failed:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

