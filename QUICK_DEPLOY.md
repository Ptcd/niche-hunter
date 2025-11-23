# ⚡ Quick Deploy - 3 Steps

## Deploy to Vercel (Easiest)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy
```bash
cd apps/web
vercel --prod
```

**Or use the helper script:**
- Windows: Double-click `deploy-vercel.bat`
- Mac/Linux: Run `bash deploy-vercel.sh`

### Step 3: Add Environment Variables

After first deploy:
1. Go to https://vercel.com/dashboard
2. Select your project
3. **Settings** → **Environment Variables**
4. Add all variables from `.env.production.example`

**Critical variables:**
- `DATABASE_URL` - Your Supabase connection string
- `SEARCHATLAS_EMAIL` - Your email
- `SEARCHATLAS_PASSWORD` - Your password
- `AI_API_KEY` - Your OpenAI API key (optional)

### Done!

Your dashboard will be live at: `https://your-project.vercel.app`

---

## Alternative: Deploy Button (One-Click)

1. Push your code to GitHub
2. Go to: https://vercel.com/new
3. Import your repository
4. Set **Root Directory** to: `apps/web`
5. Add environment variables
6. Deploy!

---

## After Deployment

1. **Test upload:** Visit your site and upload a CSV
2. **Check logs:** Vercel dashboard → Logs tab
3. **Verify database:** Check Supabase to see data being saved

---

## Need More Options?

See `DEPLOY.md` for:
- Railway deployment
- Render deployment
- Detailed instructions

**That's it!** Your dashboard will be live in minutes! 🚀

