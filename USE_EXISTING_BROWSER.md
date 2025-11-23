# 🌐 Using Your Existing Browser

## Connect to Your Open Chrome Browser

Instead of opening a new browser, you can connect to your existing Chrome window! This means:
- ✅ Uses your existing Google login
- ✅ No "automated test software" warning
- ✅ Uses your actual browser profile
- ✅ Faster and more reliable

## Setup (One Time)

### Step 1: Close Chrome Completely
Close all Chrome windows first.

### Step 2: Start Chrome with Remote Debugging

**Windows:**
```powershell
# Find your Chrome installation path (usually):
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"

# Or if Chrome is in your PATH:
$chrome = "chrome.exe"

# Start Chrome with remote debugging on port 9222
& $chrome --remote-debugging-port=9222 --user-data-dir="$env:USERPROFILE\AppData\Local\Google\Chrome\User Data"
```

**Or create a shortcut:**
1. Right-click Chrome shortcut → Properties
2. In "Target" field, add after the path:
   ```
   --remote-debugging-port=9222
   ```
3. Example: `"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222`

### Step 3: Add to .env

Add this line to your `.env` file:
```env
CHROME_REMOTE_DEBUG_PORT=9222
```

### Step 4: Open Chrome and Log In
1. Open Chrome (using the shortcut/command above)
2. Go to https://dashboard.searchatlas.com/login
3. Sign in with Google (your existing account)
4. **Keep Chrome open** - don't close it!

### Step 5: Run Analysis
Now when you run your analysis, it will:
- Connect to your existing Chrome browser
- Open a new tab (not a new window)
- Use your existing Google login session
- No "automated test software" warning!

## Alternative: Different Port

If port 9222 is busy, use a different port:
```env
CHROME_REMOTE_DEBUG_PORT=9223
```

And start Chrome with:
```powershell
chrome.exe --remote-debugging-port=9223
```

## Benefits

- ✅ **No Google security warnings** - uses your real browser
- ✅ **Already logged in** - uses your existing sessions
- ✅ **Faster** - no new browser to launch
- ✅ **More reliable** - behaves like your regular browser

## Troubleshooting

**"Failed to connect to Chrome":**
- Make sure Chrome is running with `--remote-debugging-port=9222`
- Check the port number matches in `.env`
- Try closing and reopening Chrome

**"Port already in use":**
- Use a different port (9223, 9224, etc.)
- Update `.env` with the new port

**Chrome won't start with remote debugging:**
- Make sure you close all Chrome windows first
- Check if Chrome is running in background (Task Manager)
- Try a different port number

---

**Once set up, just keep Chrome open and run your analysis!** 🚀

