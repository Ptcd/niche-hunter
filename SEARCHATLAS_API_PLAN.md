# SearchAtlas API Integration Plan
## How API Calls Map to Niche Quality Assessment

---

## Overview

This plan outlines how to use SearchAtlas API to gather data needed for niche quality scoring. The system currently calculates:
1. **Demand Score** (0-1) - Based on search volumes across keyword intent buckets
2. **Difficulty Score** (0-1) - Based on SERP competition signals
3. **Opportunity Score** (0-1) - Weighted combination: `α * demandScore + β * (1 - difficulty)`
4. **Profit Estimate** - Monthly revenue potential based on volume, CTR, conversions, payout

---

## Current System Flow

```
For each Location:
  ├─ Fetch search volumes for all keywords (core, transactional, emergency, adjacency)
  ├─ Analyze SERP for difficulty signals (local pack, aggregators, directories, EMDs)
  ├─ Calculate Demand Score from volumes
  ├─ Calculate Difficulty Score from SERP signals
  ├─ Calculate Opportunity Score = weighted combination
  ├─ Calculate Profit Estimate = volume × CTR × conversions × payout
  └─ Store results in database
```

---

## SearchAtlas API Integration Plan

### Phase 1: Keyword Search Volume (✅ Already Implemented)

**API Endpoint:** Keyword Volume Lookup
**Current Status:** Basic implementation exists

**What We Call:**
```typescript
GET/POST /api/keywords/volume
{
  "keyword": "plumber denver colorado",
  "location": "Denver, CO"
}
```

**What We Get:**
```json
{
  "volume": 1200,              // Monthly search volume
  "search_volume": 1200,       // Alternative field name
  "monthly_searches": 1200,     // Alternative field name
  "similar_keywords": [...],    // Related keywords
  "related_keywords": [...],     // Alternative field name
  "cpc": 12.50,                 // Cost per click (if available)
  "competition": "medium"       // Competition level (if available)
}
```

**How It Maps to Quality:**
- **Demand Score Calculation:**
  ```
  volumesByBucket = {
    core: 5000,           // e.g., "plumber"
    transactional: 3000,  // e.g., "hire plumber"
    emergency: 2000,      // e.g., "emergency plumber"
    adjacency: 1000       // e.g., "plumbing repair"
  }
  
  demandScore = sigmoid(log1p(weightedSum))
  ```
- Volumes are grouped by intent bucket and weighted
- Higher volumes = higher demand score = better niche quality

---

### Phase 2: Keyword Difficulty & Competition Metrics

**API Endpoint:** Keyword Difficulty / Competition Analysis
**Status:** Not yet implemented

**What We Call:**
```typescript
GET/POST /api/keywords/difficulty
{
  "keyword": "plumber denver colorado",
  "location": "Denver, CO"
}
```

**What We Get:**
```json
{
  "keyword_difficulty": 45,        // 0-100 scale
  "competition_level": "medium",   // low, medium, high
  "competition_index": 0.65,       // 0-1 scale
  "cpc": 12.50,                    // Cost per click (indicates competition)
  "top_domains": [                 // Top ranking domains
    {
      "domain": "example.com",
      "domain_rating": 65,
      "backlinks": 5000,
      "position": 1
    }
  ]
}
```

**How It Maps to Quality:**
- **Difficulty Score Enhancement:**
  ```
  Current difficulty = weighted SERP signals
  Enhanced difficulty = combine SERP signals + API competition data
  
  difficulty = 
    (existing SERP signals) * 0.7 +
    (API competition_index) * 0.3
  ```
- Lower difficulty = easier to rank = better opportunity
- API provides data without scraping SERP (faster, more reliable)

---

### Phase 3: SERP Features & Competition Signals

**API Endpoint:** SERP Analysis / SERP Features
**Status:** Not yet implemented

**What We Call:**
```typescript
GET/POST /api/serp/analyze
{
  "keyword": "plumber denver colorado",
  "location": "Denver, CO"
}
```

**What We Get:**
```json
{
  "serp_features": {
    "local_pack": true,              // Google Local Pack present
    "local_pack_count": 3,
    "aggregators": [                 // Aggregator sites (Yelp, Thumbtack, etc.)
      {"name": "Yelp", "position": 2},
      {"name": "Thumbtack", "position": 5}
    ],
    "directories": [                  // Directory sites
      {"name": "HomeAdvisor", "position": 3}
    ],
    "exact_match_domains": 2,        // EMDs (exactmatchdomains.com)
    "partial_match_domains": 1,      // PMDs
    "title_contains_city": 0.8,      // % of titles with city name
    "thin_pages": 0.2                // % of thin/low-quality pages
  },
  "organic_results": [
    {
      "position": 1,
      "title": "Best Plumber in Denver | Emergency 24/7",
      "url": "https://example.com",
      "domain": "example.com",
      "domain_rating": 65,
      "backlinks": 5000
    }
  ]
}
```

