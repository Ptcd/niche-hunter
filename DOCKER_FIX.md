# Docker Desktop Not Running - Quick Fix

## The Problem

Docker is installed but Docker Desktop isn't running.

## Quick Fix (3 Steps)

### Step 1: Start Docker Desktop

1. **Open Docker Desktop** (search for "Docker Desktop" in Start menu)
2. **Wait for it to fully start** - Look for the Docker whale icon in your system tray (bottom right)
3. **Make sure it says "Docker Desktop is running"** (not "Starting...")

### Step 2: Verify Docker is Running

Open PowerShell and test:
```bash
docker ps
```

If you see containers (or an empty list), Docker is working!
If you get an error, Docker Desktop isn't fully started yet - wait a bit more.

### Step 3: Start the Database

**Option A: Use the helper script**
```bash
# Double-click this file or run:
start-database.bat
```

**Option B: Run manually**
```bash
# Start database
docker compose up -d

# Wait a few seconds, then run migrations
cd packages/db
npm run db:migrate
cd ../..
```

## Common Issues

### "Docker Desktop is not running"
- Solution: Open Docker Desktop and wait for it to start

### "Connection refused" or "Cannot connect to Docker"
- Solution: Restart Docker Desktop

### "Port 5432 already in use"
- Solution: Something else is using port 5432. Either:
  - Stop that service, OR
  - Change port in `docker-compose.yml` (line 12)

## Alternative: Use Supabase (No Docker!)

If Docker keeps causing issues, use Supabase cloud database instead:

1. Go to https://supabase.com
2. Create free account → New project
3. Copy connection string
4. Update `.env` `DATABASE_URL`
5. Run migrations: `cd packages/db && npm run db:migrate`

**No Docker needed!** See `START_DATABASE.md` for details.

## Verify It's Working

After starting database, test it:
```bash
cd packages/db
npm run db:migrate
```

If successful, you'll see: `✅ Migration applied successfully`

