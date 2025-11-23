# Niche Hunter Improvement Plan

## Current State Analysis

### ✅ What's Already Working Well

1. **Keyword Volume Collection** - Using Keywords Everywhere to get search volumes
2. **SERP Analysis** - Extracting competitor information, local pack detection
3. **Difficulty Scoring** - Basic difficulty calculation based on signals
4. **Lead Estimation** - Conservative/realistic/optimistic scenarios
5. **Keyword Prioritization** - Ranking keywords by volume, difficulty, and intent
6. **Dashboard Display** - Showing top keywords with volumes and difficulty

### ❌ What's Missing or Needs Improvement

## Priority 1: Critical Improvements (Do These First)

### 1. **Per-Keyword SERP Analysis** ⚠️ HIGH PRIORITY
**Problem:** Currently only analyzing SERP for the top keyword. Each keyword should have its own difficulty score.

**Solution:**
- Fetch SERP for top 5-10 keywords individually
- Calculate individual keyword difficulty based on its own SERP
- Store per-keyword competitor data

**Impact:** Much more accurate difficulty assessment per keyword

### 2. **Capture CPC Data from Keywords Everywhere** 💰
**Problem:** Keywords Everywhere shows CPC but we're not capturing it.

**Solution:**
- Extract CPC from Keywords Everywhere extension data
- Store in Keyword model (already has `cpc` field)
- Use CPC to better estimate keyword value

**Impact:** Better ROI calculations, identify high-value keywords

### 3. **Enhanced Competitor Analysis Display** 📊
**Problem:** Competitor data is calculated but not shown in dashboard.

**Solution:**
- Show competitor breakdown per location/keyword
- Display: aggregator count, directory count, lead-gen sites, local businesses
- Show estimated domain authority of top competitors

**Impact:** Better understanding of competition landscape

### 4. **Time to Rank Estimates** ⏱️
**Problem:** `estimateTimeToRank()` exists but not displayed.

**Solution:**
- Show time-to-rank in dashboard (2-4 months, 4-8 months, 8-16 months)
- Display per keyword and per location

**Impact:** Better planning and expectations

## Priority 2: Important Enhancements

### 5. **Individual Keyword Lead Estimates** 📈
**Problem:** Only showing aggregate lead estimates. Users want to see per-keyword breakdown.

**Solution:**
- Calculate and display lead estimates for each top keyword
- Show: conservative, realistic, optimistic leads per keyword
- Show monthly value per keyword

**Impact:** Better keyword selection, prioritize highest-value keywords

### 6. **Content Depth Analysis** 📝
**Problem:** Not analyzing how comprehensive competitor content is.

**Solution:**
- Estimate word count from SERP snippets (already have `estimatedWordCount`)
- Analyze content quality signals (images, videos, structured data)
- Factor into difficulty calculation

**Impact:** More accurate difficulty - thin content = easier to beat

### 7. **Better Keyword Discovery** 🔍
**Problem:** Only using predefined taxonomy keywords.

**Solution:**
- Extract related keywords from SERP "People also ask" sections
- Extract from "Related searches" at bottom of SERP
- Use Keywords Everywhere's similar keywords feature (already partially implemented)
- Store discovered keywords for future analysis

**Impact:** Find hidden opportunities, expand keyword lists

### 8. **Backlink Strength Estimation** 🔗
**Problem:** Domain authority is estimated but not very accurate.

**Solution:**
- Enhance domain authority estimation with more signals
- Factor in: domain age (from WHOIS), subdomain count, SSL certificate age
- Use position as stronger signal (higher position = likely more backlinks)

**Impact:** More accurate competitor strength assessment

## Priority 3: Nice-to-Have Features

### 9. **Content Gap Analysis** 📋
**Problem:** Not identifying what content competitors have that you don't.

**Solution:**
- Analyze competitor page titles and meta descriptions
- Identify common content themes
- Suggest content topics to create

**Impact:** Content strategy guidance

### 10. **Historical Tracking** 📅
**Problem:** No way to track how rankings/difficulty change over time.

**Solution:**
- Store historical scan data
- Track difficulty trends
- Alert when opportunities improve or worsen

**Impact:** Identify trends, catch opportunities early

### 11. **Export Enhancements** 📤
**Problem:** Export might not include all new keyword data.

**Solution:**
- Include per-keyword lead estimates in exports
- Include competitor breakdown
- Include time-to-rank estimates

**Impact:** Better reporting and analysis

### 12. **Keyword Clustering** 🎯
**Problem:** Keywords shown individually, not grouped by theme.

**Solution:**
- Group related keywords (e.g., "plumber near me", "plumber in [city]" = same intent)
- Show cluster-level metrics
- Reduce redundancy in display

**Impact:** Cleaner dashboard, better keyword organization

## Implementation Order

### Phase 1 (Immediate - Do Now)
1. Capture CPC data from Keywords Everywhere
2. Display time-to-rank in dashboard
3. Show competitor breakdown in dashboard
4. Display individual keyword lead estimates

### Phase 2 (Next Week)
5. Per-keyword SERP analysis for top 5 keywords
6. Enhanced content depth analysis
7. Better keyword discovery from SERPs

### Phase 3 (Future)
8. Backlink strength improvements
9. Content gap analysis
10. Historical tracking
11. Export enhancements

## Technical Notes

### Keywords Everywhere CPC Extraction
The extension shows CPC data. Need to:
- Look for CPC indicators in the page (similar to volume extraction)
- Store in `Keyword.cpc` field
- Use in priority calculations

### Per-Keyword SERP Analysis
Currently in `run.ts`, only fetching SERP for primary keyword. Need to:
- Loop through top 5-10 keywords
- Fetch SERP for each
- Calculate difficulty per keyword
- Store competitor data per keyword (might need new model or JSON field)

### Dashboard Enhancements
Add new sections to `apps/web/src/pages/runs/[id].tsx`:
- Competitor breakdown table
- Per-keyword lead estimates
- Time-to-rank display
- CPC data display

## Questions to Answer

1. **Rate Limiting:** How many SERP fetches can we do per location? (Currently 1, would need 5-10)
2. **Performance:** Will per-keyword SERP analysis slow down runs significantly?
3. **Data Storage:** Should we store per-keyword competitor data in JSON or separate model?

## Success Metrics

After improvements, you should be able to:
- ✅ See exact difficulty for each keyword (not just location)
- ✅ Know CPC for each keyword
- ✅ See competitor breakdown (how many aggregators, directories, etc.)
- ✅ Get time-to-rank estimates
- ✅ See individual keyword lead estimates
- ✅ Discover new keywords from SERPs
- ✅ Make better decisions on which locations/keywords to target






