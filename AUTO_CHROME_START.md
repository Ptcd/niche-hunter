# Automatic Chrome Startup

## Overview

The system now **automatically starts Chrome** with remote debugging when you begin an analysis. No manual setup needed!

## How It Works

1. When you upload a CSV and start an analysis:
   - System checks if Chrome is already running with remote debugging
   - If not, automatically starts Chrome with:
     - Remote debugging enabled (port 9222 by default)
     - Your existing Chrome profile (so all extensions are available)
   - Verifies Keywords Everywhere extension is enabled
   - Connects and begins fetching data

2. **Your Extensions Are Available**
   - Uses your **actual Chrome profile** (not guest mode)
   - Both `--user-data-dir` and `--profile-directory` are set automatically
   - Keywords Everywhere extension is automatically detected
   - Any other Chrome extensions you have installed are also available
   - **Extensions are NOT available in guest mode**, so we always use your real profile

## Configuration

### Default Port

Port 9222 is used by default. To change it, add to `.env`:
```env
CHROME_REMOTE_DEBUG_PORT=9223
```

### Custom Chrome Profile

By default, uses your existing Chrome profile at:
```
%LOCALAPPDATA%\Google\Chrome\User Data
```

**To use a specific profile (e.g., "Person 1"):**

Add to your `.env` file:
```env
CHROME_PROFILE_NAME=Person 1
```

Or directly specify the profile directory:
```env
CHROME_PROFILE_DIR=Profile 1
```

**Advanced: Custom User Data Directory**

If your Chrome is installed in a non-standard location:
```env
CHROME_USER_DATA_DIR=C:\Custom\Path\To\Chrome\User Data
```

**Important Notes:**
- The system will **never use the 'Default' profile** when remote debugging is enabled (Chrome rejects it)
- If `CHROME_PROFILE_NAME` is set but not found, it will automatically map:
  - "Person 1" → "Profile 1"
  - "Person 2" → "Profile 2"
  - etc.
- If both `CHROME_PROFILE_DIR` and `CHROME_PROFILE_NAME` are set, `CHROME_PROFILE_DIR` takes precedence

This ensures:
- Keywords Everywhere and other extensions are available
- Your specific profile settings are used
- Extensions installed in that profile will work
- Remote debugging works correctly (non-Default profile required)

## Troubleshooting

### Chrome Already Running

If Chrome is already open (without remote debugging), the auto-start may fail:

**Solution:** Close all Chrome windows, then run the analysis:
```bash
taskkill /F /IM chrome.exe
```

### Port Already in Use

If port 9222 is already in use:
1. Change port in `.env`: `CHROME_REMOTE_DEBUG_PORT=9223`
2. Or close the process using port 9222

### Keywords Everywhere Not Detected

Make sure:
1. Keywords Everywhere is installed in your regular Chrome browser
2. Extension is enabled in `chrome://extensions/`
3. Extension has API credits configured
4. Close Chrome completely, then run analysis (Chrome will auto-start)

## Benefits

✅ **Zero manual setup** - Chrome starts automatically
✅ **Your extensions work** - Uses your existing Chrome profile
✅ **No "automated browser" warnings** - Uses your real Chrome
✅ **Faster** - Auto-detection and startup

## Manual Override

If you prefer to start Chrome manually:

1. Run `start-chrome-debug.bat`
2. Or manually: `chrome.exe --remote-debugging-port=9222`
3. Then run your analysis (will connect to existing Chrome)

