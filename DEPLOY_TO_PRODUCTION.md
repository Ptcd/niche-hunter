# 🌐 Deploy to Production - Make it a Web App

You're right - let's deploy this so you can access it from anywhere, not just localhost!

## Best Option: Vercel (Recommended) ⭐

Vercel is perfect for Next.js apps and makes your dashboard accessible online.

### Method 1: Deploy via GitHub (Easiest!)

#### Step 1: Push Code to GitHub

If you haven't already, push your code:

```bash
# In your project root
git init
git add .
git commit -m "Initial commit - Niche Hunter"

# Create a repo on GitHub.com, then:
git remote add origin https://github.com/YOUR_USERNAME/niche-hunter.git
git push -u origin main
```

#### Step 2: Deploy on Vercel

1. **Go to:** https://vercel.com/new
2. **Sign in** with GitHub
3. **Import your repository**
4. **Configure:**
   - **Framework:** Next.js (auto-detected)
   - **Root Directory:** `apps/web` ← IMPORTANT!
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** `.next`

#### Step 3: Add Environment Variables

In Vercel dashboard → Your Project → Settings → Environment Variables:

Add ALL these (copy from your `.env`):
```
DATABASE_URL=postgresql://postgres:Buildequity123!@db.fpwayqwhdendrgtottwj.supabase.co:5432/postgres
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

#### Step 4: Deploy!

Click **"Deploy"** - Vercel will:
- Build your app
- Deploy it
- Give you a URL like: `https://niche-hunter.vercel.app`

**That's it!** Your dashboard is now live on the internet! 🎉

---

### Method 2: Railway (Alternative)

1. Go to https://railway.app
2. Sign up with GitHub
3. **New Project** → **Deploy from GitHub repo**
4. Select your repo
5. Set **Root Directory:** `apps/web`
6. Add environment variables
7. Deploy!

---

### Method 3: Render (Alternative)

1. Go to https://render.com
2. **New** → **Web Service**
3. Connect GitHub repo
4. **Root Directory:** `apps/web`
5. Add environment variables
6. Deploy!

---

## What Happens After Deployment

✅ **Your dashboard is online** - accessible from any device  
✅ **Auto-updates** - When you push to GitHub, Vercel redeploys automatically  
✅ **HTTPS included** - Secure connection  
✅ **Free tier** - Vercel free tier is generous for this app  

---

## Access Your Deployed App

After deployment, you'll get a URL like:
- `https://niche-hunter.vercel.app` (Vercel)
- `https://niche-hunter.railway.app` (Railway)
- `https://niche-hunter.onrender.com` (Render)

**You can access it from:**
- Your computer
- Your phone
- Anywhere with internet
- Share with team members

---

## Recommended: Vercel via GitHub

**Why Vercel:**
- ✅ Built for Next.js (made by Next.js creators)
- ✅ Automatic deployments on git push
- ✅ Free tier is very generous
- ✅ Easy environment variable management
- ✅ Built-in analytics

**Steps:**
1. Push code to GitHub
2. Import to Vercel
3. Set root directory: `apps/web`
4. Add environment variables
5. Deploy!

**Your dashboard will be live in ~5 minutes!**

