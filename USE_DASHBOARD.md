# 🚀 How to Use the Web Dashboard

## Start the Dashboard

```bash
npm run dev
```

Then open: **http://localhost:3000**

---

## Upload CSV Through Dashboard

### 1. Click "+ New Analysis" Button
- On the homepage, click the blue button in the top right

### 2. Upload Your CSV File
- Click "Choose File" or drag & drop your CSV
- Your CSV should have: `city`, `state`, `zip`, `payout`, and optionally `niche`

**Example format:**
```csv
city,state,zip,payout,niche
Minneapolis,MN,55421,162.00,roofing
Los Angeles,CA,90001,166.95,roofing
```

### 3. Set the Niche

**Option A:** Check "Use niche from CSV column" - it will use the niche from your CSV

**Option B:** Type the niche manually (e.g., "roofing") - must have a keyword file for that niche

### 4. Click "Start Analysis"
- File uploads
- Analysis starts in the background
- You're redirected to the results page
- Results appear as analysis completes

---

## View Results

### Homepage Shows:
- All your analysis runs
- Status (running/completed)
- Number of locations analyzed
- Click "View" to see detailed results

### Results Page Shows:
- **Top 3 Opportunities** (highlighted at top)
- **Full table** with all locations
- **Filters:** State, difficulty, minimum opportunity score

---

## CSV Format

Your CSV needs these columns (flexible naming):

**Required:**
- `city` or `City`
- `state` or `State` or `state_id`
- `payout` or `CPL Buyer Payouts` or `Duration Buyer Pay` or `CPL`

**Optional:**
- `zip` or `Zip` or `Zip Code` or `ZIP Code`
- `niche` or `Niche` or `category` or `Category`

**Example:**
```csv
city,state,zip,payout,niche
Minneapolis,MN,55421,162.00,roofing
Los Angeles,CA,90001,166.95,roofing
```

---

## That's It!

1. Start dashboard: `npm run dev`
2. Upload CSV: Click "+ New Analysis" → Upload file → Start
3. View results: See top 3 opportunities and full table

**No command line needed!** Everything works through the web interface. 🎉

