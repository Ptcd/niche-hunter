# 🚀 Deployment Guide

## Quick Deploy Options

### Option 1: Vercel (Recommended for Next.js) ⭐

Vercel is the easiest way to deploy Next.js apps.

#### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

#### Step 2: Deploy
```bash
cd apps/web
vercel
```

Follow the prompts:
- Link to existing project? **No** (first time)
- Set up and deploy? **Yes**
- Which scope? (Choose your account)
- Link to existing project? **No**
- What's your project's name? **niche-hunter**
- In which directory is your code located? **./apps/web**
- Override settings? **No**

#### Step 3: Add Environment Variables

After deployment, go to Vercel dashboard:
1. Open your project
2. Go to **Settings** → **Environment Variables**
3. Add all variables from `.env.production.example`

**Important variables to set:**
- `DATABASE_URL` - Your Supabase connection string
- `SEARCHATLAS_EMAIL` - Optional
- `SEARCHATLAS_PASSWORD` - Optional
- `AI_API_KEY` - Optional

#### Step 4: Redeploy

Vercel will automatically redeploy when you push to GitHub, or redeploy manually:
```bash
vercel --prod
```

---

### Option 2: Railway (Full Stack)

Railway can deploy Next.js and has good database support.

#### Step 1: Connect GitHub
1. Go to https://railway.app
2. Sign up with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**

#### Step 2: Configure Project
1. Select your repository
2. Set **Root Directory** to: `apps/web`
3. Add environment variables (same as Vercel)
4. Railway will auto-deploy

---

### Option 3: Render

#### Step 1: Create Web Service
1. Go to https://render.com
2. Click **"New"** → **"Web Service"**
3. Connect your GitHub repo

#### Step 2: Configure
- **Name:** niche-hunter
- **Root Directory:** apps/web
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Environment:** Node

#### Step 3: Add Environment Variables
Add all from `.env.production.example`

---

## Environment Variables Needed

Copy these to your deployment platform:

```env
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
SEARCHATLAS_EMAIL=your_email@example.com
SEARCHATLAS_PASSWORD=your_password
SEARCH_TTL_DAYS=30
SERP_TTL_DAYS=30
CTR=0.05
SITE_CONV=0.03
LEAD_CONV=0.30
ALPHA=0.6
BETA=0.4
AI_PROVIDER=openai
AI_MODEL=gpt-5-nano
AI_API_KEY=your_api_key_here
```

---

## Pre-Deployment Checklist

- ✅ Database setup (Supabase) - Already done!
- ✅ Migrations run - Already done!
- ✅ Environment variables ready
- ⏳ Code ready to deploy

---

## Post-Deployment

After deploying:

1. **Test the dashboard:** Visit your deployment URL
2. **Upload a CSV:** Test the upload functionality
3. **Check database:** Verify data is being saved to Supabase
4. **Monitor logs:** Watch for any errors in deployment logs

---

## One-Click Deploy

### Deploy to Vercel Now:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Click the button above
2. Connect your GitHub repo
3. Set **Root Directory** to `apps/web`
4. Add environment variables
5. Deploy!

---

## Need Help?

- **Vercel docs:** https://vercel.com/docs
- **Railway docs:** https://docs.railway.app
- **Render docs:** https://render.com/docs

