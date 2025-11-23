import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { prisma } from './index';

interface PayoutRow {
  zip?: string;
  city?: string;
  state?: string;
  payout: number;
}

function normalizeCurrency(value: string | number | undefined | null): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  
  // Convert to string and remove currency symbols, commas, spaces
  const cleaned = String(value)
    .trim()
    .replace(/[$€£¥,\s]/g, '') // Remove $, commas, spaces, and other currency symbols
    .replace(/[^\d.-]/g, ''); // Remove any remaining non-numeric chars except decimal point and minus
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function normalizeState(value: string): string {
  return value.trim().toUpperCase().slice(0, 2);
}

function normalizeString(value: string): string {
  return value.trim();
}

export async function importPayoutsFromCSV(filePath: string): Promise<number> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const payouts: PayoutRow[] = [];

  for (const record of records) {
    // Support multiple column name variations
    const zip =
      record['Zip Code'] ||
      record['ZIP Code'] ||
      record['zip'] ||
      record['zip_code'] ||
      '';
    const city =
      record['city'] ||
      record['City'] ||
      record['CITY'] ||
      record['city_name'] ||
      '';
    const state =
      record['state_id'] ||
      record['State'] ||
      record['STATE'] ||
      record['state'] ||
      '';
    const payoutStr =
      record['CPL Buyer Payouts'] ||
      record['Duration Buyer Pay'] ||
      record['payout'] ||
      record['Payout'] ||
      record['CPL'] ||
      '0';

    const payout = normalizeCurrency(payoutStr);

    if (payout <= 0) continue;

    // Require at least city+state or zip
    if (!city && !state && !zip) continue;
    if (!city || !state) {
      if (!zip) continue;
    }

    payouts.push({
      zip: zip ? normalizeString(zip) : undefined,
      city: city ? normalizeString(city) : undefined,
      state: state ? normalizeState(state) : undefined,
      payout,
    });
  }

  // Upsert payouts
  let imported = 0;
  for (const payout of payouts) {
    try {
      // Use create with unique constraint handling
      const existing = await prisma.payout.findFirst({
        where: {
          city: payout.city || '',
          state: payout.state || '',
          zip: payout.zip || null,
        },
      });

      if (existing) {
        await prisma.payout.update({
          where: { id: existing.id },
          data: { payout: payout.payout },
        });
      } else {
        await prisma.payout.create({
          data: {
            city: payout.city || '',
            state: payout.state || '',
            zip: payout.zip || undefined,
            payout: payout.payout,
          },
        });
      }
      imported++;
    } catch (error) {
      console.error(`Error importing payout for ${payout.city}, ${payout.state}:`, error);
    }
  }

  return imported;
}

export async function getPayoutForLocation(
  city: string,
  state: string,
  zip?: string
): Promise<number | null> {
  const normalizedState = normalizeState(state);
  const normalizedCity = normalizeString(city);

  // Try to find by zip first if provided
  if (zip) {
    const normalizedZip = normalizeString(zip);
    const byZip = await prisma.payout.findFirst({
      where: {
        city: normalizedCity,
        state: normalizedState,
        zip: normalizedZip,
      },
    });
    if (byZip) return byZip.payout;
  }

  // Try by city+state
  const byCityState = await prisma.payout.findFirst({
    where: {
      city: normalizedCity,
      state: normalizedState,
    },
  });

  return byCityState?.payout || null;
}
