import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';
import { loadKeywordTaxonomy, loadIntentWeights, getAllKeywords } from '@niche-hunter/core';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid run ID' });
  }

  try {
    // Get the run
    const run = await prisma.run.findUnique({
      where: { id },
      include: {
        scans: true,
      },
    });

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (run.status !== 'pending_login') {
      return res.status(400).json({ error: `Run is not pending login. Current status: ${run.status}` });
    }

    // Check if SearchAtlas is ready
    let searchAtlasReady = false;
    try {
      const { initSearchAtlasContext } = await import('@niche-hunter/crawler');
      const context = await initSearchAtlasContext();
      const testPage = await context.newPage();
      await testPage.goto('https://dashboard.searchatlas.com/login', { waitUntil: 'networkidle0' as any, timeout: 10000 });
      const currentUrl = testPage.url();
      // Check if we're past the login page (logged in or at dashboard)
      searchAtlasReady = !currentUrl.includes('login') || currentUrl.includes('dashboard');
      await testPage.close();
    } catch (error: any) {
      return res.status(400).json({ 
        error: 'SearchAtlas not ready. Please make sure you are logged in to SearchAtlas in Chrome.',
        details: error.message 
      });
    }

    if (!searchAtlasReady) {
      return res.status(400).json({ 
        error: 'SearchAtlas login required. Please log in to SearchAtlas first.' 
      });
    }

    // Load the data we need for analysis
    const taxonomy = await loadKeywordTaxonomy(run.niche);
    const intentWeights = loadIntentWeights();
    const allKeywords = getAllKeywords(taxonomy);

    // Get locations from stored notes (JSON) or from existing scans
    let locations: Array<{ city: string; state: string; zip?: string; payout: number }> = [];
    
    if (run.notes) {
      try {
        locations = JSON.parse(run.notes);
      } catch (e) {
        // If parsing fails, try to reconstruct from scans
        locations = run.scans.map(scan => ({
          city: scan.city,
          state: scan.state,
          zip: scan.zip || undefined,
          payout: run.payout,
        }));
      }
    } else {
      // Reconstruct from scans if notes don't have locations
      locations = run.scans.map(scan => ({
        city: scan.city,
        state: scan.state,
        zip: scan.zip || undefined,
        payout: run.payout,
      }));
    }

    if (locations.length === 0) {
      return res.status(400).json({ 
        error: 'No locations found for this run. Please create a new analysis.' 
      });
    }

    // Update status to running
    await prisma.run.update({
      where: { id },
      data: { status: 'running', notes: null },
    });

    // Import the processAnalysis function
    const { processAnalysis } = await import('../../../api/runs/create');
    
    // Open terminal window to show analysis progress
    const openTerminal = () => {
      try {
        const os = require('os');
        const path = require('path');
        const fs = require('fs');
        const { spawn } = require('child_process');
        const platform = os.platform();
        
        // Use process.cwd() which works correctly in Next.js API routes
        const cwd = process.cwd();
        const normalizedCwd = cwd.replace(/\\/g, '/');
        const projectRoot = (normalizedCwd.includes('apps') && normalizedCwd.includes('web'))
          ? path.resolve(cwd, '..', '..')
          : cwd;
        
        console.log(`[Terminal] Platform: ${platform}`);
        console.log(`[Terminal] process.cwd(): ${cwd}`);
        console.log(`[Terminal] Project root: ${projectRoot}`);
        
        if (platform === 'win32') {
          // Windows: Open PowerShell in new window with simpler command
          const psScript = `
            cd "${projectRoot}"
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "Analysis Running" -ForegroundColor Green
            Write-Host "Run ID: ${run.id}" -ForegroundColor Yellow
            Write-Host "Niche: ${run.niche}" -ForegroundColor Yellow
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "This window will show analysis progress..." -ForegroundColor Gray
            Write-Host "Check the main server terminal for detailed logs." -ForegroundColor Gray
            Write-Host ""
            Write-Host "Press Ctrl+C to close this window (analysis will continue)" -ForegroundColor DarkGray
            Write-Host ""
            $host.UI.RawUI.WindowTitle = "Analysis: ${run.id}"
            Start-Sleep -Seconds 3600
          `.trim();
          
          // Write script to temp file to avoid quoting issues
          const tempScript = path.join(projectRoot, 'temp-analysis-window.ps1');
          fs.writeFileSync(tempScript, psScript, 'utf8');
          
          console.log(`[Terminal] Opening PowerShell window with script: ${tempScript}`);
          
          const child = spawn('powershell.exe', [
            '-NoExit',
            '-ExecutionPolicy', 'Bypass',
            '-File', tempScript
          ], {
            detached: true,
            stdio: 'ignore',
            windowsVerbatimArguments: false
          });
          
          child.unref(); // Allow parent process to exit independently
          
          // Clean up temp script after a delay
          setTimeout(() => {
            try {
              if (fs.existsSync(tempScript)) {
                fs.unlinkSync(tempScript);
              }
            } catch (e) {
              // Ignore cleanup errors
            }
          }, 2000);
          
          console.log('✅ Opened PowerShell window for analysis progress');
        } else {
          // Unix/Mac: Open terminal
          const terminal = process.env.TERM || 'xterm';
          const command = `cd "${projectRoot}" && echo "Analysis running for Run ID: ${run.id}" && echo "Check server logs for progress..." && sleep 3600`;
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
    
    // Start analysis in background
    processAnalysis(run.id, locations as any, taxonomy, intentWeights, allKeywords, run.niche).catch(
      (error: any) => {
        console.error('Analysis error:', error);
        prisma.run.update({
          where: { id: run.id },
          data: { status: 'error', notes: error.message },
        });
      }
    );

    return res.status(200).json({ 
      message: 'Analysis started',
      runId: run.id
    });
  } catch (error: any) {
    console.error('Start run error:', error);
    return res.status(500).json({ error: error.message || 'Failed to start analysis' });
  }
}

