# How to Start Database - Solutions

## Problem Detected

Docker Desktop has an API version issue, OR there's already PostgreSQL running on port 5432.

## Solution Options

### Option 1: Restart Docker Desktop (If Using Docker)

1. **Right-click Docker Desktop icon** in system tray (bottom right)
2. **Click "Quit Docker Desktop"**
3. **Wait 10 seconds**
4. **Start Docker Desktop again** (from Start menu)
5. **Wait for it to fully start** (whale icon in system tray)
6. **Then run:**
   ```bash
   docker compose up -d
   cd packages/db
   npm run db:migrate
   cd ../..
   ```

### Option 2: Use Supabase (Easiest - Recommended!)

**No Docker needed!** This is the easiest option:

1. **Go to https://supabase.com**
2. **Sign up** (free account - takes 2 minutes)
3. **Click "New Project"**
4. **Name it "niche-hunter"**
5. **Choose a password** (SAVE THIS - you'll need it!)
6. **Select region** (closest to you)
7. **Click "Create new project"** - wait 2 minutes
8. **Go to Settings → Database**
9. **Scroll to "Connection string"**
10. **Copy the URI** (starts with `postgresql://postgres.xxxxx:...`)

11. **Update `.env` file** - replace this line:
    ```
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/niche_hunter
    ```
    With your Supabase connection string.

12. **Run migrations:**
    ```bash
    cd packages/db
    npm run db:migrate
    cd ../..
    ```

**Done!** No Docker, no port conflicts, just works.

### Option 3: Use Existing PostgreSQL

If you already have PostgreSQL running:

1. **Update `.env`** with your PostgreSQL credentials:
   ```
   DATABASE_URL=postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/niche_hunter
   ```

2. **Create the database:**
   ```sql
   CREATE DATABASE niche_hunter;
   ```
   (Run this in pgAdmin, psql, or any PostgreSQL client)

3. **Run migrations:**
   ```bash
   cd packages/db
   npm run db:migrate
   cd ../..
   ```

## Recommended: Use Supabase

**Why Supabase?**
- ✅ No Docker needed
- ✅ Free tier
- ✅ No port conflicts
- ✅ Works immediately
- ✅ Cloud database (accessible anywhere)

**Takes 5 minutes to set up and you're done!**

## Quick Check

After setting up, verify it works:
```bash
cd packages/db
npm run db:migrate
```

If you see `✅ Migration applied successfully` - you're ready!

## Next Step After Database

Once database is running and migrations are done:

```bash
npx niche-hunter run --data ./my-data.csv
```

**The browser will open automatically for SearchAtlas Google OAuth login on first run!**

