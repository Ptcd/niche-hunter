# Database Setup Instructions

## Current Status

❌ Docker is not installed, so the automated database setup can't run.

## Option 1: Install Docker (Recommended)

### Windows:
1. Download Docker Desktop: https://www.docker.com/products/docker-desktop
2. Install and restart your computer
3. Start Docker Desktop
4. Run: `docker-compose up -d`

### Then run migrations:
```bash
cd packages/db
npm run db:migrate
cd ../..
```

## Option 2: Use Existing PostgreSQL

If you already have PostgreSQL installed:

1. **Create the database:**
   ```sql
   CREATE DATABASE niche_hunter;
   ```

2. **Update `.env` file:**
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/niche_hunter
   ```
   Replace `username` and `password` with your PostgreSQL credentials.

3. **Run migrations:**
   ```bash
   cd packages/db
   npm run db:migrate
   cd ../..
   ```

## Option 3: Use Supabase (Cloud Database)

1. Go to https://supabase.com and create a free account
2. Create a new project
3. Copy the connection string from Settings → Database
4. Update `.env`:
   ```
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres
   ```
5. Run migrations:
   ```bash
   cd packages/db
   npm run db:migrate
   cd ../..
   ```

## Quick Check

Once database is set up, verify connection:
```bash
cd packages/db
npx prisma studio
```
This opens a browser at http://localhost:5555 where you can view tables.

## Next Steps After Database Setup

1. ✅ Database running
2. ✅ Migrations completed
3. ⏳ Update `.env` with SearchAtlas credentials
4. ⏳ Run: `npx niche-hunter run --data ./my-data.csv`


