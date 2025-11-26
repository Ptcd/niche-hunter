# City Coordinates Data

## Download Instructions

1. Go to: https://simplemaps.com/data/us-cities
2. Click the **"Download"** button for the **"Basic"** version (free)
3. Save the CSV file as: `uscities.csv` in this directory (`scripts/data/uscities.csv`)

The Basic version includes:
- 31,254 US cities
- Latitude and longitude coordinates
- City name and state abbreviation
- Free for commercial use (requires attribution)

## Running the Import

After downloading the CSV file, run:

```bash
npx tsx scripts/import-city-coordinates-from-csv.ts
```

This will:
- Read the CSV file
- Match cities in your database by city name and state
- Update latitude/longitude coordinates for all matching cities