**How It Maps to Quality:**
- **Difficulty Score Calculation:**
  ```typescript
  signals = {
    hasLocalPack: serpFeatures.local_pack,
    aggregatorCount: serpFeatures.aggregators.length,
    directoryCount: serpFeatures.directories.length,
    emdCount: serpFeatures.exact_match_domains,
    pmdCount: serpFeatures.partial_match_domains,
    thinPageRatio: serpFeatures.thin_pages,
    avgTitleContainsCity: serpFeatures.title_contains_city
  }
  
  difficulty = computeDifficulty(signals)
  ```
- This replaces current SERP scraping with API data
- More reliable, faster, no browser needed

---

### Phase 4: Competitor Analysis & Domain Metrics

**API Endpoint:** Domain Analysis / Backlink Profile
**Status:** Not yet implemented

**What We Call:**
```typescript
GET/POST /api/domains/analyze
{
  "domain": "example.com",
  "keyword": "plumber denver"
}
```

**What We Get:**
```json
{
  "domain_rating": 65,              // Domain authority (0-100)
  "backlinks": 5000,                 // Total backlinks
  "referring_domains": 250,          // Unique referring domains
  "organic_keywords": 1200,          // Keywords ranking for
  "organic_traffic": 15000,           // Monthly organic traffic
  "top_keywords": [...],             // Top ranking keywords
  "link_profile": {
    "spam_score": 0.15,              // 0-1, lower is better
    "link_quality": "high"            // high, medium, low
  }
}
```

**How It Maps to Quality:**
- **Enhanced Difficulty Assessment:**
  - If top 3 competitors have DR > 70, difficulty increases
  - If competitors have strong backlink profiles, difficulty increases
  - Store in `signalsJson` for analysis
- **Opportunity Identification:**
  - If competitors are weak (low DR, poor backlinks), opportunity increases
  - If niche has low-quality leaders, easier to compete

---

### Phase 5: Trend Analysis & Seasonality

**API Endpoint:** Keyword Trends / Historical Data
**Status:** Not yet implemented

**What We Call:**
```typescript
GET/POST /api/keywords/trends
{
  "keyword": "plumber denver",
  "location": "Denver, CO",
  "period": "12months"
}
```

**What We Get:**
```json
{
  "trend": "growing",                 // growing, stable, declining
  "trend_score": 0.75,                // 0-1, growth rate
  "seasonality": {
    "has_seasonality": true,
    "peak_months": ["January", "February"],
    "low_months": ["July", "August"]
  },
  "historical_volume": [
    {"month": "2024-01", "volume": 1500},
    {"month": "2024-02", "volume": 1800},
    ...
  ],
  "forecast": {
    "next_3_months": [1200, 1300, 1400],
    "next_12_months_avg": 1350
  }
}
```

**How It Maps to Quality:**
- **Trend-Adjusted Demand Score:**
  ```
  baseDemandScore = current calculation
  trendMultiplier = 1.0 + (trend_score * 0.2)  // Up to 20% boost for growth
  adjustedDemandScore = baseDemandScore * trendMultiplier
  ```
- Growing niches = higher quality
- Declining niches = lower quality
- Seasonal niches = need to account for timing

---

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  For Each Location (City, State)                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: Fetch Keyword Volumes (by bucket)                  │
│  ├─ Core keywords: "plumber", "plumbing"                    │
│  ├─ Transactional: "hire plumber", "plumber near me"         │
│  ├─ Emergency: "emergency plumber", "24/7 plumber"          │
│  └─ Adjacency: "plumbing repair", "drain cleaning"          │
│                                                               │
│  API Call: /api/keywords/volume × N keywords                 │
│  Result: volumesByBucket = {core: 5000, transactional: 3000}│
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: Calculate Demand Score                             │
│  weightedSum = Σ(volume × intentWeight)                      │
│  demandScore = sigmoid(weightedSum / 10)                      │
│  Range: 0-1 (higher = more demand)                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: Analyze SERP Competition (for top keyword)         │
│  ├─ Check for Local Pack                                     │
│  ├─ Count Aggregators (Yelp, Thumbtack, etc.)               │
│  ├─ Count Directories (HomeAdvisor, etc.)                    │
│  ├─ Count EMDs/PMDs                                          │
│  └─ Analyze page quality indicators                          │
│                                                               │
│  API Call: /api/serp/analyze                                 │
│  Result: signals = {hasLocalPack: true, aggregatorCount: 3}  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 4: Calculate Difficulty Score                        │
│  difficulty = weighted combination of SERP signals          │
│  Range: 0-1 (higher = harder to rank)                      │
│                                                               │
│  Optional: Enhance with keyword difficulty API               │
│  difficulty = (SERP signals × 0.7) + (API difficulty × 0.3)│
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 5: Calculate Opportunity Score                        │
│  opportunity = α × demandScore + β × (1 - difficulty)       │
│  Default: α = 0.6, β = 0.4                                  │
│  Range: 0-1 (higher = better opportunity)                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 6: Calculate Profit Estimate                         │
│  profitEst = volume × CTR × siteConv × leadConv × payout    │
│  Default: CTR = 5%, siteConv = 3%, leadConv = 30%           │
│  Result: Estimated monthly profit potential                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 7: Store Results                                     │
│  ├─ Scan record with scores                                  │
│  ├─ Volume samples (cached for future use)                   │
│  └─ SERP data (for analysis)                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

