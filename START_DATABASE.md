# How to Start Your Database

## Quick Answer

If you have Docker installed, just run:
```bash
docker-compose up -d
```

If you don't have Docker, see options below.

---

## Option 1: Docker (Easiest - Recommended)

### Check if Docker is installed:
```bash
docker --version
```

### If Docker is installed:
```bash
# Start the database
docker-compose up -d

# Verify it's running
docker-compose ps

# Then run migrations
cd packages/db
npm run db:migrate
cd ../..
```

### If Docker is NOT installed:

**Windows:**
1. Download Docker Desktop: https://www.docker.com/products/docker-desktop
2. Install it
3. Restart your computer
4. Start Docker Desktop (wait for it to fully start - icon in system tray)
5. Run: `docker-compose up -d`

**Mac:**
1. Download Docker Desktop: https://www.docker.com/products/docker-desktop
2. Install it
3. Start Docker Desktop
4. Run: `docker-compose up -d`

---

## Option 2: Supabase (Cloud - No Docker Needed!)

This is the **easiest option if you don't want to install Docker**.

### Steps:
1. Go to https://supabase.com
2. Sign up (free account)
3. Click "New Project"
4. Name it "niche-hunter" (or anything)
5. Wait 2 minutes for setup
6. Go to Settings → Database
7. Copy the "Connection string" (URI format)
8. It looks like: `postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

### Update .env:
Edit `.env` file and replace `DATABASE_URL`:
```
DATABASE_URL=postgresql://postgres.xxxxx:yourpassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### Then run migrations:
```bash
cd packages/db
npm run db:migrate
cd ../..
```

**Done!** No Docker needed.

---

## Option 3: Existing PostgreSQL

If you already have PostgreSQL installed on your computer:

### 1. Create the database:
Open PostgreSQL (psql or pgAdmin) and run:
```sql
CREATE DATABASE niche_hunter;
```

### 2. Update .env:
Edit `.env` and update `DATABASE_URL`:
```
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/niche_hunter
```

Replace:
- `your_username` - Your PostgreSQL username (usually `postgres`)
- `your_password` - Your PostgreSQL password

### 3. Run migrations:
```bash
cd packages/db
npm run db:migrate
cd ../..
```

---

## Which Should You Choose?

| Option | Difficulty | Best For |
|--------|-----------|---------|
| **Docker** | Medium | Already have Docker or don't mind installing |
| **Supabase** | ⭐ Easiest | Want cloud database, no installation |
| **PostgreSQL** | Harder | Already have PostgreSQL installed |

**Recommendation:** Use **Supabase** if you want the easiest setup with no installation!

---

## Verify Database is Running

After starting, verify it works:

```bash
cd packages/db
npm run db:migrate
```

If successful, you'll see:
```
✅ Migration applied successfully
```

---

## Need Help?

- **Docker issues:** Make sure Docker Desktop is running (check system tray icon)
- **Supabase issues:** Make sure connection string includes the password
- **PostgreSQL issues:** Make sure PostgreSQL service is running

