import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import ExcelJS from 'exceljs';
import { classifyKeywordWithScope, getKeywordTypeLabel, KeywordType } from '../../../../../lib/keyword-classifier';
import { buildPagePlan } from '../../../../../lib/page-plan-builder';

/**
 * Export keywords to Excel file with multiple sheets
 * Sheet 1: Local Keywords (grouped by type)
 * Sheet 2: National Keywords (grouped by type)
 * Sheet 3: Suggested Site Structure
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Batch ID is required' });
  }

  try {
    // Get batch and niche
    const batch = await prisma.scanBatch.findUnique({
      where: { id },
      include: {
        niche: true,
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Get all keywords for this niche
    const allKeywords = await prisma.nicheKeyword.findMany({
      where: {
        nicheId: batch.nicheId,
        isActive: true,
      },
      include: {
        keywords: {
          include: {
            city: true,
            metrics: true,
            difficultyScore: true,
          },
        },
      },
      orderBy: [
        { keywordType: 'asc' },
        { nationalVolume: 'desc' },
      ],
    });

    // Separate local and national keywords
    const localKeywords = allKeywords.filter(nk => nk.scope === 'local' || !nk.scope);
    const nationalKeywords = allKeywords.filter(nk => nk.scope === 'national');

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Niche Hunter';
    workbook.created = new Date();

    // Helper function to add keyword sheet
    const addKeywordSheet = (
      sheetName: string,
      keywords: typeof allKeywords,
      isLocal: boolean
    ) => {
      const sheet = workbook.addWorksheet(sheetName);

      // Define columns
      sheet.columns = [
        { header: 'Keyword', key: 'keyword', width: 40 },
        { header: 'Type', key: 'type', width: 15 },
        { header: 'Volume', key: 'volume', width: 12 },
        { header: 'Difficulty', key: 'difficulty', width: 12 },
        { header: 'CPC', key: 'cpc', width: 12 },
        { header: 'Suggested Page', key: 'suggestedPage', width: 20 },
        { header: 'Search Intent', key: 'intent', width: 20 },
        ...(isLocal ? [{ header: 'City', key: 'city', width: 20 }] : []),
      ];

      // Style header row
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Group by type: money, supporting, informational, other
      const typeOrder = ['money', 'supporting', 'informational', 'brand', 'local', 'other'];
      const grouped = new Map<string, typeof keywords>();
      
      for (const type of typeOrder) {
        grouped.set(type, []);
      }

      for (const nk of keywords) {
        const type = nk.keywordType || 'other';
        if (!grouped.has(type)) {
          grouped.set(type, []);
        }
        grouped.get(type)!.push(nk);
      }

      let rowNum = 2;

      // Add keywords grouped by type
      for (const type of typeOrder) {
        const typeKeywords = grouped.get(type) || [];
        if (typeKeywords.length === 0) continue;

        // Add type header
        const typeLabel = getKeywordTypeLabel(type as KeywordType | null);
        sheet.getRow(rowNum).font = { bold: true, size: 12 };
        sheet.getRow(rowNum).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' },
        };
        sheet.getCell(rowNum, 1).value = `${typeLabel} Keywords (${typeKeywords.length})`;
        sheet.mergeCells(rowNum, 1, rowNum, isLocal ? 8 : 7);
        rowNum++;

        // Add keywords
        for (const nk of typeKeywords) {
          const classification = classifyKeywordWithScope(nk.keyword);
          
          // For local keywords, get city info from KeywordV5000
          let cityInfo = '';
          let avgVolume = nk.nationalVolume || 0;
          let avgDifficulty = nk.nationalKd || null;
          let avgCpc = null;

          if (isLocal && nk.keywords.length > 0) {
            const cities = Array.from(new Set(nk.keywords.map(k => `${k.city.city}, ${k.city.state}`)));
            cityInfo = cities.join('; ');
            
            // Calculate averages from KeywordV5000 records
            const volumes = nk.keywords
              .map(k => k.metrics?.searchVolume)
              .filter((v): v is number => v !== null && v !== undefined);
            if (volumes.length > 0) {
              avgVolume = Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length);
            }

            const difficulties = nk.keywords
              .map(k => k.difficultyScore?.finalDifficulty)
              .filter((d): d is number => d !== null && d !== undefined);
            if (difficulties.length > 0) {
              avgDifficulty = Math.round(difficulties.reduce((a, b) => a + b, 0) / difficulties.length);
            }
          }

          const row = sheet.getRow(rowNum);
          row.getCell(1).value = nk.keyword;
          row.getCell(2).value = getKeywordTypeLabel(nk.keywordType as KeywordType | null);
          row.getCell(3).value = avgVolume;
          row.getCell(4).value = avgDifficulty !== null ? avgDifficulty : 'N/A';
          row.getCell(5).value = avgCpc !== null ? `$${avgCpc.toFixed(2)}` : 'N/A';
          row.getCell(6).value = classification.suggestedPageType;
          row.getCell(7).value = classification.scope === 'local' ? 'Local Search' : 'National Search';
          
          if (isLocal) {
            row.getCell(8).value = cityInfo || 'N/A';
          }

          rowNum++;
        }

        // Add blank row between types
        rowNum++;
      }
    };

    // Sheet 1: Local Keywords
    if (localKeywords.length > 0) {
      addKeywordSheet('Local Keywords', localKeywords, true);
    }

    // Sheet 2: National Keywords
    if (nationalKeywords.length > 0) {
      addKeywordSheet('National Keywords', nationalKeywords, false);
    }

    // Sheet 3: Page Plan
    const pagePlanSheet = workbook.addWorksheet('Page Plan');
    pagePlanSheet.columns = [
      { header: 'Page Type', key: 'pageType', width: 15 },
      { header: 'Page Title (Title Tag)', key: 'pageTitle', width: 50 },
      { header: 'H1 Heading', key: 'h1', width: 50 },
      { header: 'URL Slug', key: 'urlSlug', width: 40 },
      { header: 'Focus Keyword', key: 'focusKeyword', width: 30 },
      { header: 'Supporting Keywords', key: 'supportingKeywords', width: 60 },
      { header: 'Search Intent', key: 'searchIntent', width: 20 },
      { header: 'Content Length Target', key: 'contentLength', width: 35 },
      { header: 'Cluster Key', key: 'clusterKey', width: 20 },
      { header: 'Internal Link Targets', key: 'internalLinks', width: 60 },
      { header: 'Notes for VA', key: 'notes', width: 50 },
    ];

    // Style header row
    pagePlanSheet.getRow(1).font = { bold: true };
    pagePlanSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Generate page plan (now async)
    const pagePlan = await buildPagePlan(allKeywords, batch);

    // Write page plan rows
    pagePlan.forEach((page, idx) => {
      const row = pagePlanSheet.getRow(idx + 2);
      row.getCell(1).value = page.pageType;
      row.getCell(2).value = page.pageTitle;
      row.getCell(3).value = page.h1;
      row.getCell(4).value = page.urlSlug;
      row.getCell(5).value = page.focusKeyword;
      row.getCell(6).value = page.supportingKeywords || 'N/A';
      row.getCell(7).value = page.searchIntent;
      row.getCell(8).value = page.contentLength;
      row.getCell(9).value = page.clusterKey || 'general';
      row.getCell(10).value = page.internalLinks || 'N/A';
      row.getCell(11).value = page.notes;
    });

    // Generate buffer
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    // Set response headers
    const filename = `${batch.niche.name.replace(/\s+/g, '-')}-keywords-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());

    return res.send(buffer);
  } catch (error: any) {
    console.error('❌ [EXPORT-KEYWORDS] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to export keywords',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

