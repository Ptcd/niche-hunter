# 🚀 START HERE - Get Running in 5 Minutes

## Quick Setup (5 Steps)

### 1️⃣ Install & Start Database
```bash
npm install
docker-compose up -d
```

### 2️⃣ Setup Database Schema
```bash
cd packages/db && npm run db:migrate && npm run db:generate && cd ../..
```

### 3️⃣ Configure .env
Create `.env` file:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/niche_hunter
SEARCHATLAS_EMAIL=your_email@example.com
SEARCHATLAS_PASSWORD=your_password
AI_PROVIDER=openai
AI_MODEL=gpt-5-nano
AI_API_KEY=your_key_here
```

### 4️⃣ Install Playwright
```bash
npx playwright install chromium
```

### 5️⃣ Run Your First Analysis

**Create a CSV** (`my-data.csv`):
```csv
city,state,zip,payout,niche
Minneapolis,MN,55421,162.00,roofing
Los Angeles,CA,90001,166.95,roofing
```

**Run it:**
```bash
npx niche-hunter run --data ./my-data.csv
```

## What Happens?

1. ✅ Browser opens for SearchAtlas login (first time only)
2. ✅ Analyzes each location
3. ✅ Shows top 3 opportunities
4. ✅ Saves results to database

## Need Help?

- **Detailed setup**: See [LAUNCH.md](./LAUNCH.md)
- **AI configuration**: See [AI_SETUP.md](./AI_SETUP.md)
- **Usage examples**: See [QUICK_START.md](./QUICK_START.md)

## Commands Cheat Sheet

```bash
# Run analysis
npx niche-hunter run --data ./my-data.csv

# Export results
npx niche-hunter export --run <runId> --out ./results.csv

# Generate keywords with AI
npx niche-hunter generate-keywords --niche "your-niche"

# View dashboard
npm run dev
# Then open http://localhost:3000
```

That's it! 🎉

