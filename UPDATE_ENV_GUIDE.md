# How to Update .env with Supabase Connection String

## Quick Steps:

1. **Copy your Supabase connection string** (from Supabase Dashboard → Settings → Database → URI tab)

2. **It looks like this:**
   ```
   postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

3. **Replace `[password]`** with the actual password you set when creating the Supabase project

4. **Paste it here** and I'll update the .env file for you, OR manually edit `.env`:

   - Open `.env` file in the project root
   - Find the line: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/niche_hunter`
   - Replace the entire line with your Supabase connection string
   - Save the file

## Example:

**Before:**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/niche_hunter
```

**After (with your Supabase string):**
```
DATABASE_URL=postgresql://postgres.abcdefghijklmnop:your_actual_password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

## Important Notes:

- ✅ Keep the `postgresql://` at the start
- ✅ The password goes after the `:` and before the `@`
- ✅ No spaces in the connection string
- ✅ Make sure the password doesn't have special characters that need URL encoding (if it does, replace them with % codes)

