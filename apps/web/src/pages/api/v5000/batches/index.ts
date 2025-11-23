import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { parse } from 'csv-parse/sync';
import { IncomingForm } from 'formidable';
import * as fs from 'fs';
import * as path from 'path';
import { processBatch } from '../../../../lib/v5000-processor';
import { withAuth } from '../../../../lib/auth/withAuth';

// Disable body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

async function handler(req: NextApiRequest & { auth: any }, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const batches = await prisma.scanBatch.findMany({
        where: {
          accountId: req.auth.currentAccountId,
        },
        include: {
          niche: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json(batches);
    } catch (error: any) {
      console.error('Error fetching batches:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch batches' });
    }
  }

  if (req.method === 'POST') {
    try {
      // Ensure tmp directory exists
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const form = new IncomingForm({
        uploadDir: tmpDir,
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB max
      });

      // Parse form with promise wrapper
      const [fields, files] = await new Promise<[any, any]>((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) {
            console.error('Form parse error:', err);
            reject(err);
            return;
          }
          resolve([fields, files]);
        });
      });

      // Get niche ID from form fields
      const nicheIdField = Array.isArray(fields.nicheId) ? fields.nicheId[0] : fields.nicheId;
      const id = typeof nicheIdField === 'string' ? nicheIdField : null;
      
      if (!id) {
        return res.status(400).json({ error: 'Niche ID is required' });
      }

      const niche = await prisma.niche.findUnique({
        where: { id },
        include: {
          keywords: {
            where: { isActive: true },
          },
        },
      });

      if (!niche) {
        return res.status(404).json({ error: 'Niche not found' });
      }

      if (niche.keywords.length === 0) {
        return res.status(400).json({ error: 'Niche has no active keywords. Add keywords first.' });
      }

      const file = Array.isArray(files.csv) ? files.csv[0] : files.csv;
      if (!file) {
        return res.status(400).json({ error: 'CSV file is required' });
      }

      const batchName = Array.isArray(fields.name) ? fields.name[0] : fields.name || null;

      const csvContent = fs.readFileSync(file.filepath, 'utf-8');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      });

      // Deduplicate cities
      const cityMap = new Map<string, any>();
      const keywords: Array<{ nicheKeywordId: string; cityId: string; localizedQuery: string }> = [];

      for (const record of records) {
        const city = record.city?.trim();
        const state = record.state?.trim();
        const payoutStr = record.payout?.trim();

        if (!city || !state) continue;

        // Create a unique key for city+state to prevent duplicates
        const cityKey = `${city.toLowerCase()},${state.toLowerCase()}`;

        // Skip if we've already processed this city+state combination
        if (cityMap.has(cityKey)) continue;

        // Payout is required from CSV
        if (!payoutStr) {
          return res.status(400).json({
            error: `Missing payout for ${city}, ${state}. CSV must include a 'payout' column.`,
          });
        }

        // Strip dollar signs, commas, and other currency symbols before parsing
        const cleanedPayoutStr = payoutStr.replace(/[$,\s]/g, '');
        const payout = parseFloat(cleanedPayoutStr);
        if (isNaN(payout) || payout <= 0) {
          return res.status(400).json({
            error: `Invalid payout value "${payoutStr}" for ${city}, ${state}. Must be a positive number.`,
          });
        }

        // Find or create city (update payout if exists)
        let cityRecord = await prisma.cityV5000.findFirst({
          where: {
            city,
            state,
            countryCode: 'US',
          },
        });

        if (!cityRecord) {
          cityRecord = await prisma.cityV5000.create({
            data: {
              city,
              state,
              countryCode: 'US',
              payout,
            },
          });
        } else if (cityRecord.payout !== payout) {
          // Update payout if it changed
          cityRecord = await prisma.cityV5000.update({
            where: { id: cityRecord.id },
            data: { payout },
          });
        }

        // Store in map to prevent duplicates
        cityMap.set(cityKey, cityRecord);

        // Create keywords for each niche keyword
        // Use only city name (not state) for better API results
        for (const nicheKeyword of niche.keywords) {
          const localizedQuery = `${nicheKeyword.keyword} ${city}`;
          keywords.push({
            nicheKeywordId: nicheKeyword.id,
            cityId: cityRecord.id,
            localizedQuery,
          });
        }
      }

      if (keywords.length === 0) {
        return res.status(400).json({ error: 'No valid cities found in CSV' });
      }

      // Create batch with accountId
      const batch = await prisma.scanBatch.create({
        data: {
          nicheId: id,
          accountId: req.auth.currentAccountId,
          name: batchName,
          status: 'queued',
          totalKeywords: keywords.length,
          keywords: {
            create: keywords,
          },
        },
        include: {
          niche: true,
        },
      });

      // Clean up uploaded file
      try {
        fs.unlinkSync(file.filepath);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file:', cleanupError);
      }

      // Trigger processing (will be called in background)
      console.log(`🚀 Triggering background processing for batch ${batch.id}`);
      processBatch(batch.id).catch((error) => {
        console.error(`❌ Background processing failed for batch ${batch.id}:`, error);
        // Update batch status to failed if processing doesn't start
        prisma.scanBatch
          .update({
            where: { id: batch.id },
            data: { status: 'failed' },
          })
          .catch(() => {});
      });

      return res.status(201).json(batch);
    } catch (error: any) {
      console.error('Error creating batch:', error);
      return res.status(500).json({
        error: error.message || 'Failed to create batch',
        details: error.toString(),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);

