# 🎯 Web Dashboard Guide

## How to Use the Dashboard

### Access the Dashboard

1. **Start the web server:**
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   ```
   http://localhost:3000
   ```

---

## Upload CSV File (New Analysis)

### Step 1: Click "New Analysis" Button

- On the homepage, click the **"+ New Analysis"** button (top right)

### Step 2: Upload Your CSV File

Your CSV should have these columns:
- `city` - City name
- `state` - State abbreviation (e.g., CA, NY, TX)
- `zip` - ZIP code (optional but recommended)
- `payout` - Payout amount (e.g., 162.00)
- `niche` - Niche category (optional - can type it instead)

**Example CSV:**
```csv
city,state,zip,payout,niche
Minneapolis,MN,55421,162.00,roofing
Los Angeles,CA,90001,166.95,roofing
Chicago,IL,60601,155.50,roofing
```

**Supported column name variations:**
- Payout: `payout`, `CPL Buyer Payouts`, `Duration Buyer Pay`, `CPL`
- City: `city`, `City`
- State: `state`, `State`, `state_id`
- ZIP: `zip`, `Zip`, `Zip Code`, `ZIP Code`
- Niche: `niche`, `Niche`, `category`, `Category`

### Step 3: Set Niche

**Option A: Use niche from CSV column**
- Check the box "Use niche from CSV column"
- The system will use the most common niche value from your CSV

**Option B: Type niche manually**
- Leave the box unchecked
- Type the niche name (e.g., "roofing", "plumbing")
- Must have a keyword file at `packages/core/keywords/[niche].json`

### Step 4: Click "Start Analysis"

- The system will:
  1. Upload and parse your CSV
  2. Filter to locations with valid payouts
  3. Create a new run
  4. Start analyzing (this happens in the background)
  5. Redirect you to the results page

---

## View Results

### On the Homepage:

- **See all runs** - Table showing all your analyses
- **Click "View"** - See detailed results for a run

### On the Run Details Page:

- **Top 3 Opportunities** - Highlighted at the top
- **All Results** - Full table with all locations
- **Filters:**
  - Filter by state
  - Filter by difficulty (super easy, kind of easy, challenging)
  - Filter by minimum opportunity score

---

## Dashboard Features

✅ **Upload CSV files** - Drag & drop or click to upload  
✅ **View all runs** - See all your analyses in one place  
✅ **Filter results** - By state, difficulty, opportunity score  
✅ **Top 3 highlighted** - Best opportunities shown first  
✅ **Real-time status** - See when analysis is running/completed  

---

## CSV Format Examples

### Complete Format (Recommended):
```csv
city,state,zip,payout,niche
Minneapolis,MN,55421,162.00,roofing
Los Angeles,CA,90001,166.95,roofing
```

### Without Niche Column:
```csv
city,state,zip,payout
Minneapolis,MN,55421,162.00
Los Angeles,CA,90001,166.95
```
(You'll type the niche in the form)

### Without ZIP:
```csv
city,state,payout,niche
Minneapolis,MN,162.00,roofing
Los Angeles,CA,166.95,roofing
```

---

## Tips

- **Up to 100 locations** per analysis
- **Locations without payouts** are automatically skipped
- **Analysis runs in background** - you can close the browser, it keeps running
- **Refresh the page** to see updated status if analysis is still running
- **First SearchAtlas login** will open browser automatically when analysis starts

---

## Need Help?

- **CSV upload fails?** Check column names match supported variations
- **Niche not found?** Make sure keyword file exists at `packages/core/keywords/[niche].json`
- **Analysis stuck?** Check browser console for errors or restart the dev server

**That's it!** You can now upload CSV files and view results all through the web dashboard! 🎉

