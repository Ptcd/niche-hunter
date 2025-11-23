/**
 * Import City Coordinates from SimpleMaps CSV
 * 
 * This script imports latitude/longitude coordinates from the SimpleMaps
 * US Cities Database CSV file into the CityV5000 table.
 * 
 * Steps:
 * 1. Download the free "Basic" CSV from: https://simplemaps.com/data/us-cities
 * 2. Save it as: scripts/data/uscities.csv
 * 3. Run: npx tsx scripts/import-city-coordinates-from-csv.ts
 * 
 * The CSV should have columns: city, state_id, lat, lng, etc.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from multiple possible locations FIRST
const envPaths = [
  path.join(process.cwd(), 'apps', 'web', '.env.local'),
  path.join(process.cwd(), '.env.local'),
  path.join(process.cwd(), '.env'),
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log(`✅ Loaded environment from: ${envPath}`);
    break;
  }
}

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables!');
  console.error('   Please ensure .env.local or .env exists with DATABASE_URL');
  process.exit(1);
}

interface SimpleMapsCity {
  city: string;
  state_id: string; // State abbreviation (e.g., "FL")
  lat: number;
  lng: number;
  population?: number;
}

/**
 * Parse CSV file and extract city data
 */
function parseCSV(filePath: string): SimpleMapsCity[] {
  console.log(`📖 Reading CSV file: ${filePath}\n`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ CSV file not found: ${filePath}`);
    console.error('\n📥 Please download the free "Basic" CSV from:');
    console.error('   https://simplemaps.com/data/us-cities');
    console.error(`\n💾 Save it as: ${filePath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    console.error('❌ CSV file is empty');
    process.exit(1);
  }

  // Parse header row
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const cityIndex = header.indexOf('city');
  const stateIndex = header.indexOf('state_id');
  const latIndex = header.indexOf('lat');
  const lngIndex = header.indexOf('lng');
  const popIndex = header.indexOf('population');

  if (cityIndex === -1 || stateIndex === -1 || latIndex === -1 || lngIndex === -1) {
    console.error('❌ CSV file missing required columns: city, state_id, lat, lng');
    console.error(`   Found columns: ${header.join(', ')}`);
    process.exit(1);
  }

  console.log(`✅ CSV header parsed: ${lines.length - 1} rows\n`);

  // Parse data rows
  const cities: SimpleMapsCity[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Handle CSV with quoted fields that may contain commas
    const values = parseCSVLine(line);

    if (values.length <= Math.max(cityIndex, stateIndex, latIndex, lngIndex)) {
      continue; // Skip malformed rows
    }

    const city = values[cityIndex]?.trim().replace(/^"|"$/g, '');
    const stateId = values[stateIndex]?.trim().replace(/^"|"$/g, '');
    const latStr = values[latIndex]?.trim().replace(/^"|"$/g, '');
    const lngStr = values[lngIndex]?.trim().replace(/^"|"$/g, '');
    const popStr = popIndex !== -1 ? values[popIndex]?.trim().replace(/^"|"$/g, '') : null;

    if (!city || !stateId || !latStr || !lngStr) {
      continue; // Skip rows with missing required data
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      continue; // Skip rows with invalid coordinates
    }

    cities.push({
      city,
      state_id: stateId.toUpperCase(),
      lat,
      lng,
      population: popStr ? parseInt(popStr, 10) : undefined,
    });
  }

  console.log(`✅ Parsed ${cities.length} cities from CSV\n`);
  return cities;
}

/**
 * Parse a CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  values.push(current);

  return values;
}

/**
 * Normalize city name for matching (remove common variations)
 */
function normalizeCityName(city: string): string {
  return city
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^st\.\s*/i, 'saint ')
    .replace(/^st\s+/i, 'saint ');
}

async function importCoordinates() {
  // Dynamically import Prisma after environment is loaded
  const { prisma } = await import('@niche-hunter/db');

  console.log('🚀 Starting city coordinate import from CSV...\n');

  // Path to CSV file
  const csvPath = path.join(process.cwd(), 'scripts', 'data', 'uscities.csv');

  // Parse CSV
  const csvCities = parseCSV(csvPath);

  // Create lookup map: "city,state" -> { lat, lng }
  const csvMap = new Map<string, SimpleMapsCity>();
  for (const csvCity of csvCities) {
    const key = `${normalizeCityName(csvCity.city)},${csvCity.state_id}`;
    csvMap.set(key, csvCity);
  }

  console.log(`📊 Created lookup map with ${csvMap.size} cities\n`);

  // Get all cities from database
  const dbCities = await prisma.cityV5000.findMany({
    where: {
      OR: [
        { latitude: null },
        { longitude: null },
      ],
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`📊 Found ${dbCities.length} cities in database without coordinates\n`);

  if (dbCities.length === 0) {
    console.log('✅ All cities already have coordinates!');
    await prisma.$disconnect();
    return;
  }

  let matchedCount = 0;
  let updatedCount = 0;
  let notFoundCount = 0;

  // Helper function to process batch updates
  async function processBatch(
    prisma: any,
    batch: Array<{ id: string; lat: number; lng: number; city: string; state: string }>,
    size: number
  ) {
    try {
      // Use Promise.all for parallel updates within batch
      await Promise.all(
        batch.map((update) =>
          prisma.cityV5000.update({
            where: { id: update.id },
            data: {
              latitude: update.lat,
              longitude: update.lng,
            },
          })
        )
      );
      console.log(`✅ Updated batch of ${size} cities`);
    } catch (error: any) {
      console.error(`❌ Error processing batch:`, error.message);
      // Fallback to individual updates if batch fails
      for (const update of batch) {
        try {
          await prisma.cityV5000.update({
            where: { id: update.id },
            data: {
              latitude: update.lat,
              longitude: update.lng,
            },
          });
        } catch (err: any) {
          console.error(`   ❌ Failed: ${update.city}, ${update.state}:`, err.message);
        }
      }
    }
  }

  // Process in batches for better performance
  const batchSize = 100;
  const updates: Array<{ id: string; lat: number; lng: number; city: string; state: string }> = [];

  // Match cities and collect updates
  for (let i = 0; i < dbCities.length; i++) {
    const dbCity = dbCities[i];
    const progress = `[${i + 1}/${dbCities.length}]`;

    const lookupKey = `${normalizeCityName(dbCity.city)},${dbCity.state.toUpperCase()}`;
    let csvCity = csvMap.get(lookupKey);

    // Try alternative matching if first attempt fails
    if (!csvCity) {
      const altKey = `${dbCity.city.toLowerCase()},${dbCity.state.toUpperCase()}`;
      csvCity = csvMap.get(altKey);
    }

    if (csvCity) {
      matchedCount++;
      updates.push({
        id: dbCity.id,
        lat: csvCity.lat,
        lng: csvCity.lng,
        city: dbCity.city,
        state: dbCity.state,
      });
    } else {
      notFoundCount++;
      if (i % 100 === 0 || notFoundCount <= 10) {
        console.log(`${progress} ⚠️  ${dbCity.city}, ${dbCity.state}: Not found in CSV`);
      }
    }

    // Process batch when it reaches batchSize
    if (updates.length >= batchSize) {
      await processBatch(prisma, updates, batchSize);
      updatedCount += updates.length;
      updates.length = 0; // Clear array
    }
  }

  // Process remaining updates
  if (updates.length > 0) {
    await processBatch(prisma, updates, updates.length);
    updatedCount += updates.length;
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Matched: ${matchedCount}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Not found: ${notFoundCount}`);

  await prisma.$disconnect();
}

// Run the script
importCoordinates().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

