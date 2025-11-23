# ⚡ Quick Supabase Setup - 3 Steps

## Step 1: Get Connection String from Supabase

1. **Go to**: https://app.supabase.com
2. **Click your project** → **Settings (⚙️)** → **Database**
3. **Scroll to "Connection string"** → **URI tab**
4. **Copy the string** (click Copy button or Ctrl+C)

It looks like:
```
postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

⚠️ **Replace `[YOUR-PASSWORD]` or `[password]` with your actual Supabase project password!**

---

## Step 2: Update .env File

### Option A: Use the Helper Script (Easiest!)

Just run:
```powershell
.\update-env.ps1
```

Then paste your connection string when prompted!

### Option B: Manual Update

1. Open `.env` file in the project root
2. Find this line:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/niche_hunter
   ```
3. Replace it with your Supabase connection string
4. Save the file

---

## Step 3: Run Migrations

```bash
cd packages/db
npm run db:migrate
cd ../..
```

**Success looks like:**
```
✅ Migration applied successfully
```

---

## 🚀 You're Done!

Now you can run:
```bash
npx niche-hunter run --data ./my-data.csv
```

---

## Need Help?

**Can't find connection string?**
- See `SUPABASE_CONNECTION_GUIDE.md` for detailed visual instructions

**Connection string has issues?**
- Make sure password doesn't have special characters that need encoding
- Remove any spaces before/after the string
- Make sure it starts with `postgresql://`

