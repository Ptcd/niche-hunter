# ✅ Quick Chrome Setup - Use Your Existing Browser

## Two-Step Setup

### Step 1: Start Chrome with Debugging

**Option A: Double-click `start-chrome-debug.bat`** (I just created this for you!)

**Option B: Manual command**
```powershell
Start-Process "chrome.exe" -ArgumentList "--remote-debugging-port=9222"
```

### Step 2: Add to .env

Open your `.env` file and add this line:
```env
CHROME_REMOTE_DEBUG_PORT=9222
```

## That's It!

Now:
1. ✅ Chrome is running with remote debugging
2. ✅ You're logged into Google in Chrome
3. ✅ `.env` has the port configured
4. ✅ Run your analysis - it will use your existing Chrome!

## When Running Analysis

- **Keep Chrome open** while the analysis runs
- It will connect to your Chrome and open new tabs
- Uses your existing Google login - no warnings!
- Works seamlessly with your real browser

---

**Ready to go!** Just double-click `start-chrome-debug.bat` and add the line to `.env` 🚀

