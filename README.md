# Local Lead-Gen Opportunity Finder

An AI-powered tool that identifies profitable local lead-generation opportunities by analyzing search demand, competition difficulty, and payout potential across cities and ZIP codes.

## Overview

This tool helps you discover the best cities/ZIP codes for a given niche by:

- **Analyzing search demand** via SearchAtlas keyword volumes
- **Assessing competition difficulty** through SERP analysis (aggregators, local packs, EMDs, etc.)
- **Calculating profit potential** based on your payout spreadsheet
- **Ranking opportunities** using a composite score

The system outputs the top 3 opportunities per run, along with detailed metrics and recommended keywords.

## Architecture

This is a monorepo organized into:

- `apps/web/` - Next.js read-only dashboard for browsing results
- `packages/core/` - Scoring functions, keyword taxonomy, shared types
- `packages/crawler/` - Playwright scripts for SearchAtlas & Google SERPs
- `packages/db/` - Prisma schema, database client, migrations
- `packages/cli/` - Command-line interface (run, export, reweight)

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for local Postgres)
- SearchAtlas account credentials

> **Quick Start?** See [LAUNCH.md](./LAUNCH.md) for step-by-step launch instructions.

## Setup

### 1. Clone and Install

```bash
npm install
```

### 2. Start Database

```bash
docker-compose up -d
```

This starts a Postgres 16 container on port 5432.

### 3. Configure Environment

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/niche_hunter

# SearchAtlas Credentials
SEARCHATLAS_EMAIL=your_email@example.com
SEARCHATLAS_PASSWORD=your_password

# TTL Settings (days)
SEARCH_TTL_DAYS=30
SERP_TTL_DAYS=30

# Conversion Assumptions
CTR=0.05
SITE_CONV=0.03
LEAD_CONV=0.30

# Opportunity Score Weights
ALPHA=0.6
BETA=0.4

# AI Configuration (Optional - see AI_SETUP.md)
# AI_PROVIDER=openai
# AI_MODEL=gpt-5-nano
# AI_API_KEY=your_api_key_here
```

### 4. Initialize Database

```bash
cd packages/db
npm run db:migrate
npm run db:generate
```

### 5. Install Playwright Browsers

```bash
npx playwright install chromium
```

## Usage

### Importing Payout Spreadsheet

First, import your payout data from a CSV file. The importer supports multiple column name variations:

**Supported columns:**
- ZIP codes: `Zip Code`, `ZIP Code`, `zip`, `zip_code`
- Cities: `city`, `City`, `CITY`, `city_name`
- States: `state_id`, `State`, `STATE`, `state`
- Payouts: `CPL Buyer Payouts`, `Duration Buyer Pay`, `payout`, `Payout`, `CPL`

**Example CSV:**
```csv
Zip Code,CPL Buyer Payouts,city,state_id
55421,162.00,Minneapolis,MN
90001,166.95,Los Angeles,CA
```

**Import command:**
```bash
npm run db:seed -- packages/db/src/seed.ts <path-to-payouts.csv>
```

Or using tsx directly:
```bash
cd packages/db
npx tsx src/seed.ts ../path/to/payouts.csv
```

### Running an Analysis

**Simple usage:** Just provide your cities CSV, payout spreadsheet, and niche category:

```bash
# Single CSV with everything (recommended)
npx niche-hunter run --data ./my-data.csv

