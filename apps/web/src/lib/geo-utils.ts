/**
 * Geographic Utilities
 * 
 * Functions for calculating distances and finding nearby cities
 * using the Haversine formula for great-circle distances.
 */

import { prisma } from '@niche-hunter/db';

export interface CityWithDistance {
  id: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  population: number | null;
  distance: number; // in miles
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Find nearby cities within a specified radius
 * 
 * @param cityId - ID of the source city
 * @param radiusMiles - Maximum distance in miles (default: 30)
 * @param minPopulation - Minimum population threshold (default: 5000)
 * @param maxCities - Maximum number of cities to return (default: 10)
 * @returns Array of cities with distance, sorted by distance
 */
export async function findNearbyCities(
  cityId: string,
  radiusMiles: number = 30,
  minPopulation: number = 5000,
  maxCities: number = 10
): Promise<CityWithDistance[]> {
  // Get source city
  const sourceCity = await prisma.cityV5000.findUnique({
    where: { id: cityId },
  });

  if (!sourceCity || !sourceCity.latitude || !sourceCity.longitude) {
    console.warn(`⚠️ City ${cityId} missing coordinates`);
    return [];
  }

  const sourceLat = sourceCity.latitude;
  const sourceLon = sourceCity.longitude;

  console.log(`   📍 [GEO] Source city: ${sourceCity.city}, ${sourceCity.state} (lat: ${sourceLat}, lon: ${sourceLon})`);

  // Calculate bounding box for initial filter (performance optimization)
  // 1 degree latitude ≈ 69 miles, 1 degree longitude ≈ 69 * cos(latitude) miles
  const latDelta = radiusMiles / 69;
  const lonDelta = radiusMiles / (69 * Math.cos(toRadians(sourceLat)));

  const minLat = sourceLat - latDelta;
  const maxLat = sourceLat + latDelta;
  const minLon = sourceLon - lonDelta;
  const maxLon = sourceLon + lonDelta;

  console.log(`   📍 [GEO] Bounding box: lat [${minLat.toFixed(4)}, ${maxLat.toFixed(4)}], lon [${minLon.toFixed(4)}, ${maxLon.toFixed(4)}]`);
  console.log(`   📍 [GEO] Searching for cities with population >= ${minPopulation}`);

  // Query cities within bounding box (no state filter - include cross-border cities)
  // Make population filter nullable-aware (include cities with NULL population)
  const candidates = await prisma.cityV5000.findMany({
    where: {
      latitude: {
        gte: minLat,
        lte: maxLat,
        not: null,
      },
      longitude: {
        gte: minLon,
        lte: maxLon,
        not: null,
      },
      id: {
        not: cityId, // Exclude source city
      },
      OR: [
        { population: { gte: minPopulation } },
        { population: null }, // Include cities with no population data
      ],
    },
  });

  console.log(`   📍 [GEO] Found ${candidates.length} candidate cities in bounding box`);
  if (candidates.length > 0) {
    console.log(`   📍 [GEO] Sample candidates: ${candidates.slice(0, 5).map(c => `${c.city}, ${c.state} (pop: ${c.population || 'N/A'})`).join(', ')}`);
  }
  
  // Calculate exact distance for each candidate
  const citiesWithDistance: CityWithDistance[] = candidates
    .map((city) => {
      if (!city.latitude || !city.longitude) return null;

      const distance = calculateDistance(
        sourceLat,
        sourceLon,
        city.latitude,
        city.longitude
      );

      return {
        id: city.id,
        city: city.city,
        state: city.state,
        latitude: city.latitude,
        longitude: city.longitude,
        population: city.population,
        distance,
      };
    })
    .filter((city): city is CityWithDistance => {
      if (!city) return false;
      return city.distance <= radiusMiles; // Filter by exact distance
    })
    .sort((a, b) => a.distance - b.distance) // Sort by distance
    .slice(0, maxCities); // Limit results

  console.log(`   ✅ [GEO] Returning ${citiesWithDistance.length} cities within ${radiusMiles} miles: ${citiesWithDistance.map(c => `${c.city}, ${c.state} (${c.distance}mi)`).join(', ')}`);
  
  return citiesWithDistance;
}

/**
 * Get primary city from a batch (first city with keywords)
 */
export async function getPrimaryCityFromBatch(batchId: string): Promise<{
  id: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
} | null> {
  const firstKeyword = await prisma.keywordV5000.findFirst({
    where: {
      batchId,
      isSkipped: false,
    },
    include: {
      city: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (!firstKeyword) return null;

  return {
    id: firstKeyword.city.id,
    city: firstKeyword.city.city,
    state: firstKeyword.city.state,
    latitude: firstKeyword.city.latitude,
    longitude: firstKeyword.city.longitude,
  };
}

