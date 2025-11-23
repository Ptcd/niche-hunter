# SearchAtlas Login Guide

## How It Works

SearchAtlas uses **Google OAuth** for login, so we've built the system to handle this automatically.

## First Time You Run

When you run your first analysis:
```bash
npx niche-hunter run --data ./my-data.csv
```

### What Happens:

1. ✅ **Browser window opens automatically** (Playwright launches Chromium)
2. ✅ **SearchAtlas login page appears**
3. ✅ **You click "Sign in with Google"** in the browser window
4. ✅ **Complete Google OAuth flow** (select account, authorize)
5. ✅ **Session is automatically saved** to `.auth/searchatlas/`
6. ✅ **Browser closes** and analysis continues
7. ✅ **Future runs use saved session** - no login needed!

## Environment Variables

You **do NOT** need to put your SearchAtlas password in `.env` because:
- SearchAtlas uses Google OAuth (not email/password)
- The browser handles the OAuth flow
- Session cookies are saved after first login

### What's in .env:

```env
# These are actually optional for SearchAtlas since we use OAuth
SEARCHATLAS_EMAIL=your_email@example.com  # Used for reference only
SEARCHATLAS_PASSWORD=your_password         # Not actually used
```

**You can leave these as placeholders** - the real login happens in the browser!

## Session Management

- **First run**: Browser opens → Manual Google login → Session saved
- **Subsequent runs**: Uses saved session automatically (no browser popup)
- **Session expires**: Browser opens again → Login → New session saved

## If Login Fails

If you need to re-authenticate:
```bash
# Delete saved session
rm -rf .auth/searchatlas/

# Or on Windows:
rmdir /s .auth\searchatlas

# Then run again - browser will open for fresh login
npx niche-hunter run --data ./my-data.csv
```

## Troubleshooting

**Browser doesn't open:**
- Check Playwright is installed: `npx playwright install chromium`
- Make sure you're running the command from the project root
- Try deleting `.auth/searchatlas/` and running again

**Login times out:**
- The window waits up to 5 minutes for you to complete login
- If timeout occurs, delete `.auth/searchatlas/` and try again
- Make sure you're completing the full Google OAuth flow

**"Login required" errors:**
- Delete `.auth/searchatlas/` folder
- Run the command again
- Complete login in the browser window that opens

## Summary

✅ **No special setup needed** - just run your first analysis  
✅ **Browser opens automatically** on first run  
✅ **Complete Google login** in the browser window  
✅ **Session saved automatically** for future runs  
✅ **No credentials in .env needed** - OAuth handles it!

The `.env` SearchAtlas entries are optional placeholders - the real authentication happens via Google OAuth in the browser.

