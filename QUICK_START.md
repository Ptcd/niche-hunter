# Quick Start Guide

## How to Run an Analysis

You have two options:

### Option 1: Single CSV (Easiest) ✨

Create **one CSV file** with cities, ZIPs, payouts, and niche:

```csv
city,state,zip,payout,niche
Minneapolis,MN,55421,162.00,roofing
Los Angeles,CA,90001,166.95,roofing
```

Then run:
```bash
npx niche-hunter run --data ./my-data.csv
```

The niche can come from:
- The `niche` column in your CSV (most common value is used), OR
- The `--niche` flag if you prefer to type it

**Example:**
```bash
# Uses niche from CSV column
npx niche-hunter run --data ./my-data.csv

# Overrides niche from CSV
npx niche-hunter run --data ./my-data.csv --niche "junk-car-removal"
```

### Option 2: Separate Files (Original Method)

1. **Create a CSV file with up to 100 cities/ZIPs** (see `examples/cities.csv`)
2. **Provide your payout spreadsheet** (see `examples/payouts-example.csv`)
3. **Run the command with your niche category**

### Step 1: Prepare Your Cities CSV

Create a file like `my-cities.csv`:

```csv
city,state,zip
Minneapolis,MN,55421
Los Angeles,CA,90001
Chicago,IL,60601
```

**Supported columns:**
- `city` or `City` - City name
- `state` or `State` or `state_id` - State abbreviation (e.g., CA, NY, TX)
- `zip` or `Zip` or `Zip Code` or `ZIP Code` - ZIP code (optional but recommended)

You can have up to 100 rows. The `--limit 100` flag (default) will process all of them.

### Step 2: Prepare Your Payout Spreadsheet

Your payout CSV should have these columns (supports multiple variations):

```csv
Zip Code,CPL Buyer Payouts,city,state_id
55421,162.00,Minneapolis,MN
90001,166.95,Los Angeles,CA
```

**Supported payout columns:**
- `CPL Buyer Payouts` or `Duration Buyer Pay` or `payout` or `Payout` or `CPL`
- `city` or `City` - City name
- `state_id` or `State` - State abbreviation
- `Zip Code` or `ZIP Code` or `zip` - ZIP code (optional)

### Step 3: Run the Analysis

**With single CSV:**
```bash
npx niche-hunter run --data ./my-data.csv
```

**Or with separate files:**
```bash
npx niche-hunter run --niche "roofing" --cities ./my-cities.csv --revenue ./my-payouts.csv
```

That's it! The tool will:
- Load your cities (up to 100)
- Match them with payouts from your spreadsheet
- Skip cities without payouts
- Analyze search demand and competition
- Show you the top 3 opportunities

### First-Time SearchAtlas Login

On first run, a browser window will open for **Google OAuth login**:
1. Complete the Google sign-in in the browser window
2. The session will be saved automatically
3. Future runs won't require login

If the browser doesn't open, delete the `.auth/searchatlas/` folder and run again.

### Examples

**Single CSV with niche column (recommended):**
```bash
npx niche-hunter run --data ./complete-data.csv
```

**Single CSV but override niche:**
```bash
npx niche-hunter run --data ./complete-data.csv --niche "water-damage"
```

**Separate files (original method):**
```bash
npx niche-hunter run --niche "roofing" --cities ./cities.csv --revenue ./payouts.csv
```

**Analyze junk car removal (if you have that keyword file):**
```bash
npx niche-hunter run --niche "junk-car-removal" --cities ./cities.csv --revenue ./payouts.csv
```

**Use a base payout instead of spreadsheet:**
```bash
npx niche-hunter run --niche "roofing" --cities ./cities.csv --payout 300
```

**Limit to first 50 cities:**
```bash
npx niche-hunter run --niche "roofing" --cities ./cities.csv --revenue ./payouts.csv --limit 50
```

### Output

The tool prints the **top 3 opportunities** to the console with:
- City, State, ZIP
- Opportunity Score (0-1)
- Demand Score
- Difficulty Score & Classification
- Estimated Monthly Profit
- Top Keywords

Full results are saved in the database and can be exported:
```bash
npx niche-hunter export --run <runId> --out ./results.csv
```

### Adding New Niches

Create a keyword file at `packages/core/keywords/<niche>.json`:

```json
{
  "core": ["your niche company", "your niche contractor"],
  "transactional": ["your niche service", "your niche repair"],
  "emergency": ["emergency your niche"],
  "adjacency": ["related service"]
}
```

Then use that niche name in the `--niche` flag.
