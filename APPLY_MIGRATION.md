# Apply Database Migration

The migration file has been created. To apply it, you have two options:

## Option 1: Using Prisma Migrate (Recommended)

When your database is running and DATABASE_URL is set:

```bash
cd packages/db
npx prisma migrate deploy
```

Or if you want to create a new migration (it will detect the schema changes):

```bash
cd packages/db
npx prisma migrate dev --name add_scan_enhancements
```

## Option 2: Manual SQL (If Prisma Migrate doesn't work)

Connect to your PostgreSQL database and run:

```sql
ALTER TABLE "Scan" 
ADD COLUMN "competitorJson" JSONB,
ADD COLUMN "relatedKeywords" TEXT,
ADD COLUMN "timeToRank" TEXT,
ADD COLUMN "competitionStrength" DOUBLE PRECISION;
```

## After Migration

After applying the migration, regenerate the Prisma client:

```bash
cd packages/db
npx prisma generate
```

## Migration File Location

The migration SQL file is located at:
`packages/db/prisma/migrations/20251106123058_add_scan_enhancements/migration.sql`

## What This Migration Adds

- `competitorJson` - Stores competitor breakdown data (aggregators, directories, etc.)
- `relatedKeywords` - Comma-separated list of related keywords discovered from SERP
- `timeToRank` - Estimated time to rank (e.g., "2-4 months")
- `competitionStrength` - Competition strength score (0-10 scale)

All fields are optional (nullable), so existing scans will continue to work.






