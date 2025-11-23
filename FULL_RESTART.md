# 🔄 FULL RESTART INSTRUCTIONS

## The Problem
The server has been running for 2+ hours and is using cached/old code. Even though the source code says "45 seconds", the running server still has "15 seconds".

## ✅ Complete Restart Steps:

### 1. Stop Everything
```powershell
# Stop all Node processes
Get-Process node | Stop-Process -Force

# Close Chrome
.\close-chrome.ps1
```

### 2. Rebuild Packages (Important!)
```powershell
# Rebuild crawler package
cd packages/crawler
npm run build
cd ../..
```

### 3. Restart Server
```powershell
cd apps/web
npm run dev
```

### 4. Wait for Ready
Look for:
```
✓ Ready on http://localhost:3000
```

### 5. Start New Analysis
- Go to Firefox: `localhost:3000`
- Click "+ New Analysis"
- Upload CSV
- Start!

---

## Why This Happened

In a monorepo, Next.js compiles packages once. If you change code in `packages/crawler`, Next.js won't automatically recompile it. You need to:
1. **Rebuild the package** (`npm run build` in the package)
2. **Restart Next.js** so it picks up the rebuilt package

---

## Quick Script

I can create a script that does all of this automatically. Would you like that?

