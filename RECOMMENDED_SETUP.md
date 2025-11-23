# 🎯 Recommended Setup - Use Supabase!

## Why Supabase?

Based on your current setup, **Supabase is the easiest option**:
- ✅ No Docker issues
- ✅ No port conflicts  
- ✅ Free tier (plenty for this project)
- ✅ Takes 5 minutes
- ✅ Just works!

## Step-by-Step (5 Minutes)

### 1. Create Supabase Account
- Go to: **https://supabase.com**
- Click **"Start your project"**
- Sign up with GitHub/Email (free)

### 2. Create New Project
- Click **"New Project"**
- **Name:** `niche-hunter` (or anything)
- **Database Password:** Create a strong password (SAVE THIS!)
- **Region:** Choose closest to you
- Click **"Create new project"**
- **Wait 2 minutes** for setup

### 3. Get Connection String
- Go to **Settings** (gear icon) → **Database**
- Scroll to **"Connection string"** section
- Find **"URI"** tab
- Copy the connection string
- Looks like: `postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

### 4. Update .env File

Open `.env` in the project root and replace:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/niche_hunter
```

With your Supabase connection string.

### 5. Run Migrations

```bash
cd packages/db
npm run db:migrate
cd ../..
```

**You should see:** `✅ Migration applied successfully`

## 🚀 You're Ready!

Now run your first analysis:
```bash
npx niche-hunter run --data ./my-data.csv
```

**What happens:**
1. Browser opens → Sign in with Google for SearchAtlas
2. Analyzes locations
3. Shows top 3 opportunities

## That's It!

No Docker, no port issues, just works. Supabase handles everything!