# Or with separate files
npx niche-hunter run --niche "roofing" --cities ./cities.csv --revenue ./payouts.csv
```

The `--limit` defaults to 100 (max), so if your CSV has 100 rows or less, you don't need to specify it.

**First-time setup?** Follow the steps in [LAUNCH.md](./LAUNCH.md)

**Basic command:**
```bash
npx niche-hunter run --niche "roofing" --cities ./cities.csv --payout 300 --revenue ./payouts.csv --limit 100
```

**Arguments:**
- `--niche` - Required. Niche name (must have a keyword taxonomy file in `packages/core/keywords/`)
- `--cities` - Required. Path to CSV/JSON file with locations (columns: city, state, zip)
- `--payout` - Base payout per lead (used if revenue file not provided)
- `--revenue` - Path to CSV with city/ZIP payouts (overrides --payout)
- `--limit` - Maximum locations to process (default: 100, max: 100)
- `--ctr`, `--siteconv`, `--leadconv` - Optional conversion rate overrides

**Example cities.csv:**
```csv
city,state,zip
Minneapolis,MN,55421
Los Angeles,CA,90001
```

The tool will:
1. Filter locations to those with payouts in your spreadsheet
2. Load keyword taxonomy for the niche
3. Fetch local search volumes from SearchAtlas (cached 30 days)
4. Crawl Google SERPs for top keywords
5. Compute demand, difficulty, opportunity, and profit scores
6. Output top 3 winners to console

### Exporting Results

Export full results to CSV or JSON:

```bash
npx niche-hunter export --run <runId> --out ./reports/roofing-batch1.csv
```

The export includes:
- All scanned locations with scores
- Top 3 opportunities summary (JSON only)

### Recalculating Scores

Recalculate opportunity scores with different weights (without re-crawling):

```bash
npx niche-hunter reweight --run <runId> --weights ./config/weights.json
```

Create a weights file:
```json
{
  "alpha": 0.7,
  "beta": 0.3
}
```

### Viewing Results in Dashboard

Start the Next.js dashboard:

```bash
npm run dev
```

Open http://localhost:3000 to:
- Browse all runs
- View detailed results per run
- Filter by state, difficulty, minimum opportunity
- See top 3 opportunities highlighted

## Keyword Taxonomy

Add niche-specific keywords in `packages/core/keywords/<niche>.json`:

```json
{
  "core": ["roofing company", "roofing contractor"],
  "transactional": ["roof repair", "roof replacement"],
  "emergency": ["emergency roof repair", "roof leak emergency"],
  "adjacency": ["hail roof damage", "roof inspection"]
}
```

Intent weights are defined in `config/weights.json`:
- `core`: 1.0
- `transactional`: 1.1
- `emergency`: 0.7
- `adjacency`: 0.6

## Scoring Methodology

### Demand Score
Weighted sum of log-transformed search volumes by intent bucket, normalized to [0,1].

### Difficulty Score
Combines SERP signals:
- Local pack presence (0.25)
- Aggregator count (0.25)
- Directory count (0.10)
- EMD count (-0.10, negative = easier)
- Title contains city (-0.10, negative = easier)
- Thin page ratio (0.20)

**Classifications:**
- `super easy`: difficulty ≤ 0.3
- `kind of easy`: 0.3 < difficulty ≤ 0.6
- `challenging`: difficulty > 0.6

### Opportunity Score
`α × demand + β × (1 - difficulty)`

Default: α=0.6, β=0.4

### Profit Estimate
```
profit = avgVolume × CTR × siteConv × leadConv × payout × keywordCount
```

Default conversions: CTR=5%, siteConv=3%, leadConv=30%

### Final Score
`opportunity × (1 + log1p(profitEst / 1000))` (capped at 2x)

## Configuration

### Aggregators

Edit `config/aggregators.json` to add/remove aggregator domains that affect difficulty scoring.

### Weights

Edit `config/weights.json` to adjust:
- Intent weights (demand calculation)
- Difficulty weights (SERP signal importance)
- Difficulty thresholds (classification boundaries)

## Data Persistence

All data is stored in Postgres:
- **Runs** - Analysis batches
- **Scans** - Individual location analyses with scores and raw SERP data
- **VolumeSample** - Cached search volumes (30-day TTL)
- **Payout** - Your payout spreadsheet data

Raw SERP HTML and signals are stored in JSON fields for recalibration.

## SearchAtlas Login (Google OAuth Required)

The first time you run an analysis, Playwright will:
1. Launch Chromium in visible mode (not headless)
2. Open SearchAtlas login page
3. **You must complete Google OAuth login manually** in the browser window
4. Once logged in, the session is saved in `.auth/searchatlas/`
5. Future runs will reuse the saved session automatically

**Important:** SearchAtlas uses Google OAuth, so you cannot auto-login with email/password. The first run requires manual login. After that, sessions persist until they expire.

To force re-login, delete the `.auth/searchatlas/` folder.

## Troubleshooting

**"No valid locations with payouts found"**
- Ensure your payout CSV has matching city/state or zip columns
- Check that column names match supported variations
- Verify payout values are numeric (remove $, commas)

**"Keyword taxonomy not found"**
- Create a JSON file in `packages/core/keywords/<niche>.json`
- Use the roofing.json as a template

**"SearchAtlas login failed"**
- Verify SEARCHATLAS_EMAIL and SEARCHATLAS_PASSWORD in .env
- Delete `.auth/searchatlas/` and try again
- Check that your account is active

**Database connection errors**
- Ensure Docker container is running: `docker-compose ps`
- Verify DATABASE_URL in .env matches docker-compose settings
- Run migrations: `npm run db:migrate`

## Migration to Supabase (Future)

To switch from local Postgres to Supabase:
1. Create a Supabase project
2. Copy the connection string to DATABASE_URL
3. Run: `npm run db:migrate` (Supabase uses standard Postgres)
4. No code changes needed (Prisma provider is already `postgresql`)

## License

Private use only.

## Support

For issues or questions, check the code comments or adjust weights/config files to tune results.
