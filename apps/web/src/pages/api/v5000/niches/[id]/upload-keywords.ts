import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { parse } from 'csv-parse/sync';
import { IncomingForm } from 'formidable';
import * as fs from 'fs';
import * as path from 'path';

// Disable body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    if (typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid niche ID' });
    }

    const niche = await prisma.niche.findUnique({ where: { id } });
    if (!niche) {
      return res.status(404).json({ error: 'Niche not found' });
    }

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

    const file = Array.isArray(files.csv) ? files.csv[0] : files.csv;
    if (!file) {
      console.error('No file uploaded. Files received:', Object.keys(files));
      return res.status(400).json({ error: 'CSV file is required' });
    }

    console.log('File uploaded:', file.originalFilename, 'Size:', file.size, 'Path:', file.filepath);

    const topCount = Array.isArray(fields.topCount)
      ? parseInt(fields.topCount[0])
      : parseInt(fields.topCount as string) || 20;

    const csvContent = fs.readFileSync(file.filepath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    });

    const keywordsWithVolume: Array<{ keyword: string; volume: number; kd: number | null }> = [];

    for (const record of records) {
      const keyword = record.keyword || record.Keyword || record.term || record.Term || record.query || record.Query;
      const volumeStr =
        record.sv ||
        record.SV ||
        record.volume ||
        record.Volume ||
        record.search_volume ||
        record['Search Volume'] ||
        record.monthly_searches ||
        record['Monthly Searches'];
      const kdStr = record.kd || record.KD || record.keyword_difficulty || record['Keyword Difficulty'];

      if (keyword && volumeStr) {
        const volume = parseInt(volumeStr.toString().replace(/,/g, ''), 10);
        const kd = kdStr ? parseFloat(kdStr.toString()) : null;

        if (!isNaN(volume) && volume > 0) {
          keywordsWithVolume.push({
            keyword: keyword.trim(),
            volume,
            kd: !isNaN(kd as number) && kd !== null ? Math.round(kd as number) : null,
          });
        }
      }
    }

    if (keywordsWithVolume.length === 0) {
      return res.status(400).json({
        error: 'No valid keywords with volumes found in CSV. Expected columns: keyword, sv (or volume)',
      });
    }

    keywordsWithVolume.sort((a, b) => b.volume - a.volume);
    const topKeywords = keywordsWithVolume.slice(0, topCount);

    const added: string[] = [];
    const skipped: string[] = [];

    for (const { keyword, volume, kd } of topKeywords) {
      try {
        const existing = await prisma.nicheKeyword.findUnique({
          where: { nicheId_keyword: { nicheId: id, keyword } },
        });

        if (existing) {
          skipped.push(keyword);
          continue;
        }

        await prisma.nicheKeyword.create({
          data: {
            nicheId: id,
            keyword: keyword,
            nationalVolume: volume,
            nationalKd: kd,
            intent: 'transactional',
            isActive: true,
          },
        });

        added.push(keyword);
      } catch (error: any) {
        if (!error.message?.includes('Unique constraint')) {
          console.error(`Error adding keyword ${keyword}:`, error);
        }
        skipped.push(keyword);
      }
    }

    try {
      fs.unlinkSync(file.filepath);
    } catch (cleanupError) {
      console.warn('Failed to clean up uploaded file:', cleanupError);
    }

    return res.status(200).json({
      added: added.length,
      skipped: skipped.length,
      keywords: added,
      skippedKeywords: skipped,
    });
  } catch (error: any) {
    console.error('Error uploading keywords:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: error.message || 'Failed to upload keywords',
      details: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}



