import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import type { Page } from 'puppeteer';
import { prisma } from '@niche-hunter/db';

// Load .env file explicitly to ensure all environment variables are available
// Check multiple possible locations - prioritize .env over .env.local to get API key
// Note: process.cwd() in Next.js API routes returns apps/web, so we need to go up to project root
// Use cross-platform path detection that works on both Windows and Unix
const cwd = process.cwd();
const normalizedCwd = cwd.replace(/\\/g, '/'); // Normalize to forward slashes for comparison
const projectRoot = (normalizedCwd.includes('apps') && normalizedCwd.includes('web'))
  ? path.resolve(cwd, '..', '..')
  : cwd;

console.log(`🔍 Environment loading - process.cwd(): ${cwd}`);
console.log(`🔍 Environment loading - projectRoot: ${projectRoot}`);

const envPaths = [
  path.join(projectRoot, '.env'),              // Root .env (has API key)
  path.join(projectRoot, 'apps/web/.env'),     // apps/web/.env
  path.join(projectRoot, '.env.local'),        // Root .env.local
  path.join(projectRoot, 'apps/web/.env.local'), // apps/web/.env.local
  path.join(cwd, '.env'),                     // Fallback: current dir .env
  path.join(cwd, '.env.local'),                // Fallback: current dir .env.local
];

for (const envPath of envPaths) {
  const exists = fs.existsSync(envPath);
  if (exists) {
    const result = dotenv.config({ path: envPath, override: false });
    if (result.error) {
      console.warn(`⚠️  Failed to load ${envPath}: ${result.error.message}`);
    } else {
      console.log(`✅ Loaded environment from: ${envPath}`);
      // Log if API key was found in this file
      if (result.parsed && result.parsed.SEARCHATLAS_API_KEY) {
        console.log(`   🔑 Found SEARCHATLAS_API_KEY in ${path.basename(envPath)} (length: ${result.parsed.SEARCHATLAS_API_KEY.length})`);
        // Explicitly set it in process.env
        process.env.SEARCHATLAS_API_KEY = result.parsed.SEARCHATLAS_API_KEY;
        console.log(`   ✅ Set process.env.SEARCHATLAS_API_KEY from ${path.basename(envPath)}`);
      }
    }
  }
}

// Final check - make sure API key is in process.env
if (process.env.SEARCHATLAS_API_KEY) {
  console.log(`✅ SEARCHATLAS_API_KEY is loaded from env (length: ${process.env.SEARCHATLAS_API_KEY.length})`);
} else {
  console.log(`ℹ️  SEARCHATLAS_API_KEY not in env - will check database`);
}

// Ensure Chrome profile environment variables are set
if (!process.env.CHROME_PROFILE_DIR) {
  process.env.CHROME_PROFILE_DIR = 'Profile 1';
  console.log('⚠️  CHROME_PROFILE_DIR not set in .env, defaulting to "Profile 1"');
}
console.log(`🔧 Chrome Profile Configuration: CHROME_PROFILE_DIR=${process.env.CHROME_PROFILE_DIR}`);
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
  calculateAggregateLeadEstimates,
  estimateTimeToRank,
} from '@niche-hunter/core';
import { Location } from '@niche-hunter/core/src/types';
import { parse } from 'csv-parse/sync';
import { spawn } from 'child_process';
import * as os from 'os';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
      r['payout_amount'] ||
      r['Payout_Amount'] ||
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

function normalizeCity(city: string): string {
  return city.trim();
}

