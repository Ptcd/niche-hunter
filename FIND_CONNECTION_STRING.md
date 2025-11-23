# 🔍 Where to Find Supabase Connection String

## The connection string is NOT on the Database Settings page!

It's in a different location. Here's where to find it:

---

## Method 1: Click the "Connect" Button (Easiest!)

1. **Look at the TOP BAR** of Supabase dashboard
2. **Find the green "Connect" button** (it's near the project name)
3. **Click "Connect"** - it will show a dropdown/modal
4. **Look for "Connection string"** or "Database URL" in that popup
5. **Select "URI"** tab
6. **Copy the connection string!**

---

## Method 2: Project Settings → API

1. **Click Settings (⚙️)** in the left sidebar
2. **Click "API"** (NOT "Database")
3. **Look for "Database URL"** or "Connection string" section
4. **You'll see it there** - copy it!

---

## Method 3: Settings → Database (Scroll Down!)

1. **Settings (⚙️)** → **Database** (you're already here)
2. **SCROLL DOWN** - the connection string section is often below SSL Configuration
3. **Look for a section called:**
   - "Connection string"
   - "Connection pooling"
   - "Database URL"
   - "Connection info"
4. **Click "URI" tab** in that section
5. **Copy the connection string**

---

## Method 4: Project Overview Page

1. **Go back to your project homepage** (click project name)
2. **Look for a card/section about "Connection info"** or "Quick start"
3. **The connection string is often shown there**

---

## What to Look For:

The connection string will look like:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

Or it might be split into parts showing:
- Host
- Port  
- Database
- User
- Password

---

## Still Can't Find It?

Try this:

1. **Click "Connect" button** (top bar) - this almost always has it
2. **Or go to:** Settings → API → Look for "Database" section
3. **Or try:** Settings → Database → Scroll way down past Network Restrictions

**The "Connect" button is usually the quickest way!**

Let me know which method works or if you need me to guide you through a specific one!

