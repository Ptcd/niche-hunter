# 🎯 Do This Now - Supabase Setup

## What You Need to Do:

### 1️⃣ Get Connection String from Supabase

**Go to Supabase:**
- Website: https://app.supabase.com
- Click your project
- Click **Settings (⚙️)** → **Database**
- Scroll to **"Connection string"**
- Click **"URI"** tab
- **Copy the connection string**

**It looks like:**
```
postgresql://postgres.abcdefghijklmnop:YOUR_PASSWORD_HERE@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

⚠️ **Important:** If you see `[YOUR-PASSWORD]` or `[password]`, replace it with the actual password you set when creating the Supabase project!

---

### 2️⃣ Update .env File

**Easiest way - Use the helper script:**

```powershell
cd "C:/Users/User/OneDrive/Desktop/AI Agent"
.\update-env.ps1
```

Then paste your connection string when it asks!

**OR manually edit .env:**
1. Open `.env` file in: `C:/Users/User/OneDrive/Desktop/AI Agent`
2. Find: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/niche_hunter`
3. Replace with your Supabase connection string
4. Save

---

### 3️⃣ Run Migrations

Once .env is updated:

```bash
cd packages/db
npm run db:migrate
cd ../..
```

**You should see:** `✅ Migration applied successfully`

---

## 🚀 Then Run Your First Analysis!

```bash
npx niche-hunter run --data ./my-data.csv
```

---

## Quick Reference

**Files I created to help you:**
- `QUICK_SUPABASE_SETUP.md` - Quick 3-step guide
- `SUPABASE_CONNECTION_GUIDE.md` - Detailed where-to-find instructions
- `update-env.ps1` - Helper script to update .env easily

**Need help?** Just tell me:
- "I got the connection string" → I'll help update .env
- "I can't find it" → I'll give more detailed instructions
- "I updated it" → I'll help run the migrations

