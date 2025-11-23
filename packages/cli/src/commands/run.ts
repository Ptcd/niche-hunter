import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import pino from 'pino';
import { prisma } from '@niche-hunter/db';
import { importPayoutsFromCSV, getPayoutForLocation } from '@niche-hunter/db';
import { loadKeywordTaxonomy, loadIntentWeights, getAllKeywords } from '@niche-hunter/core';
import { getLocalVolume } from '@niche-hunter/crawler';
import { fetchSerpTop, extractSignals, extractCompetitorInfo, enhanceCompetitorInfo, calculateCompetitionStrength } from '@niche-hunter/crawler';
import {
  computeDemandScore,
  computeDifficulty,
  computeProfitEstimate,
  computeOpportunity,
  computeScoreBreakdown,
  computeFinalScore,
  prioritizeKeywords,
  getKeywordIntent,
  calculateAggregateLeadEstimates,
  estimateTimeToRank,
} from '@niche-hunter/core';
import { Location } from '@niche-hunter/core/src/types';

const logger = pino({ level: 'info' });

interface RunArgs {
  niche?: string;
  cities?: string;
  payout?: number;
  revenue?: string;
  data?: string; // Single CSV with cities, payouts, and optional niche
  limit: number;
  ctr?: number;
  siteconv?: number;
  leadconv?: number;
}

interface LocationWithPayout extends Location {
  payout: number;
  niche?: string;
}

function normalizeCurrency(value: string | number | undefined | null): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  
  // Convert to string and remove currency symbols, commas, spaces
  const cleaned = String(value)
    .trim()
    .replace(/[$€£¥,\s]/g, '') // Remove $, commas, spaces, and other currency symbols
    .replace(/[^\d.-]/g, ''); // Remove any remaining non-numeric chars except decimal point and minus
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function loadLocationsWithPayouts(filePath: string): LocationWithPayout[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    const data = JSON.parse(content);
    return Array.isArray(data) ? data.map((r: any) => ({
      city: r.city || r.City || '',
      state: r.state || r.State || r.state_id || '',
      zip: r.zip || r.Zip || r['Zip Code'] || r['ZIP Code'] || undefined,
      payout: normalizeCurrency(r.payout || r.Payout || r['payout'] || r['Payout'] || r['Payout Amount'] || r['CPL Buyer Payouts'] || r['Duration Buyer Pay'] || '0'),
      niche: r.niche || r.Niche || r.category || r.Category || undefined,
    })) : [];
  } else {
    // CSV
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    return records.map((r) => {
      const payoutStr = 
        r.payout || 
        r.Payout ||
        r['payout'] || 
        r['Payout'] ||
        r['Payout Amount'] ||
        r['CPL Buyer Payouts'] || 
        r['Duration Buyer Pay'] || 
        r['CPL'] || 
        '0';
      const payout = normalizeCurrency(payoutStr);

      return {
        city: r.city || r.City || r['city'] || '',
        state: r.state || r.State || r['state'] || r.state_id || '',
        zip: r.zip || r.Zip || r['zip'] || r['Zip Code'] || r['ZIP Code'] || r['zip code'] || r['zip_code'] || undefined,
        payout,
        niche: r.niche || r.Niche || r['niche'] || r.category || r.Category || undefined,
      };
    });
  }
}

function loadLocations(filePath: string): Location[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    return JSON.parse(content);
  } else {
    // CSV
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    return records.map((r) => ({
      city: r.city || r.City || '',
      state: r.state || r.State || r.state_id || '',
      zip: r.zip || r.Zip || r['Zip Code'] || r['ZIP Code'] || undefined,
    }));
  }
}

function normalizeCity(city: string): string {
  return city.trim();
}

function normalizeState(state: string): string {
  return state.trim().toUpperCase().slice(0, 2);
}

