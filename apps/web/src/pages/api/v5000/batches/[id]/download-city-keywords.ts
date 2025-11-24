import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import ExcelJS from 'exceljs';
import { getKeywordTypeLabel, KeywordType } from '../../../../../lib/keyword-classifier';
import { buildPagePlan } from '../../../../../lib/page-plan-builder';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, city, state } = req.query;

  if (typeof id !== 'string' || typeof city !== 'string' || typeof state !== 'string') {
    return res.status(400).json({ error: 'Invalid parameters. Batch ID, city, and state are required.' });
  }

  try {
    // Fetch the batch to get the niche name
    const batch = await prisma.scanBatch.findUnique({
      where: { id },
      include: {
        niche: true,
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Fetch keywords for the specific city in this batch
    const keywords = await prisma.keywordV5000.findMany({
      where: {
        batchId: id,
        isSkipped: false,
        city: {
          city: city,
          state: state,
        },
      },
      include: {
        nicheKeyword: true,
        metrics: true,
      },
      orderBy: {
        nicheKeyword: {
          keyword: 'asc',
        },
      },
    });

    // Fetch national keywords for this niche
    const nationalKeywords = await prisma.nicheKeyword.findMany({
      where: {
        nicheId: batch.nicheId,
        scope: 'national',
        isActive: true,
      },
      orderBy: {
        keyword: 'asc',
      },
    });

    // Prepare local keywords
    const localData = keywords.map((kw) => ({
      Keyword: kw.nicheKeyword.keyword,
      Volume: kw.metrics?.searchVolume || 0,
      Type: getKeywordTypeLabel((kw.keywordType || kw.nicheKeyword.keywordType) as KeywordType | null),
      Scope: 'Local',
    }));

    // Prepare national keywords
    const nationalData = nationalKeywords.map((nk) => ({
      Keyword: nk.keyword,
      Volume: nk.nationalVolume || 0,
      Type: getKeywordTypeLabel(nk.keywordType as KeywordType | null),
      Scope: 'National',
    }));

    // Combine both
    const excelData = [...localData, ...nationalData];

    if (excelData.length === 0) {
      return res.status(404).json({ error: 'No keywords found for this city' });
    }

    // Create workbook using exceljs
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Niche Hunter';
    workbook.created = new Date();

    // Sheet 1: Keywords for this city
    const keywordsSheet = workbook.addWorksheet('Keywords');
    keywordsSheet.columns = [
      { header: 'Keyword', key: 'keyword', width: 50 },
      { header: 'Volume', key: 'volume', width: 12 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Scope', key: 'scope', width: 12 },
    ];

    // Style header row
    keywordsSheet.getRow(1).font = { bold: true };
    keywordsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add keyword rows
    excelData.forEach((row, idx) => {
      const sheetRow = keywordsSheet.getRow(idx + 2);
      sheetRow.getCell(1).value = row.Keyword;
      sheetRow.getCell(2).value = row.Volume;
      sheetRow.getCell(3).value = row.Type;
      sheetRow.getCell(4).value = row.Scope;
    });

    // Sheet 2: Page Plan
    // Fetch all keywords for the niche to build complete page plan
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

    // Find the city ID for the selected city
    const selectedCity = await prisma.cityV5000.findFirst({
      where: {
        city: city,
        state: state,
        countryCode: 'US',
      },
    });

    const centerCityId = selectedCity?.id;
    if (centerCityId) {
      console.log(`📍 [DOWNLOAD] Using city ID ${centerCityId} for ${city}, ${state}`);
    } else {
      console.warn(`⚠️ [DOWNLOAD] City ${city}, ${state} not found in database, page plan will use primary city from batch`);
    }

    // Generate page plan (now async) - pass centerCityId if found
    let pagePlan;
    try {
      console.log(`📋 [DOWNLOAD] Building page plan for batch ${id}, city: ${city}, ${state}`);
      pagePlan = await buildPagePlan(allKeywords, batch, centerCityId);
      console.log(`✅ [DOWNLOAD] Page plan built successfully: ${pagePlan.length} pages`);
    } catch (error: any) {
      console.error('❌ [DOWNLOAD] Error building page plan:', error);
      console.error('Stack trace:', error.stack);
      throw error; // Re-throw to be caught by outer try-catch
    }

    // Create Page Plan sheet
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

    // Generate Excel file buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Set response headers for file download
    const nicheName = batch.niche.name.replace(/[^a-z0-9-]/gi, '-');
    const cityName = city.replace(/[^a-z0-9-]/gi, '-');
    const stateName = state.replace(/[^a-z0-9-]/gi, '-');
    const fileName = `${nicheName}-${cityName}-${stateName}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    // Send the file
    return res.send(excelBuffer);
  } catch (error: any) {
    console.error('Error generating Excel file:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate Excel file' });
  }
}

