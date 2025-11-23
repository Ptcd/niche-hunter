/**
 * Google Sheets Integration
 * 
 * Functions for creating and managing Google Sheets for site content.
 */

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { prisma } from '@niche-hunter/db';

let authClient: JWT | null = null;

/**
 * Initialize Google Sheets API client
 */
function getAuthClient(): JWT {
  if (authClient) {
    return authClient;
  }

  const serviceAccountPath = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error('GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH environment variable not set');
  }

  // Load service account credentials
  const credentials = require(serviceAccountPath);
  
  authClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return authClient;
}

/**
 * Create a new Google Sheet with 3 tabs
 */
export async function createSiteSheet(
  siteId: string,
  siteName: string
): Promise<string> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  // Create spreadsheet
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: `${siteName} - Content Sheet`,
      },
      sheets: [
        { properties: { title: 'Keywords' } },
        { properties: { title: 'Page Plan' } },
        { properties: { title: 'Content Drafts' } },
      ],
    },
  });

  const sheetId = spreadsheet.data.spreadsheetId;
  if (!sheetId) {
    throw new Error('Failed to create spreadsheet');
  }

  // Set up headers for each tab
  await setupSheetHeaders(sheetId);

  return sheetId;
}

/**
 * Set up headers for all tabs
 */
async function setupSheetHeaders(sheetId: string): Promise<void> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  // Keywords tab headers
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Keywords!A1:J1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        'Keyword',
        'Volume',
        'CPC',
        'KD',
        'Difficulty',
        'Opportunity',
        'Type',
        'Role',
        'City',
        'State',
      ]],
    },
  });

  // Page Plan tab headers
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Page Plan!A1:L1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        'Page ID',
        'Page Type',
        'Slug',
        'Title Tag',
        'H1',
        'Focus Keyword',
        'Supporting Keywords',
        'Search Intent',
        'Internal Links',
        'Content Status',
        'WP Page ID',
        'Target Word Count',
      ]],
    },
  });

  // Content Drafts tab headers
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Content Drafts!A1:H1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        'Page ID',
        'Slug',
        'Focus Keyword',
        'Required Keywords',
        'Outline',
        'Content',
        'Status',
        'Notes',
      ]],
    },
  });
}

/**
 * Write keywords data to Keywords tab
 */
export async function writeKeywordsTab(siteId: string, sheetId: string): Promise<void> {
  // First get site to know city/state
  const siteBasic = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, city: true, state: true, batchId: true },
  });

  if (!siteBasic || !siteBasic.batchId) {
    throw new Error('Site or batch not found');
  }

  // Now get batch with keywords
  const batch = await prisma.scanBatch.findUnique({
    where: { id: siteBasic.batchId },
    include: {
      keywords: {
        where: {
          isSkipped: false,
          city: {
            city: siteBasic.city,
            state: siteBasic.state,
          },
        },
        include: {
          nicheKeyword: true,
          city: true,
          metrics: true,
          difficultyScore: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error('Batch not found');
  }

  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const rows = batch.keywords.map(kw => [
    kw.nicheKeyword.keyword,
    kw.metrics?.searchVolume || '',
    kw.metrics?.cpc || '',
    kw.metrics?.kd || '',
    kw.difficultyScore?.finalDifficulty || '',
    kw.difficultyScore?.opportunity || '',
    kw.keywordType || '',
    kw.keywordRole || '',
    kw.city.city,
    kw.city.state,
  ]);

  // Clear existing data (except headers)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: 'Keywords!A2:J10000',
  });

  // Write new data
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Keywords!A2',
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });
  }
}

/**
 * Write page plan data to Page Plan tab
 */
export async function writePagePlanTab(siteId: string, sheetId: string): Promise<void> {
  const pages = await prisma.sitePage.findMany({
    where: { siteId },
    orderBy: { orderIndex: 'asc' },
  });

  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const rows = pages.map(page => [
    page.id,
    page.pageType,
    page.slug,
    page.titleTag,
    page.h1,
    page.focusKeyword,
    page.supportingKeywords.join(', '),
    page.searchIntent || '',
    page.internalLinks.join(', '),
    page.contentStatus,
    page.wpPageId || '',
    page.targetWordCount ? `${page.targetWordCount}` : '',
  ]);

  // Clear existing data
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: 'Page Plan!A2:L10000',
  });

  // Write new data
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Page Plan!A2',
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });
  }
}

/**
 * Write content drafts template to Content Drafts tab
 */
export async function writeContentDraftsTab(siteId: string, sheetId: string): Promise<void> {
  const pages = await prisma.sitePage.findMany({
    where: { siteId },
    include: {
      skeletons: {
        orderBy: { orderIndex: 'asc' },
      },
    },
    orderBy: { orderIndex: 'asc' },
  });

  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const rows = pages.map(page => {
    // Build outline from skeletons
    const outline = page.skeletons
      .map(s => `${s.heading} (${s.targetWordCount} words)`)
      .join(' | ');

    // Get all required keywords from skeletons
    const requiredKeywords = new Set<string>();
    for (const skeleton of page.skeletons) {
      skeleton.requiredKeywordRoles.forEach(role => {
        // We'd need to map roles back to actual keywords, but for now just use the role
        requiredKeywords.add(role);
      });
    }

    return [
      page.id,
      page.slug,
      page.focusKeyword,
      Array.from(requiredKeywords).join(', '),
      outline,
      page.generatedContent || '',
      page.contentStatus,
      '',
    ];
  });

  // Clear existing data
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: 'Content Drafts!A2:H10000',
  });

  // Write new data
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Content Drafts!A2',
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });
  }
}

/**
 * Read content from Content Drafts tab
 */
export async function readContentFromSheet(sheetId: string): Promise<Map<string, string>> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Content Drafts!A2:H10000',
  });

  const rows = response.data.values || [];
  const contentMap = new Map<string, string>();

  for (const row of rows) {
    if (row.length >= 6) {
      const pageId = row[0];
      const content = row[5] || ''; // Content column
      const status = row[6] || ''; // Status column
      
      if (status === 'ready' || status === 'published') {
        contentMap.set(pageId, content);
      }
    }
  }

  return contentMap;
}

