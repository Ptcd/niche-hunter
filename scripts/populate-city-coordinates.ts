/**
 * Populate City Coordinates Script
 * 
 * One-time script to fetch and populate latitude/longitude for cities
 * in the CityV5000 table using a free geocoding API (Nominatim).
 * 
 * Usage: npx tsx scripts/populate-city-coordinates.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from multiple possible locations FIRST
// This must happen before importing Prisma, which initializes on import
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

// Rate limit: Nominatim allows 1 request per second
const DELAY_MS = 1100; // Slightly more than 1 second to be safe

async function geocodeCity(city: string, state: string): Promise<{ lat: number; lon: number } | null> {
  const query = encodeURIComponent(`${city}, ${state}, USA`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NicheHunter/1.0', // Required by Nominatim
      },
    });

    if (!response.ok) {
      console.error(`   ⚠️  HTTP ${response.status} for ${city}, ${state}`);
      return null;
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
      };
    }

    return null;
  } catch (error: any) {
    console.error(`   ❌ Error geocoding ${city}, ${state}:`, error.message);
    return null;
  }
}

async function populateCoordinates() {
  // Dynamically import Prisma after environment is loaded
  const { prisma } = await import('@niche-hunter/db');
  
  console.log('🚀 Starting city coordinate population...\n');

  // Get all cities without coordinates
  const cities = await prisma.cityV5000.findMany({
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

  console.log(`📊 Found ${cities.length} cities without coordinates\n`);

  if (cities.length === 0) {
    console.log('✅ All cities already have coordinates!');
    await prisma.$disconnect();
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    const progress = `[${i + 1}/${cities.length}]`;

    console.log(`${progress} Geocoding ${city.city}, ${city.state}...`);

    const coords = await geocodeCity(city.city, city.state);

    if (coords) {
      await prisma.cityV5000.update({
        where: { id: city.id },
        data: {
          latitude: coords.lat,
          longitude: coords.lon,
        },
      });
      console.log(`   ✅ ${city.city}, ${city.state}: ${coords.lat}, ${coords.lon}`);
      successCount++;
    } else {
      console.log(`   ❌ Failed to geocode ${city.city}, ${city.state}`);
      failCount++;
    }

    // Rate limiting: wait between requests
    if (i < cities.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);

  await prisma.$disconnect();
}

// Run the script
populateCoordinates().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