function normalizeState(state: string): string {
  return state.trim().toUpperCase().slice(0, 2);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new IncomingForm({
      uploadDir: path.join(process.cwd(), '.tmp'),
      keepExtensions: true,
    });

    // Ensure tmp directory exists
    const tmpDir = path.join(process.cwd(), '.tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const [fields, files] = await new Promise<[any, any]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const niche = Array.isArray(fields.niche) ? fields.niche[0] : fields.niche;
    const useNicheColumn = fields.useNicheColumn === 'true';

    // Read and parse CSV
    const filePath = file.filepath;
    const locationsWithData = loadLocationsWithPayouts(filePath);
    const locationsWithPayouts = locationsWithData.filter((l) => l.payout > 0);

    if (locationsWithPayouts.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'No locations with valid payouts found in CSV' });
    }

    // Determine niche
    let finalNiche: string;
    if (useNicheColumn) {
      const niches = locationsWithPayouts
        .map((l) => l.niche)
        .filter((n): n is string => !!n);
      
      if (niches.length > 0) {
        const nicheCounts = niches.reduce((acc, n) => {
          acc[n] = (acc[n] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        finalNiche = Object.entries(nicheCounts).sort((a, b) => b[1] - a[1])[0][0];
      } else {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'No niche column found in CSV and no niche provided' });
      }
    } else if (niche) {
      finalNiche = niche;
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Niche must be provided' });
    }

    const validLocations = locationsWithPayouts.slice(0, 100);

    // Import payouts to database
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
        // Continue on errors
      }
    }

    // Load keyword taxonomy
    const taxonomy = await loadKeywordTaxonomy(finalNiche);
    const intentWeights = loadIntentWeights();
    const allKeywords = getAllKeywords(taxonomy);

    // Create run and start analysis immediately (no login needed for Keywords Everywhere)
    const run = await prisma.run.create({
      data: {
        niche: finalNiche,
        payout: validLocations[0]?.payout || 0,
        status: 'running',
      },
    });

        // Start analysis in background (don't wait for it)
        console.log('\n🚀 ========================================');
        console.log(`🚀 STARTING ANALYSIS FOR RUN: ${run.id}`);
        console.log(`🚀 Niche: ${finalNiche}`);
        console.log(`🚀 Locations: ${validLocations.length}`);
        console.log(`🚀 Keywords: ${allKeywords.length}`);
        console.log('🚀 ========================================\n');
        
        // Update run with initial progress info
        await prisma.run.update({
          where: { id: run.id },
          data: { notes: `Starting analysis: ${validLocations.length} locations, ${allKeywords.length} keywords` },
        }).catch(() => {}); // Ignore errors
        
        // Open terminal window to show analysis progress
        const openTerminal = () => {
          try {
            const platform = os.platform();
            // Use process.cwd() which works correctly in Next.js API routes
            // process.cwd() in Next.js API routes returns apps/web, so go up to project root
            const cwd = process.cwd();
            const normalizedCwd = cwd.replace(/\\/g, '/');
            const projectRoot = (normalizedCwd.includes('apps') && normalizedCwd.includes('web'))
              ? path.resolve(cwd, '..', '..')
              : cwd;
            
            // Log file path (same as in processAnalysis function)
            const logFilePath = path.join(projectRoot, `analysis-run-${run.id}.log`);
            
            console.log(`[Terminal] Platform: ${platform}`);
            console.log(`[Terminal] process.cwd(): ${cwd}`);
            console.log(`[Terminal] Project root: ${projectRoot}`);
            console.log(`[Terminal] Log file: ${logFilePath}`);
            
            if (platform === 'win32') {
              // Windows: Open PowerShell in new window that tails the log file
              const psScript = `
                cd "${projectRoot}"
                $host.UI.RawUI.WindowTitle = "Analysis Log: ${run.id} - ${finalNiche}"
                Clear-Host
                Write-Host "========================================" -ForegroundColor Cyan
                Write-Host "Analysis Running - Live Logs" -ForegroundColor Green
                Write-Host "Run ID: ${run.id}" -ForegroundColor Yellow
                Write-Host "Niche: ${finalNiche}" -ForegroundColor Yellow
                Write-Host "Log File: analysis-run-${run.id}.log" -ForegroundColor Gray
                Write-Host "========================================" -ForegroundColor Cyan
                Write-Host ""
                Write-Host "Waiting for log file to be created..." -ForegroundColor Gray
                
                # Wait for log file to exist (max 30 seconds)
                $logFile = "${logFilePath}"
                $timeout = 30
                $elapsed = 0
                while (-not (Test-Path $logFile) -and $elapsed -lt $timeout) {
                  Start-Sleep -Seconds 1
                  $elapsed++
                }
                
                if (Test-Path $logFile) {
                  Write-Host "Log file found! Following logs..." -ForegroundColor Green
                  Write-Host ""
                  # Tail the log file with Get-Content -Wait -Tail 0
                  Get-Content $logFile -Wait -Tail 0
                } else {
                  Write-Host "Log file not found after $timeout seconds." -ForegroundColor Red
                  Write-Host "The analysis may have already completed or there was an error." -ForegroundColor Yellow
                  Write-Host ""
                  Write-Host "Press any key to close this window..." -ForegroundColor Gray
                  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                }
              `.trim();
              
              // Write script to temp file to avoid quoting issues
              const tempScript = path.join(projectRoot, `temp-analysis-${run.id}.ps1`);
              require('fs').writeFileSync(tempScript, psScript, 'utf8');
              
              console.log(`[Terminal] Opening PowerShell window with script: ${tempScript}`);
              
              // Use start command to open in new window
              const child = spawn('powershell.exe', [
                '-NoExit',
                '-ExecutionPolicy', 'Bypass',
                '-File', tempScript
              ], {
                detached: true,
                stdio: 'ignore',
                windowsVerbatimArguments: false,
                cwd: projectRoot
              });
              
              child.unref(); // Allow parent process to exit independently
              
              // Clean up temp script after a delay
              setTimeout(() => {
                try {
                  if (require('fs').existsSync(tempScript)) {
                    require('fs').unlinkSync(tempScript);
                  }
                } catch (e) {
                  // Ignore cleanup errors
                }
              }, 5000);
              
              console.log('✅ Opened PowerShell window for analysis progress');
            } else {
              // Unix/Mac: Open terminal with tail -f
              const terminal = process.env.TERM || 'xterm';
              const command = `cd "${projectRoot}" && echo "Analysis running for Run ID: ${run.id}" && tail -f analysis-run-${run.id}.log 2>/dev/null || echo "Waiting for log file..." && sleep 5 && tail -f analysis-run-${run.id}.log`;
              const child = spawn(terminal, ['-e', 'bash', '-c', command], {
                detached: true,
                stdio: 'ignore'
              });
              child.unref();
              console.log('✅ Opened terminal window for analysis progress');
            }
          } catch (error: any) {
            console.error('⚠️  Could not open terminal window:', error.message);
            console.error('⚠️  Error stack:', error.stack);
            // Continue anyway - terminal opening is optional
          }
        };
        
        // Open terminal before starting analysis
        openTerminal();
        
        processAnalysis(run.id, validLocations, taxonomy, intentWeights, allKeywords, finalNiche).catch(
          (error: any) => {
            console.error('\n❌ ========================================');
            console.error(`❌ ANALYSIS ERROR FOR RUN: ${run.id}`);
            console.error('❌ Error:', error);
            console.error('❌ Stack:', error.stack);
            console.error('❌ ========================================\n');
            prisma.run.update({
              where: { id: run.id },
              data: { status: 'error', notes: `Error: ${error.message}` },
            }).catch(updateErr => {
              console.error('Failed to update run status:', updateErr);
            });
          }
        );

    // Clean up temp file
    fs.unlinkSync(filePath);

    return res.status(200).json({ 
      runId: run.id,
      message: 'Analysis started - using Keywords Everywhere extension',
      niche: finalNiche,
      locations: validLocations.length,
      status: 'running'
    });
  } catch (error: any) {
    console.error('Create run error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create run' });
  }
}

// Store cancellation state in memory for fast checking
export const cancellationFlags = new Map<string, boolean>();

