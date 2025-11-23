# 🚀 Deploy Now - Step by Step

## Quick Deploy to Vercel

Vercel CLI is installed. Here's how to deploy:

### Option 1: Manual Setup (Interactive)

Run this command and answer the prompts:

```bash
cd apps/web
vercel
```

**Answer the prompts:**
1. **Set up and deploy?** → Type `Y` (Yes)
2. **Which scope?** → Select your account (usually just press Enter)
3. **Link to existing project?** → Type `N` (No - first time)
4. **What's your project's name?** → Type `niche-hunter` (or press Enter)
5. **In which directory is your code located?** → Press Enter (it's already in apps/web)
6. **Want to override settings?** → Type `N` (No)

Then Vercel will build and deploy!

### Option 2: GitHub Deploy (Easiest - Recommended)

1. **Push your code to GitHub** (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/new
   - Click **"Import Git Repository"**
   - Select your GitHub repo

3. **Configure:**
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `apps/web`
   - **Build Command:** (leave default)
   - **Output Directory:** (leave default)

4. **Add Environment Variables:**
   - Click **"Environment Variables"**
   - Add each variable from your `.env` file:
     - `DATABASE_URL`
     - `SEARCHATLAS_EMAIL`
     - `SEARCHATLAS_PASSWORD`
     - `AI_PROVIDER`
     - `AI_MODEL`
     - `AI_API_KEY`
     - (and others from `.env`)

5. **Click "Deploy"**

### Option 3: One-Click Deploy Button

If your code is on GitHub:

1. Go to: https://vercel.com/new
2. Import your repository
3. Set **Root Directory:** `apps/web`
4. Add environment variables
5. Deploy!

---

## After First Deploy

1. **Get your URL:** Vercel will give you a URL like `https://niche-hunter.vercel.app`

2. **Test it:** Visit the URL and try uploading a CSV

3. **Monitor:** Check Vercel dashboard → Logs for any errors

---

## Environment Variables to Add

Copy these from your `.env` to Vercel dashboard:

- `DATABASE_URL=postgresql://postgres:Buildequity123!@db.fpwayqwhdendrgtottwj.supabase.co:5432/postgres`
- `SEARCHATLAS_EMAIL=your_email`
- `SEARCHATLAS_PASSWORD=your_password`
- `SEARCH_TTL_DAYS=30`
- `SERP_TTL_DAYS=30`
- `CTR=0.05`
- `SITE_CONV=0.03`
- `LEAD_CONV=0.30`
- `ALPHA=0.6`
- `BETA=0.4`
- `AI_PROVIDER=openai`
- `AI_MODEL=gpt-5-nano`
- `AI_API_KEY=your_key`

---

## Which Method Should You Use?

- **GitHub Deploy (Option 2)** - Easiest, most reliable ⭐
- **Vercel CLI (Option 1)** - Good if you want command-line control
- **One-Click Button** - Fastest if code is already on GitHub

**I recommend Option 2 (GitHub Deploy)** - it's the most straightforward!

