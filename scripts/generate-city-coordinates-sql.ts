/**
 * Generate SQL Script for City Coordinates
 * 
 * This script reads the SimpleMaps CSV and generates SQL UPDATE statements
 * that can be run directly in Supabase SQL Editor.
 * 
 * Steps:
 * 1. Download the free "Basic" CSV from: https://simplemaps.com/data/us-cities
 * 2. Save it as: scripts/data/uscities.csv
 * 3. Run: npx tsx scripts/generate-city-coordinates-sql.ts
 * 4. Copy the generated SQL from: scripts/data/city-coordinates-updates.sql
 * 5. Paste and run in Supabase SQL Editor
 */

import * as path from 'path';
import * as fs from 'fs';

interface SimpleMapsCity {
  city: string;
  state_id: string;
  lat: number;
  lng: number;
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

    const values = parseCSVLine(line);

    if (values.length <= Math.max(cityIndex, stateIndex, latIndex, lngIndex)) {
      continue;
    }

    const city = values[cityIndex]?.trim().replace(/^"|"$/g, '');
    const stateId = values[stateIndex]?.trim().replace(/^"|"$/g, '');
    const latStr = values[latIndex]?.trim().replace(/^"|"$/g, '');
    const lngStr = values[lngIndex]?.trim().replace(/^"|"$/g, '');

    if (!city || !stateId || !latStr || !lngStr) {
      continue;
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      continue;
    }

    cities.push({
      city,
      state_id: stateId.toUpperCase(),
      lat,
      lng,
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
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

/**
 * Escape SQL string to prevent injection
 */
function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Generate SQL using temporary table approach (more efficient)
 */
function generateSQL(cities: SimpleMapsCity[]): string {
  console.log('📝 Generating SQL script...\n');

  const sqlLines: string[] = [];
  
  sqlLines.push('-- City Coordinates Update Script');
  sqlLines.push('-- Generated from SimpleMaps US Cities Database');
  sqlLines.push('-- Run this in Supabase SQL Editor');
  sqlLines.push('');
  sqlLines.push('BEGIN;');
  sqlLines.push('');
  sqlLines.push('-- Create temporary table with city coordinates');
  sqlLines.push('CREATE TEMP TABLE temp_city_coords (');
  sqlLines.push('  city TEXT,');
  sqlLines.push('  state TEXT,');
  sqlLines.push('  lat DOUBLE PRECISION,');
  sqlLines.push('  lng DOUBLE PRECISION');
  sqlLines.push(');');
  sqlLines.push('');
  sqlLines.push('-- Insert city coordinates data');
  sqlLines.push('INSERT INTO temp_city_coords (city, state, lat, lng) VALUES');

  // Generate INSERT statements in batches (PostgreSQL has a limit on statement size)
  const batchSize = 1000;
  for (let i = 0; i < cities.length; i += batchSize) {
    const batch = cities.slice(i, i + batchSize);
    const values = batch.map(city => {
      const cityEscaped = escapeSQL(city.city);
      const stateEscaped = escapeSQL(city.state_id);
      return `('${cityEscaped}', '${stateEscaped}', ${city.lat}, ${city.lng})`;
    });
    
    sqlLines.push(values.join(',\n'));
    if (i + batchSize < cities.length) {
      sqlLines.push(',');
    }
  }

  sqlLines.push(';');
  sqlLines.push('');
  sqlLines.push('-- Update CityV5000 table with coordinates');
  sqlLines.push('UPDATE "CityV5000" c');
  sqlLines.push('SET');
  sqlLines.push('  "latitude" = t.lat,');
  sqlLines.push('  "longitude" = t.lng');
  sqlLines.push('FROM temp_city_coords t');
  sqlLines.push('WHERE');
  sqlLines.push('  LOWER(TRIM(c."city")) = LOWER(TRIM(t.city))');
  sqlLines.push('  AND UPPER(TRIM(c."state")) = UPPER(TRIM(t.state))');
  sqlLines.push('  AND c."countryCode" = \'US\'');
  sqlLines.push('  AND (c."latitude" IS NULL OR c."longitude" IS NULL);');
  sqlLines.push('');
  sqlLines.push('-- Clean up temporary table');
  sqlLines.push('DROP TABLE temp_city_coords;');
  sqlLines.push('');
  sqlLines.push('COMMIT;');
  sqlLines.push('');
  sqlLines.push(`-- Script will update cities that match by name and state`);

  return sqlLines.join('\n');
}

async function generateSQLFile() {
  console.log('🚀 Generating SQL script for city coordinates...\n');

  // Path to CSV file
  const csvPath = path.join(process.cwd(), 'scripts', 'data', 'uscities.csv');
  const sqlPath = path.join(process.cwd(), 'scripts', 'data', 'city-coordinates-updates.sql');

  // Parse CSV
  const cities = parseCSV(csvPath);

  // Generate SQL
  const sql = generateSQL(cities);

  // Write SQL file
  fs.writeFileSync(sqlPath, sql, 'utf-8');

  const fileSize = (fs.statSync(sqlPath).size / 1024 / 1024).toFixed(2);
  
  console.log(`✅ SQL script generated: ${sqlPath}`);
  console.log(`   File size: ${fileSize} MB`);
  console.log(`   Contains ${cities.length} cities\n`);
  console.log('📋 Next steps:');
  console.log('   1. Open Supabase SQL Editor');
  console.log('   2. Open the SQL file: scripts/data/city-coordinates-updates.sql');
  console.log('   3. Copy all contents and paste into Supabase');
  console.log('   4. Click "Run" to execute\n');
}

// Run the script
generateSQLFile().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
