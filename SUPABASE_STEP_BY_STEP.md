# Supabase Setup - Step by Step

## Step 1: Get Your Connection String

### In Supabase Dashboard:

1. **Go to your project** (the one you just created named "niche-hunter")

2. **Click the gear icon** (⚙️) in the left sidebar - this is "Settings"

3. **Click "Database"** in the Settings menu

4. **Scroll down** to find the "Connection string" section

5. **Look for tabs** - you'll see "URI", "JDBC", etc.

6. **Click the "URI" tab** (should be selected by default)

7. **You'll see a connection string** like:
   ```
   postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

8. **Click the "Copy" button** (or select all and Ctrl+C)

9. **IMPORTANT:** If you see `[YOUR-PASSWORD]` as a placeholder, replace it with the actual password you set when creating the project!

## Step 2: Update .env File

Once you have the connection string copied, we'll update the .env file.

## Step 3: Run Migrations

After updating .env, we'll run the migrations to create the database tables.

---

**Ready?** Paste your connection string here and I'll help update the .env file!

