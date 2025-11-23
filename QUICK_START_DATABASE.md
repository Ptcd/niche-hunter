# Quick Start Database - 2 Options

## Option 1: Docker (If Docker Desktop is Running)

### Just run this:
```bash
start-database.bat
```

Or manually:
```bash
docker compose up -d
cd packages/db
npm run db:migrate
cd ../..
```

**If Docker Desktop isn't running:**
- Open Docker Desktop from Start menu
- Wait for it to start (check system tray icon)
- Then run the commands above

---

## Option 2: Supabase (Easiest - No Docker!)

If Docker is giving you trouble, use Supabase instead:

### 1. Create Account (2 minutes)
- Go to https://supabase.com
- Sign up (free)
- Click "New Project"
- Name: "niche-hunter"
- Password: (save this!)
- Region: Choose closest
- Wait 2 minutes

### 2. Get Connection String
- Go to Settings → Database
- Find "Connection string" → "URI"
- Copy it (looks like: `postgresql://postgres.xxxxx:password@...`)

### 3. Update .env
Edit `.env` file, replace this line:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/niche_hunter
```
With your Supabase connection string.

### 4. Run Migrations
```bash
cd packages/db
npm run db:migrate
cd ../..
```

**Done!** No Docker needed.

---

## Which Should You Use?

- **Docker**: If Docker Desktop is already running
- **Supabase**: If Docker is having issues or you want cloud database

Both work the same - choose whichever is easier!