export async function processAnalysis(
  runId: string,
  locations: Array<Location & { payout: number }>,
  taxonomy: any,
  intentWeights: any,
  allKeywords: string[],
  niche: string
) {
  // Initialize cancellation flag for this run
  cancellationFlags.set(runId, false);
  
  // Reset global cancellation flag when starting a new analysis
  const { setGlobalCancellation } = await import('@niche-hunter/crawler');
  setGlobalCancellation(false);

  const ctr = parseFloat(process.env.CTR || '0.05');
  const siteConv = parseFloat(process.env.SITE_CONV || '0.03');
  const leadConv = parseFloat(process.env.LEAD_CONV || '0.30');
  const alpha = parseFloat(process.env.ALPHA || '0.6');
  const beta = parseFloat(process.env.BETA || '0.4');

  // Helper function to check cancellation (fast, no DB call)
  const isCancelled = () => cancellationFlags.get(runId) === true;

  // Set up log file for this run
  const logFilePath = path.join(process.cwd(), '..', '..', `analysis-run-${runId}.log`);
  const logToFile = (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    try {
      fs.appendFileSync(logFilePath, logMessage);
    } catch (e) {
      // Ignore log file errors
    }
  };
  
  logToFile(`========================================`);
  logToFile(`Starting analysis for ${locations.length} locations`);
  logToFile(`Niche: ${niche}`);
  logToFile(`Total keywords: ${allKeywords.length}`);
  logToFile(`Log file: ${logFilePath}`);
  logToFile(`========================================`);
  
  console.log(`\n[Run ${runId}] ========================================`);
  console.log(`[Run ${runId}] Starting analysis for ${locations.length} locations...`);
  console.log(`[Run ${runId}] Niche: ${niche}`);
  console.log(`[Run ${runId}] Total keywords to process: ${allKeywords.length}`);
  console.log(`[Run ${runId}] 📝 Logs also being written to: ${logFilePath}`);
  
  if (allKeywords.length === 0) {
    console.error(`[Run ${runId}] ❌ ERROR: No keywords found! Taxonomy might be empty.`);
    await prisma.run.update({
      where: { id: runId },
      data: { status: 'error', notes: 'No keywords found in taxonomy' },
    });
    return;
  }
  
  console.log(`[Run ${runId}] First 5 keywords: ${allKeywords.slice(0, 5).join(', ')}`);

  // PHASE 1: Validate keywords at broad (national) level
  // This filters out low-volume keywords before checking location-specific volumes
  console.log(`\n[Run ${runId}] 🔍 Phase 1: Validating keywords at broad (national) level...`);
  const { validateBroadKeywords } = await import('@niche-hunter/crawler');
  
  let validatedKeywordsSet = new Set<string>(allKeywords);
  let validationResult: any = null;
  
  try {
    validationResult = await validateBroadKeywords(niche, allKeywords, true); // true = discover related keywords
    validatedKeywordsSet = new Set(validationResult.validated.map((v: any) => v.keyword));
    
    console.log(`[Run ${runId}] ✅ Validation complete:`);
    console.log(`   📊 Validated: ${validationResult.stats.validated}/${validationResult.stats.total} keywords`);
    console.log(`   🔗 Discovered: ${validationResult.stats.discovered} additional keywords`);
    console.log(`   ❌ Rejected: ${validationResult.stats.rejected}/${validationResult.stats.total} keywords`);
    console.log(`   📦 From cache: ${validationResult.stats.fromCache} keywords`);
    console.log(`   📡 From API: ${validationResult.stats.fromAPI} keywords`);
    
    if (validationResult.stats.rejected > 0) {
      console.log(`[Run ${runId}] ⚠️  ${validationResult.stats.rejected} keywords rejected due to low volume`);
    }
    
    // Filter taxonomy to only include validated keywords
    for (const bucket in taxonomy) {
      taxonomy[bucket] = (taxonomy[bucket] as string[]).filter((kw: string) => validatedKeywordsSet.has(kw));
    }
    
    // Add discovered keywords to adjacency bucket (they're related but not in original taxonomy)
    if (validationResult.discovered && validationResult.discovered.length > 0) {
      if (!taxonomy['adjacency']) {
        taxonomy['adjacency'] = [];
      }
      const discoveredKeywords = validationResult.discovered.map((v: any) => v.keyword);
      taxonomy['adjacency'] = [...taxonomy['adjacency'], ...discoveredKeywords];
      console.log(`[Run ${runId}] 🔗 Added ${discoveredKeywords.length} discovered keywords to adjacency bucket`);
    }
    
    // Update run notes with validation stats
    const totalKeywords = validationResult.stats.validated + validationResult.stats.discovered;
    await prisma.run.update({
      where: { id: runId },
      data: { 
        notes: `Validated ${validationResult.stats.validated} + discovered ${validationResult.stats.discovered} keywords (${totalKeywords} total). Processing ${locations.length} locations...` 
      },
    }).catch(() => {});
  } catch (error: any) {
    console.error(`[Run ${runId}] ⚠️  Keyword validation failed: ${error.message}`);
    console.log(`[Run ${runId}] 💡 Proceeding with all keywords (validation failed)`);
    // Continue with all keywords if validation fails
  }

  // Recalculate keywords from filtered taxonomy
  const keywordsToProcess = getAllKeywords(taxonomy);
  console.log(`[Run ${runId}] 📝 Processing ${keywordsToProcess.length} validated keywords across ${locations.length} locations`);

  // Check if API is available (no browser needed)
  // This now checks both environment variables and database
  const { shouldUseSearchAtlasAPI, shouldUseKeywordsEverywhereAPI } = await import('@niche-hunter/crawler');
  
  console.log(`[Run ${runId}] 🔍 Checking for API availability (env + database)...`);
  
  const useKeywordsEverywhereAPI = await shouldUseKeywordsEverywhereAPI();
  const useSearchAtlasAPI = !useKeywordsEverywhereAPI && await shouldUseSearchAtlasAPI();
  const useAPI = useKeywordsEverywhereAPI || useSearchAtlasAPI;
  
  if (useKeywordsEverywhereAPI) {
    console.log(`[Run ${runId}] ✅ Keywords Everywhere API available - will skip browser initialization`);
    await prisma.run.update({
      where: { id: runId },
      data: { notes: 'Using Keywords Everywhere API (no browser needed)...' },
    }).catch(() => {});
  } else if (useSearchAtlasAPI) {
    console.log(`[Run ${runId}] ✅ SearchAtlas API available - will skip browser initialization`);
    await prisma.run.update({
      where: { id: runId },
      data: { notes: 'Using SearchAtlas API (no browser needed)...' },
    }).catch(() => {});
  } else {
    console.log(`[Run ${runId}] ⚠️  No API available - using browser method`);
    console.log(`[Run ${runId}] 💡 To use API: Add KEYWORDS_EVERYWHERE_API_KEY=your_key to .env or Settings`);
    // Update run status with progress
    await prisma.run.update({
      where: { id: runId },
      data: { notes: 'Initializing Chrome browser...' },
    }).catch(() => {});
  }

  // Get browser context once for all locations (reuses Chrome connection)
  // Only needed if not using API
  let browserContext;
  if (!useAPI) {
    console.log(`[Run ${runId}] Initializing browser context...`);
    try {
      const { initBrowserContext } = await import('@niche-hunter/crawler');
      browserContext = await initBrowserContext();
      console.log(`[Run ${runId}] ✅ Browser context initialized successfully`);
      console.log(`[Run ${runId}] Starting to process locations...\n`);
      
      // Update run with progress
      await prisma.run.update({
        where: { id: runId },
        data: { notes: `Chrome ready. Processing ${locations.length} locations...` },
      }).catch(() => {});
    } catch (error: any) {
      console.error(`[Run ${runId}] ❌ Failed to initialize browser context:`, error);
      console.error(`[Run ${runId}] Error details:`, error.stack || error.message);
      await prisma.run.update({
        where: { id: runId },
        data: { status: 'error', notes: `Browser initialization failed: ${error.message}` },
      }).catch(updateError => {
        console.error(`[Run ${runId}] Failed to update status to error:`, updateError);
      });
      // Don't throw - the error is already logged and status updated
      return;
    }
  } else {
    console.log(`[Run ${runId}] Starting to process locations...\n`);
    await prisma.run.update({
      where: { id: runId },
      data: { notes: `Processing ${locations.length} locations with SearchAtlas API...` },
    }).catch(() => {});
  }

  // Track previous location data to detect identical results
  let previousLocationData: {
    city: string;
    state: string;
    totalVolume: number;
    demandScore: number;
    profitEst: number;
  } | null = null;

  for (const loc of locations) {
    // Check cancellation flag (fast check)
    if (isCancelled()) {
      console.log(`\n⛔ Analysis cancelled by user. Stopping at ${loc.city}, ${loc.state}.`);
      break;
    }
    
    // Also check database to sync with cancellation
    const currentRun = await prisma.run.findUnique({ where: { id: runId } });
    if (currentRun?.status === 'cancelled') {
      cancellationFlags.set(runId, true);
      console.log(`\n⛔ Analysis cancelled by user. Stopping at ${loc.city}, ${loc.state}.`);
      break;
    }

    try {
      console.log(`\n📍 Processing: ${loc.city}, ${loc.state}${loc.zip ? ` (${loc.zip})` : ''}`);
      console.log(`   Payout: $${loc.payout}`);
      
      // Update run with progress
      await prisma.run.update({
        where: { id: runId },
        data: { notes: `Processing ${loc.city}, ${loc.state}...` },
      }).catch(() => {});
      
      // Fetch volumes for all validated keywords in this location
      console.log(`   🔍 Fetching search volumes for ${keywordsToProcess.length} keywords...`);
      const volumesByBucket: Record<string, number> = {
        core: 0,
        transactional: 0,
        emergency: 0,
        adjacency: 0,
      };

      // Track keyword data (volume + CPC) for all keywords
      const keywordDataMap = new Map<string, { volume: number; cpc?: number; bucket: string }>();

      // Reuse a single page for all volume lookups to avoid opening tons of tabs (only if using browser)
      let volumePage: Page | undefined = undefined;
      if (!useAPI && browserContext) {
        console.log(`   📄 Creating browser page for volume lookups...`);
        volumePage = await browserContext.newPage();
        console.log(`   ✅ Browser page created`);
      }
      let keywordCount = 0;
      
      // Track discovered keywords from Keywords Everywhere (deduplicated)
      const discoveredKeywordsSet = new Set<string>();
      const discoveredKeywords: string[] = [];
      
      // Use niche passed to function
      const runNiche = niche;
      
      console.log(`   🔑 Starting keyword volume fetching for ${Object.keys(taxonomy).length} buckets...`);
      try {
        for (const [bucket, keywords] of Object.entries(taxonomy)) {
          console.log(`   📦 Processing bucket "${bucket}" with ${(keywords as string[]).length} keywords...`);
          const bucketKeywords = keywords as string[];
          console.log(`   📝 Keywords in this bucket: ${bucketKeywords.slice(0, 5).join(', ')}${bucketKeywords.length > 5 ? '...' : ''}`);
          
          for (const keyword of bucketKeywords) {
            console.log(`   🔑 [Bucket: ${bucket}] Processing keyword: "${keyword}"`);
            // Check cancellation flag (fast check before each keyword)
            if (isCancelled()) {
              throw new Error('Analysis cancelled by user');
            }
            
            // Also verify with database occasionally
            if (keywordCount % 5 === 0) {
              const checkRun = await prisma.run.findUnique({ where: { id: runId } });
              if (checkRun?.status === 'cancelled') {
                cancellationFlags.set(runId, true);
                throw new Error('Analysis cancelled by user');
              }
            }

            keywordCount++;
            try {
              // Check cancellation before delay
              if (isCancelled()) {
                throw new Error('Analysis cancelled by user');
              }
              
              // Add delay between searches to avoid rate limiting (check cancellation during delay)
              if (keywordCount > 1) {
                // Split delay into smaller chunks so we can check cancellation
                for (let i = 0; i < 6; i++) {
                  await new Promise(resolve => setTimeout(resolve, 500)); // 500ms chunks = 3 seconds total
                  if (isCancelled()) {
                    throw new Error('Analysis cancelled by user');
                  }
                }
              }
              
              // Get volume and similar keywords - will use cached if available, otherwise fetch with Keywords Everywhere
              // Pass volumePage to reuse the same tab instead of opening new ones
              // Pass isCancelled so long operations can check for cancellation
              // Pass niche to enable similar keyword extraction
              console.log(`      🔍 [${keywordCount}/${keywordsToProcess.length}] Fetching volume for "${keyword}" in ${loc.city}, ${loc.state}...`);
              if (volumePage) {
                try {
                  const currentUrl = await volumePage.url();
                  console.log(`      📊 Page state before getLocalVolume: URL=${currentUrl}, isClosed=${volumePage.isClosed()}`);
                } catch (e) {
                  console.log(`      ⚠️  Could not get page URL: ${(e as Error).message}`);
                }
              }
              
              const startTime = Date.now();
              
              // Update run notes to show progress
              await prisma.run.update({
                where: { id: runId },
                data: { notes: `Searching "${keyword}" in ${loc.city}, ${loc.state}...` },
              }).catch(() => {});
              
              console.log(`      🚀 Calling getLocalVolume now...`);
              const result = await getLocalVolume(
                keyword, 
                loc.city, 
                loc.state, 
                volumePage, 
                isCancelled,
                runNiche
              );
              const duration = ((Date.now() - startTime) / 1000).toFixed(1);
              console.log(`      ✅ [${keywordCount}/${keywordsToProcess.length}] Volume fetch complete: ${result.volume} (took ${duration}s)`);
              try {
                if (volumePage) {
                  const afterUrl = await volumePage.url();
                  console.log(`      📊 Page state after getLocalVolume: URL=${afterUrl}, isClosed=${volumePage.isClosed()}`);
                }
              } catch (e) {
                console.log(`      ⚠️  Could not get page URL after: ${(e as Error).message}`);
              }
              
              const volume = result.volume;
              const cpc = result.cpc;
              
              // Store keyword data (volume + CPC)
              keywordDataMap.set(keyword, { volume, cpc, bucket });
              
              const cpcMsg = cpc ? ` | CPC: $${cpc.toFixed(2)}` : '';
              const logMsg = `Volume for "${keyword}": ${volume}${cpcMsg} (bucket: ${bucket}, total: ${volumesByBucket[bucket] + volume})`;
              console.log(`      📊 ${logMsg}`);
              logToFile(`   ${logMsg}`);
              volumesByBucket[bucket] += volume;
              
              // Collect discovered keywords (deduplicate)
              if (result.similarKeywords && result.similarKeywords.length > 0) {
                for (const discoveredKw of result.similarKeywords) {
                  const kwLower = discoveredKw.toLowerCase().trim();
                  // Only add if not already in taxonomy and not already discovered
                  const existsInTaxonomy = allKeywords.some((kw: string) => kw.toLowerCase() === kwLower);
                  if (!existsInTaxonomy && !discoveredKeywordsSet.has(kwLower)) {
                    discoveredKeywordsSet.add(kwLower);
                    discoveredKeywords.push(discoveredKw);
                  }
                }
              }
              
              if (volume > 0) {
                console.log(`      [${keywordCount}/${keywordsToProcess.length}] ✅ "${keyword}": ${volume} searches/month`);
              } else {
                console.log(`      [${keywordCount}/${keywordsToProcess.length}] 📦 "${keyword}": ${volume} (cached or no data)`);
              }
            } catch (error: any) {
              if (error.message?.includes('cancelled')) {
                throw error; // Re-throw cancellation errors
              }
              console.error(`      ❌ [${keywordCount}/${keywordsToProcess.length}] VOLUME FETCH FAILED for "${keyword}"`);
              console.error(`      ❌ Error: ${error.message}`);
              console.error(`      ❌ Stack: ${error.stack}`);
              console.error(`      ❌ Location: ${loc.city}, ${loc.state}`);
              
              // Log to file for debugging
              logToFile(`   ❌ VOLUME FETCH FAILED: "${keyword}" - ${error.message}`);
              
              // Store 0 volume in map so we don't skip this keyword
              keywordDataMap.set(keyword, { volume: 0, cpc: undefined, bucket });
              
              // Continue - don't let one failure stop entire analysis
            }
          }
        }
        
        // Process discovered keywords (limit to prevent analysis bloat)
        const maxDiscoveredKeywords = 30;
        const discoveredKeywordsToProcess = discoveredKeywords.slice(0, maxDiscoveredKeywords);
        
        if (discoveredKeywordsToProcess.length > 0) {
          console.log(`\n   🔍 Processing ${discoveredKeywordsToProcess.length} discovered keywords from Keywords Everywhere...`);
          
          // Determine bucket for discovered keywords (default to 'adjacency' since they're related but not in original taxonomy)
          const discoveredBucket = 'adjacency';
          
          for (const discoveredKw of discoveredKeywordsToProcess) {
            // Check cancellation
            if (isCancelled()) {
              throw new Error('Analysis cancelled by user');
            }
            
            try {
              // Add small delay
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Get volume for discovered keyword
              const discoveredResult = await getLocalVolume(
                discoveredKw,
                loc.city,
                loc.state,
                volumePage,
                isCancelled,
                runNiche
              );
              
              volumesByBucket[discoveredBucket] += discoveredResult.volume;
              
              // Store keyword data for discovered keywords too
              keywordDataMap.set(discoveredKw, { 
                volume: discoveredResult.volume, 
                cpc: discoveredResult.cpc, 
                bucket: discoveredBucket 
              });
              
              if (discoveredResult.volume > 0) {
                const cpcMsg = discoveredResult.cpc ? ` | CPC: $${discoveredResult.cpc.toFixed(2)}` : '';
                console.log(`      ✨ "${discoveredKw}": ${discoveredResult.volume} searches/month${cpcMsg}`);
              }
            } catch (error: any) {
              if (error.message?.includes('cancelled')) {
                throw error;
              }
              console.error(`      ❌ DISCOVERED KEYWORD FETCH FAILED: "${discoveredKw}"`);
              console.error(`      ❌ Error: ${error.message}`);
              console.error(`      ❌ Stack: ${error.stack}`);
              
              // Store 0 volume for discovered keyword so it's tracked
              keywordDataMap.set(discoveredKw, { volume: 0, cpc: undefined, bucket: discoveredBucket });
            }
          }
          
          // Add discovered keywords to keywordsToProcess for scoring
          keywordsToProcess.push(...discoveredKeywordsToProcess);
        }
        
      } finally {
        // Close the reusable page when done with all volume lookups
        if (volumePage) {
          await volumePage.close();
        }
      }

      // Calculate total volume for logging
      const calculatedTotalVolume = Object.values(volumesByBucket).reduce((a, b) => a + b, 0);
      const volumeSummary = `VOLUME SUMMARY for ${loc.city}, ${loc.state}: Total=${calculatedTotalVolume}, Buckets=${JSON.stringify(volumesByBucket)}`;
      console.log(`   📊 ========================================`);
      console.log(`   📊 ${volumeSummary}`);
      console.log(`   📊 ========================================`);
      logToFile(`   ${volumeSummary}`);

      // HEURISTIC: Detect if top 3 keywords have identical volumes (national bleed indicator)
      // This suggests the API returned the same national volume for different city queries
      const topKeywordVolumes = Array.from(keywordDataMap.entries())
        .map(([kw, data]) => ({ keyword: kw, volume: data.volume }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 3);
      
      if (topKeywordVolumes.length >= 3 && topKeywordVolumes[0].volume > 0) {
        const volumes = topKeywordVolumes.map(k => k.volume);
        const allIdentical = volumes.every(v => v === volumes[0]);
        // If all top keywords have identical volumes > 1000, it's likely national data
        // (Real local queries should vary by city)
        if (allIdentical && volumes[0] > 1000) {
          console.warn(`   ⚠️  [NATIONAL_BLEED_DETECTED] Top 3 keywords all have identical volume ${volumes[0]} - likely national data`);
          console.warn(`   ⚠️  Keywords: ${topKeywordVolumes.map(k => k.keyword).join(', ')}`);
          console.warn(`   ⚠️  This suggests the API returned national volumes instead of city-specific volumes`);
          console.warn(`   ⚠️  Setting all to 0 to prevent inflated scores`);
          // Set all to 0
          topKeywordVolumes.forEach(k => {
            keywordDataMap.set(k.keyword, { ...keywordDataMap.get(k.keyword)!, volume: 0 });
            // Also update volumesByBucket
            const bucket = keywordDataMap.get(k.keyword)?.bucket || 'core';
            volumesByBucket[bucket] -= k.volume;
          });
        }
      }

      // Select top keywords based on volume (from keywordDataMap, not buckets)
      const keywordVolumes = keywordsToProcess.map((kw: string) => {
        const data = keywordDataMap.get(kw);
        return {
          keyword: kw,
          volume: data?.volume || volumesByBucket[
            Object.keys(taxonomy).find((b) =>
              taxonomy[b as keyof typeof taxonomy].includes(kw)
            ) || 'core'
          ],
        };
      });

      const topKeywords = keywordVolumes
        .sort((a: any, b: any) => b.volume - a.volume)
        .slice(0, 3)
        .map((k: any) => k.keyword);

      console.log(`   🎯 Top keywords: ${topKeywords.join(', ')}`);

      // Check cancellation flag before SERP analysis
      if (isCancelled()) {
        throw new Error('Analysis cancelled by user');
      }
      
      // Verify with database
      const checkRunSerp = await prisma.run.findUnique({ where: { id: runId } });
      if (checkRunSerp?.status === 'cancelled') {
        cancellationFlags.set(runId, true);
        throw new Error('Analysis cancelled by user');
      }

      // Fetch SERPs for competitiveness analysis
      let difficultySignals = null;
      let serpData = null;
      let competitors: any[] = [];
      let competitionStrength: number | null = null; // null = failed, 0 = genuinely zero competitors
      let serpError: string | null = null; // Track why SERP failed

      if (topKeywords.length > 0) {
        const primaryKeyword = topKeywords[0];
        console.log(`\n   🔎 ========================================`);
        console.log(`   🔎 STARTING SERP ANALYSIS`);
        console.log(`   🔎 Keyword: "${primaryKeyword}"`);
        console.log(`   🔎 Location: ${loc.city}, ${loc.state}`);
        console.log(`   🔎 ========================================`);
        
        try {
          console.log(`   🌐 Fetching SERP data from Google...`);
          serpData = await fetchSerpTop(primaryKeyword, loc.city, loc.state, browserContext);
          
          if (serpData && serpData.results && serpData.results.length > 0) {
            console.log(`   ✅ SERP data fetched successfully!`);
            console.log(`      📊 Results found: ${serpData.results.length}`);
            console.log(`      📍 Local pack detected: ${serpData.hasLocalPack ? 'Yes ✓' : 'No ✗'}`);
            
            // Extract difficulty signals
            console.log(`   🔍 Extracting difficulty signals...`);
            difficultySignals = extractSignals(serpData, primaryKeyword, loc.city);
            
            if (difficultySignals) {
              console.log(`   ✅ Difficulty signals extracted:`);
              console.log(`      - Aggregators: ${difficultySignals.aggregatorCount}`);
              console.log(`      - Directories: ${difficultySignals.directoryCount}`);
              console.log(`      - EMD/PMD: ${difficultySignals.emdCount}`);
              console.log(`      - Thin pages: ${difficultySignals.thinPageRatio.toFixed(2)}`);
            } else {
              console.error(`   ❌ FAILED to extract difficulty signals from SERP data!`);
            }
            
            // Extract and enhance competitor information
            console.log(`   🏢 Extracting competitor information...`);
            try {
              competitors = extractCompetitorInfo(serpData);
              console.log(`   ✅ Extracted ${competitors.length} competitors from SERP`);
              
              if (competitors.length > 0) {
                console.log(`   🔧 Enhancing competitor data...`);
                competitors = enhanceCompetitorInfo(competitors);
                
                console.log(`   📊 Calculating competition strength...`);
                competitionStrength = calculateCompetitionStrength(competitors);
                console.log(`   💪 Competition strength: ${competitionStrength.toFixed(1)}/10`);
                
                // Log competitor breakdown
                const aggregators = competitors.filter(c => c.isAggregator).length;
                const directories = competitors.filter(c => c.isDirectory).length;
                const leadGen = competitors.filter(c => c.isLeadGenSite).length;
                const local = competitors.filter(c => c.isLocalBusiness).length;
                console.log(`   📋 Competitor breakdown:`);
                console.log(`      - Aggregators: ${aggregators}`);
                console.log(`      - Directories: ${directories}`);
                console.log(`      - Lead Gen Sites: ${leadGen}`);
                console.log(`      - Local Businesses: ${local}`);
              } else {
                console.warn(`   ⚠️  No competitors extracted from SERP!`);
                // Genuinely zero competitors - set to 0 (not null)
                competitionStrength = 0;
              }
            } catch (compError: any) {
              console.error(`   ❌ COMPETITOR EXTRACTION ERROR!`);
              console.error(`   ❌ Error: ${compError.message}`);
              console.error(`   ❌ Stack: ${compError.stack}`);
              competitors = [];
              competitionStrength = null; // null = extraction failed
              serpError = `Competitor extraction failed: ${compError.message}`;
            }
          } else {
            console.error(`   ❌ SERP FETCH FAILED: No results returned!`);
            if (serpData) {
              console.error(`      - serpData exists but results array is empty or missing`);
              console.error(`      - serpData keys: ${Object.keys(serpData).join(', ')}`);
              serpError = `SERP returned empty results (keys: ${Object.keys(serpData).join(', ')})`;
            } else {
              console.error(`      - serpData is null or undefined`);
              serpError = `SERP returned null/undefined`;
            }
            competitionStrength = null; // null = fetch failed
          }
        } catch (serpErrorCaught: any) {
          console.error(`\n   ❌ ========================================`);
          console.error(`   ❌ SERP ANALYSIS FAILED!`);
          console.error(`   ❌ Keyword: "${primaryKeyword}"`);
          console.error(`   ❌ Location: ${loc.city}, ${loc.state}`);
          console.error(`   ❌ Error: ${serpErrorCaught.message}`);
          console.error(`   ❌ Stack: ${serpErrorCaught.stack}`);
          console.error(`   ❌ ========================================\n`);
          
          // Capture full error details
          serpError = `${serpErrorCaught.message}${serpErrorCaught.stack ? `\nStack: ${serpErrorCaught.stack.substring(0, 500)}` : ''}`;
          
          serpData = null;
          difficultySignals = null;
          competitors = [];
          competitionStrength = null; // null = SERP fetch failed
        }
        
        console.log(`   🔎 ========================================`);
        console.log(`   🔎 SERP ANALYSIS COMPLETE`);
        console.log(`   🔎 ========================================\n`);
      } else {
        console.warn(`   ⚠️  SKIPPING SERP ANALYSIS: No keywords available`);
      }

      // Check cancellation flag before saving scan
      if (isCancelled()) {
        throw new Error('Analysis cancelled by user');
      }

      // Compute scores
      const demandScore = computeDemandScore(volumesByBucket, taxonomy, intentWeights);
      
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
      
      // Calculate realistic profit using ONLY top 3-5 keywords with ranking probability
      // This matches the CLI logic - real-world sites rank well for 3-5 main keywords, not all
      const totalVolume = Object.values(volumesByBucket).reduce((a, b) => a + b, 0);
      console.log(`   📊 Total volume across all buckets: ${totalVolume}`);
      console.log(`   📊 Volumes by bucket:`, volumesByBucket);
      console.log(`   📊 Keywords processed: ${keywordsToProcess.length}`);
      
      let profitEst = 0;
      
      // Get top keywords by volume (same as CLI approach)
      const keywordVolumesWithIntent = keywordVolumes.map((kv: any) => {
        const bucket = Object.keys(taxonomy).find((b) =>
          taxonomy[b as keyof typeof taxonomy].includes(kv.keyword)
        ) || 'core';
        const intent = bucket as 'core' | 'transactional' | 'emergency' | 'adjacency';
        return {
          keyword: kv.keyword,
          volume: kv.volume,
          intent,
        };
      }).filter((kw: any) => kw.volume > 0)
        .sort((a: any, b: any) => b.volume - a.volume)
        .slice(0, 5); // Top 5 keywords only
      
      // PROFIT_GUARD: If average volume of top keywords > 2,000 for city query, downscale by 80%
      let volumesWereDownscaled = false;
      if (keywordVolumesWithIntent.length > 0) {
        const avgVolumeBefore = keywordVolumesWithIntent.reduce((sum: number, kw: any) => sum + kw.volume, 0) / keywordVolumesWithIntent.length;
        if (avgVolumeBefore > 2000) {
          volumesWereDownscaled = true;
          console.warn(`   ⚠️  [PROFIT_GUARD] Average volume ${avgVolumeBefore.toFixed(0)} > 2,000 for city query - downscaling by 80%`);
          keywordVolumesWithIntent.forEach((kw: any) => {
            kw.volume = Math.round(kw.volume * 0.2); // Downscale to 20% (80% reduction)
          });
          console.warn(`   ⚠️  [PROFIT_GUARD] Downscaled volumes: ${keywordVolumesWithIntent.map((kw: any) => `${kw.keyword}=${kw.volume}`).join(', ')}`);
        }
      }
      
      if (keywordVolumesWithIntent.length > 0) {
        console.log(`   📊 Calculating profit from top ${keywordVolumesWithIntent.length} keywords...`);
        
        // Calculate profit with ranking probability based on difficulty
        let totalProfit = 0;
        for (const kw of keywordVolumesWithIntent) {
          // Ranking probability: easier keywords have higher chance of ranking well
          const kwDifficulty = difficulty * 100; // Convert 0-1 to 0-100
          const rankingProbability = Math.max(0.1, Math.min(0.7, 1 - (kwDifficulty / 100) * 0.6));
          
          // Estimate position based on difficulty
          let estimatedPosition = 3;
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
            keywordProfit = leadEst.monthlyValue.realistic;
          } else if (estimatedPosition <= 5) {
            keywordProfit = leadEst.monthlyValue.conservative;
          } else {
            keywordProfit = leadEst.monthlyValue.conservative * 0.5;
          }
          
          // Apply ranking probability
          keywordProfit = keywordProfit * rankingProbability;
          totalProfit += keywordProfit;
          
          console.log(`      ${kw.keyword}: $${keywordProfit.toFixed(2)}/mo (vol: ${kw.volume}, difficulty: ${kwDifficulty.toFixed(0)}, pos: ${estimatedPosition}, prob: ${(rankingProbability * 100).toFixed(0)}%)`);
        }
        
        profitEst = Math.round(totalProfit * 100) / 100;
        
        // Validation: flag unrealistic profits
        if (profitEst > 10000) {
          console.log(`   ⚠️  WARNING: Profit estimate ($${profitEst.toFixed(2)}/month) seems unrealistic. Applying sanity check...`);
          const maxReasonableProfit = loc.payout * 50;
          if (profitEst > maxReasonableProfit) {
            profitEst = maxReasonableProfit;
            console.log(`   ✅ Capped profit estimate to $${profitEst.toFixed(2)}/month (50 leads max)`);
          }
        }
        
        console.log(`   💰 Total profit estimate: $${profitEst.toFixed(2)}/month (from ${keywordVolumesWithIntent.length} top keywords)`);
      } else {
        // Fallback if no keywords with volume
        console.log(`   ⚠️  No keywords with volume, using fallback calculation`);
        profitEst = computeProfitEstimate(
          totalVolume,
          keywordsToProcess.length,
          loc.payout,
          0.10,
          0.05,
          0.30
        );
        console.log(`   💰 Profit estimate (fallback): $${profitEst.toFixed(2)}/month`);
      }
      
      // Ensure profitEst is never NaN or undefined
      if (isNaN(profitEst) || profitEst === null || profitEst === undefined) {
        console.log(`   ⚠️  Profit estimate is invalid (${profitEst}), setting to 0`);
        profitEst = 0;
      }

      const breakdown = computeScoreBreakdown(demandScore, difficulty, profitEst, alpha, beta);

      // Estimate time to rank (use 0 if competitionStrength is null)
      const timeToRank = estimateTimeToRank(difficulty, competitionStrength ?? 0) || '4-8 months';

      // Check if volumes were downscaled or rejected
      const volumesRejected = Array.from(keywordDataMap.values()).filter(d => d.volume === 0).length;
      const avgVolume = keywordVolumesWithIntent.length > 0 
        ? keywordVolumesWithIntent.reduce((sum: number, kw: any) => sum + kw.volume, 0) / keywordVolumesWithIntent.length 
        : 0;
      // Use the flag we set earlier
      const volumesDownscaled = volumesWereDownscaled;
      
      // Log bundle per city: Top 5 keywords with volume/CPC, source, and guard status
      console.log(`\n   📋 ========================================`);
      console.log(`   📋 CITY SUMMARY: ${loc.city}, ${loc.state}`);
      console.log(`   📋 ========================================`);
      console.log(`   📋 Top Keywords:`);
      const top5ForLog = keywordVolumesWithIntent.slice(0, 5);
      top5ForLog.forEach((kw: any, idx: number) => {
        const kwData = keywordDataMap.get(kw.keyword);
        const cpc = kwData?.cpc ? `$${kwData.cpc.toFixed(2)}` : 'N/A';
        const source = kwData?.bucket || 'unknown';
        const rejected = kw.volume === 0 ? ' [REJECTED]' : '';
        console.log(`   📋   ${idx + 1}. ${kw.keyword}: ${kw.volume}/mo, CPC: ${cpc}, Source: ${source}${rejected}`);
      });
      console.log(`   📋 Average Volume: ${avgVolume.toFixed(0)}`);
      console.log(`   📋 Volumes Rejected: ${volumesRejected}`);
      console.log(`   📋 Volumes Downscaled: ${volumesDownscaled ? 'Yes' : 'No'}`);
      console.log(`   📋 SERP Fallback Used: ${serpError?.includes('Bing') ? 'Yes (Bing)' : 'No'}`);
      console.log(`   📋 ========================================\n`);
      
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
        serpError: serpError || null, // Track SERP failure reason
        serpFailed: competitionStrength === null, // Boolean flag for UI
        serpFallback: serpError?.includes('Bing') || false, // Track if Bing fallback was used
        volumeGuards: {
          volumesRejected,
          volumesDownscaled,
          avgVolume: Math.round(avgVolume),
        },
      };

      // Store scan with keyword metrics
      // Note: timeToRank and competitionStrength fields don't exist in Scan model
      // These values can be stored in signalsJson if needed for future reference
      const scan = await prisma.scan.create({
        data: {
          runId,
          city: normalizeCity(loc.city),
          state: normalizeState(loc.state),
          zip: loc.zip ? loc.zip.trim() : undefined,
          keyword: topKeywords[0] || keywordsToProcess[0],
          serpJson: serpData ? (serpData as any) : null,
          signalsJson: difficultySignals ? {
            ...(difficultySignals as any),
            timeToRank: timeToRank || null,
            competitionStrength: competitionStrength !== null && competitionStrength !== undefined ? competitionStrength : null,
          } : {
            timeToRank: timeToRank || null,
            competitionStrength: competitionStrength !== null && competitionStrength !== undefined ? competitionStrength : null,
          },
          demandScore,
          difficulty,
          opportunity: breakdown.opportunity,
          profitEst,
          classification: breakdown.classification,
          keywords: topKeywords.slice(0, 5).join(', '),
        },
      });
      
      // Save individual keyword metrics (top 10) for detailed display
      console.log(`   💾 Saving keyword metrics for top ${Math.min(keywordVolumesWithIntent.length, 10)} keywords...`);
      for (const kw of keywordVolumesWithIntent.slice(0, 10)) {
        try {
          // Calculate difficulty for this keyword (0-100 scale)
          const kwDifficulty = Math.round(difficulty * 100);
          
          // Calculate priority (simple formula: volume / (difficulty + 1))
          const priority = Math.round(kw.volume / (kwDifficulty + 1));
          
          // Get CPC from keywordDataMap
          const kwData = keywordDataMap.get(kw.keyword);
          const cpc = kwData?.cpc || null;
          
          if (cpc) {
            console.log(`      💰 "${kw.keyword}": CPC = $${cpc.toFixed(2)}`);
          }
          
          // Note: Keyword model doesn't exist in current schema
          // Keyword data is stored in Scan.keywords field as a comma-separated string
          // Individual keyword metrics are not stored separately in the old schema
          // TODO: Migrate to KeywordV5000 model if needed
          console.log(`      💾 Keyword "${kw.keyword}" metrics: vol=${kw.volume}, difficulty=${kwDifficulty}, cpc=${cpc || 'N/A'}, intent=${kw.intent}, priority=${priority}`);
        } catch (kwError: any) {
          console.error(`   ❌ Failed to save keyword "${kw.keyword}": ${kwError.message}`);
        }
      }
      console.log(`   ✅ Keyword metrics saved`);
      
      // VISIBILITY: Log bundle summarizing accepted keywords
      console.log(`\n   📋 ========================================`);
      console.log(`   📋 KEYWORD SUMMARY for ${loc.city}, ${loc.state}`);
      console.log(`   📋 ========================================`);
      const top5Keywords = keywordVolumesWithIntent.slice(0, 5);
      for (const kw of top5Keywords) {
        const kwData = keywordDataMap.get(kw.keyword);
        const cpc = kwData?.cpc;
        const cpcStr = cpc ? ` | CPC: $${cpc.toFixed(2)}` : '';
        const source = kwData ? 'keywordDataMap' : 'bucket';
        console.log(`   📋   "${kw.keyword}": ${kw.volume.toLocaleString()}/mo${cpcStr} [${source}]`);
      }
      console.log(`   📋 Total accepted keywords: ${keywordVolumesWithIntent.length}`);
      console.log(`   📋 Profit estimate: $${profitEst?.toFixed(2) || '0.00'}/month`);
      if (competitorBreakdown.serpFailed) {
        console.log(`   📋 SERP: Failed (${competitorBreakdown.serpError?.substring(0, 50) || 'unknown error'})`);
      } else {
        console.log(`   📋 SERP: Success (${competitorBreakdown.total || 0} competitors)`);
      }
      console.log(`   📋 ========================================\n`);
      
      // Data validation: Check if this location's data is identical to previous location
      if (previousLocationData) {
        const currentData = {
          totalVolume: calculatedTotalVolume,
          demandScore: demandScore,
          profitEst: profitEst || 0,
        };
        
        const isIdentical = 
          Math.abs(currentData.totalVolume - previousLocationData.totalVolume) < 1 &&
          Math.abs(currentData.demandScore - previousLocationData.demandScore) < 0.001 &&
          Math.abs(currentData.profitEst - previousLocationData.profitEst) < 0.01;
        
        if (isIdentical) {
          console.warn(`\n   ⚠️  ========================================`);
          console.warn(`   ⚠️  IDENTICAL DATA DETECTED!`);
          console.warn(`   ⚠️  Previous: ${previousLocationData.city}, ${previousLocationData.state}`);
          console.warn(`   ⚠️  Current:  ${loc.city}, ${loc.state}`);
          console.warn(`   ⚠️  Both have:`);
          console.warn(`   ⚠️    - Total Volume: ${calculatedTotalVolume}`);
          console.warn(`   ⚠️    - Demand Score: ${demandScore.toFixed(3)}`);
          console.warn(`   ⚠️    - Profit Est: $${profitEst?.toFixed(2) || '0.00'}`);
          console.warn(`   ⚠️  This may indicate:`);
          console.warn(`   ⚠️    1. API returning same volumes for nearby cities`);
          console.warn(`   ⚠️    2. Cache being reused incorrectly`);
          console.warn(`   ⚠️    3. Data not being fetched per-location`);
          console.warn(`   ⚠️  ========================================\n`);
        }
      }
      
      // Update previous location data for next comparison
      previousLocationData = {
        city: loc.city,
        state: loc.state,
        totalVolume: calculatedTotalVolume,
        demandScore: demandScore,
        profitEst: profitEst || 0,
      };
    } catch (error: any) {
      // If cancelled, stop processing
      if (error.message?.includes('cancelled')) {
        console.log(`\n⛔ Analysis cancelled. Stopped processing locations.`);
        break;
      }
      console.error(`Error processing ${loc.city}, ${loc.state}:`, error);
    }
  }

  // Clean up cancellation flag
  cancellationFlags.delete(runId);
  
  // Check final status before marking complete
  const finalRun = await prisma.run.findUnique({ where: { id: runId } });
  if (finalRun?.status === 'cancelled') {
    console.log(`[Run ${runId}] Analysis was cancelled`);
  } else {
    // Update run status only if not cancelled
    await prisma.run.update({
      where: { id: runId },
      data: { status: 'completed' },
    }).catch(err => console.error('Failed to update run to completed:', err));
    
    console.log(`[Run ${runId}] Analysis completed successfully`);
  }
}