export async function runCommand(args: RunArgs): Promise<void> {
  logger.info({ args }, 'Starting run');

  let niche: string;
  let validLocations: Array<Location & { payout: number }> = [];

  // Mode 1: Single CSV with everything (cities, payouts, optional niche)
  if (args.data) {
    const locationsWithData = loadLocationsWithPayouts(args.data);
    
    // Filter out rows with zero or missing payouts
    const locationsWithPayouts = locationsWithData.filter((l) => l.payout > 0);
    logger.info(
      { total: locationsWithData.length, withPayouts: locationsWithPayouts.length },
      'Loaded locations from data file'
    );

    if (locationsWithPayouts.length === 0) {
      logger.error('No locations with valid payouts found in data file');
      process.exit(1);
    }

    // Determine niche: from CSV column, CLI arg, or first row's niche
    const niches = locationsWithPayouts
      .map((l) => l.niche)
      .filter((n): n is string => !!n);
    
    if (args.niche) {
      niche = args.niche;
      logger.info({ niche }, 'Using niche from CLI argument');
    } else if (niches.length > 0) {
      // Use the most common niche from the CSV, or first one if all different
      const nicheCounts = niches.reduce((acc, n) => {
        acc[n] = (acc[n] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      niche = Object.entries(nicheCounts).sort((a, b) => b[1] - a[1])[0][0];
      logger.info({ niche, source: 'CSV column' }, 'Using niche from CSV column');
    } else {
      logger.error('Niche must be provided either via --niche flag or niche/category column in CSV');
      process.exit(1);
    }

    validLocations = locationsWithPayouts.slice(0, args.limit);
    
    // Import payouts to database for consistency (in case they want to query later)
    // This also normalizes the data
    for (const loc of validLocations) {
      const normalizedCity = normalizeCity(loc.city);
      const normalizedState = normalizeState(loc.state);
      const normalizedZip = loc.zip ? loc.zip.trim() : null;

      try {
        const existing = await prisma.payout.findFirst({
          where: {
            city: normalizedCity,
            state: normalizedState,
            zip: normalizedZip,
          },
        });

        if (existing) {
          await prisma.payout.update({
            where: { id: existing.id },
            data: { payout: loc.payout },
          });
        } else {
          await prisma.payout.create({
            data: {
              city: normalizedCity,
              state: normalizedState,
              zip: normalizedZip || undefined,
              payout: loc.payout,
            },
          });
        }
      } catch (error) {
        logger.warn({ error, location: loc }, 'Error saving payout to database');
      }
    }
  } else {
    // Mode 2: Separate cities and revenue files (original approach)
    if (!args.cities) {
      logger.error('Either --data or --cities must be provided');
      process.exit(1);
    }

    if (!args.niche) {
      logger.error('--niche is required when using separate cities/revenue files');
      process.exit(1);
    }

    niche = args.niche;

    // Load locations
    const locations = loadLocations(args.cities).slice(0, args.limit);
    logger.info({ count: locations.length }, 'Loaded locations');

    // Import payouts if provided
    if (args.revenue) {
      const imported = await importPayoutsFromCSV(args.revenue);
      logger.info({ imported }, 'Imported payouts');
    }

    // Filter locations to those with payouts
    for (const loc of locations) {
      const payout =
        (await getPayoutForLocation(loc.city, loc.state, loc.zip)) ||
        args.payout ||
        null;

      if (payout) {
        validLocations.push({ ...loc, payout });
      }
    }

    logger.info(
      { valid: validLocations.length, total: locations.length },
      'Filtered locations with payouts'
    );

    if (validLocations.length === 0) {
      logger.error('No valid locations with payouts found');
      process.exit(1);
    }
  }

  // Load keyword taxonomy
  const taxonomy = await loadKeywordTaxonomy(niche);
  const intentWeights = loadIntentWeights();
  const allKeywords = getAllKeywords(taxonomy);

  // Create run
  const run = await prisma.run.create({
    data: {
      niche,
      payout: args.payout || validLocations[0]?.payout || 0,
      status: 'running',
    },
  });

  logger.info({ runId: run.id }, 'Created run');

  // Get conversion rates from env or args
  const ctr = args.ctr || parseFloat(process.env.CTR || '0.05');
  const siteConv =
    args.siteconv || parseFloat(process.env.SITE_CONV || '0.03');
  const leadConv =
    args.leadconv || parseFloat(process.env.LEAD_CONV || '0.30');
  const alpha = parseFloat(process.env.ALPHA || '0.6');
  const beta = parseFloat(process.env.BETA || '0.4');

  // Process each location
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Starting analysis for ${validLocations.length} locations`);
  console.log(`${'='.repeat(60)}\n`);
  
  let locationCount = 0;
  for (const loc of validLocations) {
    locationCount++;
    try {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`📍 [${locationCount}/${validLocations.length}] Processing: ${loc.city}, ${loc.state} ${loc.zip ? `(${loc.zip})` : ''}`);
      console.log(`   Payout: $${loc.payout.toFixed(2)} per lead`);
      console.log(`${'─'.repeat(60)}`);
      
      logger.info(
        { city: loc.city, state: loc.state, zip: loc.zip },
        'Processing location'
      );

      // Fetch volumes for all keywords (and track CPC)
      console.log(`   📊 Fetching keyword volumes for ${allKeywords.length} keywords...`);
      const volumesByBucket: Record<string, number> = {
        core: 0,
        transactional: 0,
        emergency: 0,
        adjacency: 0,
      };
      const keywordDataMap: Record<string, { volume: number; cpc?: number }> = {};

      let keywordCount = 0;
      for (const [bucket, keywords] of Object.entries(taxonomy)) {
        for (const keyword of keywords as string[]) {
          keywordCount++;
          console.log(`   [${keywordCount}/${allKeywords.length}] Fetching: "${keyword}" in ${loc.city}, ${loc.state}...`);
          
          const result = await getLocalVolume(keyword, loc.city, loc.state);
          volumesByBucket[bucket] += result.volume;
          
          // Store keyword data with CPC if available
          const cpcValue = result.cpc;
          keywordDataMap[keyword] = {
            volume: result.volume,
            cpc: cpcValue, // CPC is now properly extracted from API response
          };
          
          if (result.volume > 0) {
            console.log(`      ✅ Volume: ${result.volume.toLocaleString()}/mo${cpcValue ? `, CPC: $${cpcValue.toFixed(2)}` : ''}`);
          } else {
            console.log(`      ⚠️  No volume data found`);
          }
          
          // Add delay between searches to avoid CAPTCHA (5-10 seconds)
          if (keywords.length > 1) {
            const delayMs = (Math.random() * 5000 + 5000); // 5-10 seconds
            console.log(`      ⏳ Waiting ${(delayMs / 1000).toFixed(1)} seconds before next search...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }
      
      const totalVolume = Object.values(volumesByBucket).reduce((a, b) => a + b, 0);
      console.log(`   ✅ Total volume across all keywords: ${totalVolume.toLocaleString()}/mo`);

      // Select top 2-3 keywords for SERP analysis
      const keywordVolumes = allKeywords.map((kw: string) => ({
        keyword: kw,
        volume: keywordDataMap[kw]?.volume || volumesByBucket[
          Object.keys(taxonomy).find((b) =>
            taxonomy[b as keyof typeof taxonomy].includes(kw)
          ) || 'core'
        ],
        cpc: keywordDataMap[kw]?.cpc,
      }));

      const topKeywords = keywordVolumes
        .sort((a: any, b: any) => b.volume - a.volume)
        .slice(0, 3)
        .map((k: any) => k.keyword);

      // Fetch SERPs for top keywords
      let difficultySignals = null;
      let serpData = null;
      let competitors: any[] = [];
      let competitionStrength = 0;

      if (topKeywords.length > 0) {
        const primaryKeyword = topKeywords[0];
        console.log(`   🔍 Fetching SERP data for primary keyword: "${primaryKeyword}" in ${loc.city}, ${loc.state}...`);
        
        try {
          serpData = await fetchSerpTop(
            primaryKeyword,
            loc.city,
            loc.state
          );
          
          if (serpData && serpData.results && serpData.results.length > 0) {
            console.log(`   ✅ SERP data fetched: ${serpData.results.length} results found`);
            console.log(`   📊 Local pack detected: ${serpData.hasLocalPack ? 'Yes' : 'No'}`);
            
            difficultySignals = extractSignals(
              serpData,
              primaryKeyword,
              loc.city
            );
            
            if (difficultySignals) {
              console.log(`   📈 Extracted difficulty signals successfully`);
            } else {
              console.log(`   ⚠️  Failed to extract difficulty signals from SERP data`);
            }
            
            // Extract and enhance competitor information
            try {
              competitors = extractCompetitorInfo(serpData);
              console.log(`   🏢 Extracted ${competitors.length} competitors from SERP`);
              
              competitors = enhanceCompetitorInfo(competitors);
              competitionStrength = calculateCompetitionStrength(competitors);
              console.log(`   💪 Competition strength: ${competitionStrength.toFixed(1)}/10`);
            } catch (compError: any) {
              console.error(`   ❌ Error extracting competitor info: ${compError.message}`);
              competitors = [];
              competitionStrength = 0;
            }
          } else {
            console.log(`   ⚠️  SERP data returned but no results found`);
          }
        } catch (serpError: any) {
          console.error(`   ❌ Error fetching SERP data: ${serpError.message}`);
          console.error(`   ⚠️  Continuing with default difficulty (0.5)`);
          serpData = null;
          difficultySignals = null;
          competitors = [];
          competitionStrength = 0;
        }
      } else {
        console.log(`   ⚠️  No keywords available for SERP analysis`);
      }

      // Collect related keywords from SERP and similar keywords
      const allRelatedKeywords: string[] = [];
      if (serpData && (serpData as any).relatedKeywords) {
        allRelatedKeywords.push(...(serpData as any).relatedKeywords);
      }

      // Compute scores
      const demandScore = computeDemandScore(
        volumesByBucket,
        taxonomy,
        intentWeights
      );

      // Calculate difficulty with detailed logging
      let difficulty = 0.5; // Default if no SERP data
      if (difficultySignals) {
        difficulty = computeDifficulty(difficultySignals);
        console.log(`   📊 Difficulty signals:`, {
          hasLocalPack: difficultySignals.hasLocalPack,
          aggregatorCount: difficultySignals.aggregatorCount,
          directoryCount: difficultySignals.directoryCount,
          emdCount: difficultySignals.emdCount,
          thinPageRatio: difficultySignals.thinPageRatio,
          avgTitleContainsCity: difficultySignals.avgTitleContainsCity,
          calculatedDifficulty: difficulty.toFixed(3),
        });
      } else {
        console.log(`   ⚠️  No SERP data - using default difficulty 0.5`);
      }

      // Profit calculation will happen AFTER keyword prioritization
      // We'll use only top 3-5 keywords with realistic ranking assumptions
      let profitEst = 0;

      // Process and prioritize keywords with competitor data
      const keywordData = keywordVolumes.map((kv: any) => {
        const intent = getKeywordIntent(kv.keyword, taxonomy);
        // Use competitors from primary keyword SERP for all keywords (simplified approach)
        // In a full implementation, you'd fetch SERP for each keyword
        return {
          keyword: kv.keyword,
          volume: kv.volume,
          cpc: keywordDataMap[kv.keyword]?.cpc || kv.cpc, // Get CPC from keywordDataMap
          intent,
          competitors: competitors,
        };
      });

      const prioritizedKeywords = prioritizeKeywords(
        keywordData,
        difficulty,
        intentWeights,
        10 // Top 10 keywords
      );

      // Calculate realistic profit using ONLY top 3-5 keywords with ranking probability
      // Real-world sites typically rank well for 3-5 main keywords, not all keywords
      const topKeywordsForProfit = prioritizedKeywords.slice(0, 5).filter(kw => kw.volume > 0);
      
      if (topKeywordsForProfit.length > 0) {
        console.log(`   📊 Calculating profit from top ${topKeywordsForProfit.length} keywords...`);
        
        // Calculate profit with ranking probability based on difficulty
        let totalProfit = 0;
        for (const kw of topKeywordsForProfit) {
          // Ranking probability: easier keywords have higher chance of ranking well
          // Difficulty is 0-100, so probability = (100 - difficulty) / 100
          // But we want to be conservative, so use a more realistic curve
          const kwDifficulty = kw.difficulty || (difficulty * 100);
          const rankingProbability = Math.max(0.1, Math.min(0.7, 1 - (kwDifficulty / 100) * 0.6));
          
          // Estimate position based on difficulty (harder = lower position)
          let estimatedPosition = 3; // Default to position 3
          if (kwDifficulty <= 30) {
            estimatedPosition = 2; // Easy keywords might rank #2-3
          } else if (kwDifficulty <= 60) {
            estimatedPosition = 4; // Medium keywords rank #4-5
          } else {
            estimatedPosition = 6; // Hard keywords rank #6-10
          }
          
          // Calculate leads for this keyword at estimated position
          const { calculateLeadEstimates } = await import('@niche-hunter/core');
          const leadEst = calculateLeadEstimates(kw.volume, kw.intent, loc.payout);
          
          // Use position-appropriate estimate
          let keywordProfit = 0;
          if (estimatedPosition <= 3) {
            keywordProfit = leadEst.monthlyValue.realistic; // Position 2-3: realistic estimate
          } else if (estimatedPosition <= 5) {
            keywordProfit = leadEst.monthlyValue.conservative; // Position 4-5: conservative estimate
          } else {
            keywordProfit = leadEst.monthlyValue.conservative * 0.5; // Position 6+: very conservative
          }
          
          // Apply ranking probability (not all keywords will rank well)
          keywordProfit = keywordProfit * rankingProbability;
          totalProfit += keywordProfit;
          
          console.log(`      ${kw.keyword}: $${keywordProfit.toFixed(2)}/mo (vol: ${kw.volume}, difficulty: ${kwDifficulty.toFixed(0)}, pos: ${estimatedPosition}, prob: ${(rankingProbability * 100).toFixed(0)}%)`);
        }
        
        profitEst = Math.round(totalProfit * 100) / 100;
        
        // Validation: flag unrealistic profits
        if (profitEst > 10000) {
          console.log(`   ⚠️  WARNING: Profit estimate ($${profitEst.toFixed(2)}/month) seems unrealistic for this location.`);
          console.log(`   ⚠️  This would require ${(profitEst / loc.payout).toFixed(0)} leads/month. Applying sanity check...`);
          // Cap at reasonable maximum (50 leads/month for top locations)
          const maxReasonableProfit = loc.payout * 50;
          if (profitEst > maxReasonableProfit) {
            profitEst = maxReasonableProfit;
            console.log(`   ✅ Capped profit estimate to $${profitEst.toFixed(2)}/month (50 leads max)`);
          }
        }
        
        console.log(`   💰 Total profit estimate: $${profitEst.toFixed(2)}/month (from ${topKeywordsForProfit.length} top keywords)`);
      } else {
        // Fallback if no keywords with volume
        const totalVolume = Object.values(volumesByBucket).reduce((a, b) => a + b, 0);
        profitEst = computeProfitEstimate(
          totalVolume,
          allKeywords.length,
          loc.payout,
          ctr,
          siteConv,
          leadConv
        );
        console.log(`   💰 Profit estimate (fallback): $${profitEst.toFixed(2)}/month`);
      }

      // Calculate lead estimates for top keywords (for display purposes)
      const topKeywordMetrics = prioritizedKeywords.slice(0, 5);
      const aggregateLeadEstimates = calculateAggregateLeadEstimates(
        topKeywordMetrics.map(kw => ({
          keyword: kw.keyword,
          volume: kw.volume,
          difficulty: kw.difficulty,
          intent: kw.intent,
        })),
        loc.payout
      );

      // Now calculate breakdown and final score with the profit estimate
      const breakdown = computeScoreBreakdown(
        demandScore,
        difficulty,
        profitEst,
        alpha,
        beta
      );

      const finalScore = computeFinalScore(breakdown.opportunity, profitEst);

      // Estimate time to rank (always provide a value, never null)
      const timeToRank = estimateTimeToRank(difficulty, competitionStrength) || '4-8 months';

      // Prepare competitor breakdown data
      const competitorBreakdown = {
        total: competitors.length,
        aggregators: competitors.filter((c: any) => c.type === 'aggregator').length,
        directories: competitors.filter((c: any) => c.type === 'directory').length,
        leadGen: competitors.filter((c: any) => c.type === 'lead-gen').length,
        localBusiness: competitors.filter((c: any) => c.type === 'local-business').length,
        unknown: competitors.filter((c: any) => c.type === 'unknown').length,
        topCompetitors: competitors.slice(0, 5).map((c: any) => ({
          domain: c.domain,
          type: c.type,
          position: c.position,
          estimatedDA: c.estimatedDA,
          contentQuality: c.contentQuality,
        })),
      };

      // Store scan
      const scan = await prisma.scan.create({
        data: {
          runId: run.id,
          city: normalizeCity(loc.city),
          state: normalizeState(loc.state),
          zip: loc.zip ? loc.zip.trim() : undefined,
          keyword: topKeywords[0] || allKeywords[0],
          serpJson: serpData ? (serpData as any) : null,
          signalsJson: difficultySignals ? (difficultySignals as any) : null,
          competitorJson: competitorBreakdown as any,
          relatedKeywords: allRelatedKeywords.length > 0 ? allRelatedKeywords.join(', ') : null,
          demandScore,
          difficulty,
          opportunity: breakdown.opportunity,
          profitEst,
          classification: breakdown.classification,
          keywords: topKeywords.slice(0, 5).join(', '),
          timeToRank: timeToRank || '4-8 months', // Ensure never null
          competitionStrength: competitionStrength || 0, // Ensure never null
        },
      });

      // Store keyword metrics (with CPC if available)
      console.log(`   💾 Saving ${prioritizedKeywords.length} keyword metrics to database...`);
      for (const kwMetric of prioritizedKeywords) {
        // Find CPC from keywordDataMap (this is the source of truth)
        const keywordInfo = keywordDataMap[kwMetric.keyword];
        const cpcValue = keywordInfo?.cpc;
        
        try {
          await prisma.keyword.create({
            data: {
              scanId: scan.id,
              keyword: kwMetric.keyword,
              volume: kwMetric.volume,
              difficulty: kwMetric.difficulty,
              cpc: cpcValue, // Store CPC value (number or null)
              intent: kwMetric.intent,
              priority: kwMetric.priority,
            },
          });
        } catch (dbError: any) {
          console.error(`   ❌ Failed to save keyword "${kwMetric.keyword}": ${dbError.message}`);
        }
      }
      console.log(`   ✅ Keyword metrics saved successfully`);

      console.log(`\n   ✅ Completed: ${loc.city}, ${loc.state}`);
      console.log(`      Opportunity: ${breakdown.opportunity.toFixed(3)} | Demand: ${demandScore.toFixed(3)} | Difficulty: ${difficulty.toFixed(3)} (${breakdown.classification})`);
      console.log(`      Profit Est: $${profitEst.toFixed(2)}/month | Time to Rank: ${timeToRank}`);
      
      logger.info(
        {
          city: loc.city,
          demand: demandScore,
          difficulty,
          opportunity: breakdown.opportunity,
          profitEst,
        },
        'Completed location'
      );
    } catch (error: any) {
      console.error(`\n   ❌ ERROR processing ${loc.city}, ${loc.state}: ${error.message}`);
      logger.error({ error, location: loc }, 'Error processing location');
    }
  }

  // Update run status
  await prisma.run.update({
    where: { id: run.id },
    data: { status: 'completed' },
  });

  // Get top 3
  const top3 = await prisma.scan.findMany({
    where: { runId: run.id },
    orderBy: { opportunity: 'desc' },
    take: 3,
  });

  logger.info({ runId: run.id, top3: top3.map((s) => s.city) }, 'Run completed');

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Analysis Complete!`);
  console.log(`${'='.repeat(60)}\n`);
  
  console.log('=== Top 3 Opportunities ===\n');
  for (let i = 0; i < top3.length; i++) {
    const scan = top3[i];
    console.log(`${i + 1}. ${scan.city}, ${scan.state} ${scan.zip ? `(${scan.zip})` : ''}`);
    console.log(`   Opportunity Score: ${scan.opportunity.toFixed(3)}`);
    console.log(`   Demand: ${scan.demandScore.toFixed(3)} | Difficulty: ${scan.difficulty.toFixed(3)} (${scan.classification || 'N/A'})`);
    console.log(`   Estimated Monthly Profit: $${scan.profitEst?.toFixed(2) || 'N/A'}`);
    console.log(`   Time to Rank: ${scan.timeToRank || 'N/A'}`);
    if (scan.competitionStrength !== null) {
      console.log(`   Competition Strength: ${scan.competitionStrength.toFixed(1)}/10`);
    }
    console.log(`   Top Keywords: ${scan.keywords || 'N/A'}`);
    console.log('');
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊 Run ID: ${run.id}`);
  console.log(`💡 View results in dashboard or export with:`);
  console.log(`   npx niche-hunter export --run ${run.id} --out ./report.csv`);
  console.log(`${'─'.repeat(60)}\n`);
}