### ✅ Phase 1: Keyword Volume (COMPLETE)
- Basic API integration exists
- Returns search volume and similar keywords
- **Next Step:** Verify API endpoint format matches SearchAtlas documentation

### 🔄 Phase 2: SERP Features (HIGH PRIORITY)
- Replace current browser-based SERP scraping
- Get competition signals directly from API
- **Benefits:** Faster, more reliable, no browser needed
- **API Endpoint:** `/api/serp/analyze` or similar

### 🔄 Phase 3: Keyword Difficulty (MEDIUM PRIORITY)
- Enhance difficulty calculation with API competition data
- Get keyword difficulty score
- **API Endpoint:** `/api/keywords/difficulty` or similar

### ⏳ Phase 4: Domain Metrics (LOW PRIORITY)
- Analyze competitor domains
- Get backlink profiles
- **API Endpoint:** `/api/domains/analyze` or similar

### ⏳ Phase 5: Trends (LOW PRIORITY)
- Historical volume data
- Trend analysis
- **API Endpoint:** `/api/keywords/trends` or similar

---

## API Call Optimization

### Current Approach (Browser-Based):
- 1 API call per keyword for volume
- 1 SERP scrape per location (slow, unreliable)
- **Total:** ~30-50 API calls per location

### Optimized Approach (API-Based):
- 1 API call per keyword for volume (same)
- 1 API call for SERP analysis (replaces scraping)
- **Total:** ~30-50 API calls per location (same count, but faster)

### Batch Optimization (Future):
- Batch keyword volume requests
- `POST /api/keywords/volume/batch` with array of keywords
- **Total:** 1-2 API calls per location (much faster)

---

## Quality Scoring Summary

### Final Opportunity Score Formula:
```
opportunity = α × demandScore + β × (1 - difficulty)

Where:
- demandScore = f(volumesByBucket, intentWeights)  // From Phase 1
- difficulty = f(SERP signals, API competition)     // From Phase 3
- α = 0.6 (demand weight)
- β = 0.4 (difficulty weight)
```

### Final Score Calculation:
```
finalScore = opportunity × profitMultiplier

Where:
- profitMultiplier = min(1 + log1p(profitEst / 1000), 2)
- profitEst = volume × CTR × conversions × payout
```

### Quality Thresholds:
- **Opportunity > 0.7:** Excellent opportunity
- **Opportunity 0.5-0.7:** Good opportunity
- **Opportunity 0.3-0.5:** Moderate opportunity
- **Opportunity < 0.3:** Low opportunity

---

## Next Steps

1. **Verify SearchAtlas API Documentation:**
   - Confirm exact endpoint URLs
   - Confirm request/response formats
   - Check authentication method
   - Review rate limits

2. **Implement Phase 2 (SERP Features):**
   - Replace browser scraping with API calls
   - Map API response to DifficultySignals format
   - Test with real data

3. **Enhance Phase 1:**
   - Add error handling
   - Add retry logic
   - Implement caching strategy

4. **Add API Response Validation:**
   - TypeScript interfaces for API responses
   - Response validation
   - Error handling for missing fields

5. **Monitor & Optimize:**
   - Track API usage/costs
   - Implement rate limiting
   - Cache frequently accessed data

---

## Notes

- All API endpoints and response formats are estimates based on common API patterns
- Actual SearchAtlas API may differ - verify with their documentation
- Some endpoints may require different authentication or request formats
- Rate limits may apply - implement throttling if needed
- Consider implementing API response caching to reduce calls






