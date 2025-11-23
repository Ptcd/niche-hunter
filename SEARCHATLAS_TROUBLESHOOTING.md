# SearchAtlas Troubleshooting

## "No Available Server" Error

If you see "no available server" when trying to fetch keyword volumes:

### Quick Fixes

1. **Check SearchAtlas Status**
   - Visit https://app.searchatlas.com in your browser
   - If it's down, wait and try again later
   - The system will use cached data if available

2. **The Analysis Will Still Run**
   - The system automatically falls back to cached volume data
   - If no cache exists, volumes default to 0
   - SERP analysis will still work (doesn't require SearchAtlas)

3. **Retry Later**
   - SearchAtlas may be experiencing temporary downtime
   - Try running the analysis again in a few minutes

### Options

**Option 1: Wait and Retry**
- SearchAtlas is likely temporarily down
- Wait 5-10 minutes and try again

**Option 2: Continue Without Volumes**
- The analysis will run with volume = 0 for all keywords
- You'll still get:
  - Difficulty scores (from SERP analysis)
  - Opportunity scores
  - Profit estimates (based on payouts)
- Only demand scores will be affected

**Option 3: Use Cached Data**
- If you've run analyses before, cached volumes will be used
- Cache lasts 30 days (configurable via `SEARCH_TTL_DAYS` in `.env`)

### Manual Workaround

If SearchAtlas continues to be unavailable:

1. You can manually add volume data to the database
2. Or wait until SearchAtlas is back online
3. The rest of the analysis (SERP, difficulty, profit) doesn't require SearchAtlas

---

**Note:** The "no available server" error is coming from SearchAtlas itself, not from your application. This is a temporary service issue on their end.

