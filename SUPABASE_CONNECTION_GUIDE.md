# 📋 Supabase Connection String - Visual Guide

## Where to Find It in Supabase

### Step-by-Step with Screenshots Location:

1. **Login to Supabase**: https://app.supabase.com

2. **Select Your Project**: Click on your project (the one named "niche-hunter" or whatever you named it)

3. **Go to Settings**: 
   - Look for the **⚙️ gear icon** in the left sidebar (usually at the bottom)
   - Click it

4. **Click "Database"**: 
   - In the Settings menu, you'll see tabs like: API, Database, Auth, Storage, etc.
   - Click on **"Database"**

5. **Find "Connection string" Section**:
   - Scroll down the Database settings page
   - You'll see a section called **"Connection string"** or **"Connection pooling"**
   - There are usually tabs like: **URI**, **JDBC**, **.NET**, **Python**, etc.

6. **Click "URI" Tab** (should be selected by default)

7. **Copy the String**:
   - You'll see a connection string that looks like:
     ```
     postgresql://postgres.xxxxxxxxxxxxx:your_password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
     ```
   - There's usually a **"Copy" button** (📋 icon) - click it
   - OR select all the text and copy it (Ctrl+C)

## ⚠️ Important: Replace [password] Placeholder

If the connection string shows `[YOUR-PASSWORD]` or `[password]`, you need to:
- **Replace it** with the actual password you set when creating the Supabase project
- Example: If your password was `MySecurePass123!`, the connection string should have that instead of `[password]`

## What the Connection String Looks Like

**Full format:**
```
postgresql://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@[HOST]:[PORT]/postgres
```

**Example (what you'll actually see):**
```
postgresql://postgres.abcdefghijklmnopqrstuvwx:MyPassword123!@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

## Next Steps

Once you have the connection string:
1. **Paste it here** and I'll update .env for you, OR
2. **I'll show you exactly which line to replace** in .env

**Ready?** Get that connection string from Supabase and let me know when you have it!

