# Quick Launch Guide

Follow these steps to get the program running.

## Step 1: Install Dependencies

```bash
npm install
```

This installs all packages and dependencies for the monorepo.

## Step 2: Start Database

Start the PostgreSQL database using Docker:

```bash
docker-compose up -d
```

Verify it's running:
```bash
docker-compose ps
```

You should see the `niche_hunter_db` container running.

## Step 3: Setup Database Schema

```bash
cd packages/db
npm run db:migrate
npm run db:generate
cd ../..
```

This creates the database tables and generates the Prisma client.

## Step 4: Configure Environment

Create a `.env` file in the root directory (or copy from `.env.example`):

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

# AI Configuration (Optional)
AI_PROVIDER=openai
AI_MODEL=gpt-5-nano
AI_API_KEY=your_api_key_here
```

## Step 5: Install Playwright Browsers

```bash
npx playwright install chromium
```

## Step 6: Prepare Your Data

Create a CSV file with your cities/ZIPs and payouts:

**Option A: Single CSV (Recommended)**
```csv
city,state,zip,payout,niche
Minneapolis,MN,55421,162.00,roofing
Los Angeles,CA,90001,166.95,roofing
```

Save as `my-data.csv`

**Option B: Separate Files**
- Create `cities.csv` with city, state, zip columns
- Create `payouts.csv` with your payout data

## Step 7: Import Payouts (If Using Separate Files)

If you're using Option B:
```bash
cd packages/db
npx tsx src/seed.ts ../path/to/your-payouts.csv
cd ../..
```

## Step 8: Run Analysis

**With single CSV:**
```bash
npx niche-hunter run --data ./my-data.csv
```

**With separate files:**
```bash
npx niche-hunter run --niche "roofing" --cities ./cities.csv --revenue ./payouts.csv
```

## First Run: SearchAtlas Login

On the first run, a browser window will open:
1. Complete Google OAuth login manually
2. Session will be saved automatically
3. Future runs won't require login

## View Results

The CLI will show the top 3 opportunities. For full results:

```bash
npx niche-hunter export --run <runId> --out ./results.csv
```

## View Dashboard (Optional)

Start the web dashboard:
```bash
npm run dev
```

Then open http://localhost:3000

## Quick Test

Test with example data:
```bash
npx niche-hunter run --data ./examples/complete-data-example.csv
```

## Troubleshooting

**Database connection error:**
- Check Docker is running: `docker-compose ps`
- Restart database: `docker-compose restart`

**SearchAtlas login issues:**
- Delete `.auth/searchatlas/` folder and try again
- Ensure `SEARCHATLAS_EMAIL` and `SEARCHATLAS_PASSWORD` are set

**Missing keyword taxonomy:**
- Generate one: `npx niche-hunter generate-keywords --niche "your-niche"`
- Or create manually: `packages/core/keywords/your-niche.json`

**"Command not found":**
- Build packages: `npm run build`
- Or install globally: `npm install -g` (from packages/cli)

