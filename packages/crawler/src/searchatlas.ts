import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import { exec } from 'child_process';
import { prisma } from '@niche-hunter/db';
import { getVolumeFromKeywordsEverywhere } from './keywords-everywhere';
import { findChromePath } from './chrome-launcher';
import { 
  getVolumeFromSearchAtlasAPI, 
  shouldUseSearchAtlasAPI, 
  getSearchAtlasAPIKey 
} from './searchatlas-api';
import {
  getVolumeFromKeywordsEverywhereAPI,
  shouldUseKeywordsEverywhereAPI,
  getKeywordsEverywhereAPIKey,
} from './keywords-everywhere-api';

let browser: Browser | null = null;

// Global cancellation check - prevents Chrome from launching if set
let globalCancellationFlag = false;

export function setGlobalCancellation(flag: boolean) {
  globalCancellationFlag = flag;
}

export function isGloballyCancelled(): boolean {
  return globalCancellationFlag;
}

async function closeExistingChromeInstances(): Promise<void> {
  console.log(`   🔍 Closing any existing Chrome instances...`);
  try {
    if (process.platform === 'win32') {
      await new Promise<void>((resolve) => {
        exec('taskkill /F /IM chrome.exe /T', () => {
          setTimeout(resolve, 5000); // Increased from 3s to 5s
        });
      });
    } else {
      await new Promise<void>((resolve) => {
        exec('pkill -f "Google Chrome"', () => {
          setTimeout(resolve, 5000); // Increased from 2s to 5s
        });
      });
    }
    console.log(`   ✅ All Chrome instances closed`);
  } catch (error) {
    console.log(`   ⚠️  Could not close existing Chrome: ${(error as Error).message}`);
  }
}

/**
 * Delete Chrome lock files that prevent browser launch
 */
async function deleteChromeLockFiles(userDataDir: string): Promise<void> {
  const fs = require('fs');
  const lockFiles = [
    'SingletonLock',
    'SingletonSocket',
    'lockfile',
    'SingletonCookie',
    'SingletonLock-journal',
  ];
  
  console.log(`   🗑️  Cleaning Chrome lock files...`);
  let deletedCount = 0;
  
  for (const lockFile of lockFiles) {
    try {
      const lockPath = path.join(userDataDir, lockFile);
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
        console.log(`   ✅ Deleted: ${lockFile}`);
        deletedCount++;
      }
    } catch (error: any) {
      // Ignore errors - file might be locked or not exist
      if (!error.message?.includes('ENOENT')) {
        console.log(`   ⚠️  Could not delete ${lockFile}: ${error.message}`);
      }
    }
  }
  
  if (deletedCount > 0) {
    console.log(`   ✅ Cleaned ${deletedCount} lock file(s)`);
  } else {
    console.log(`   ℹ️  No lock files found to clean`);
  }
}

function resolveUserDataDir(explicit?: string): string {
  if (explicit) {
    return explicit;
  }
  const base = process.env.CHROME_USER_DATA_DIR ||
    process.env.LOCALAPPDATA ||
    process.env.USERPROFILE || '';
  return path.join(base, 'Google', 'Chrome', 'User Data');
}

function resolveProfileDir(explicit?: string): string {
  if (explicit && explicit.trim().length > 0) {
    console.log(`   ✅ Using explicit profile directory: ${explicit.trim()}`);
    return explicit.trim();
  }
  
  // Check for explicit profile directory setting
  if (process.env.CHROME_PROFILE_DIR && process.env.CHROME_PROFILE_DIR.trim().length > 0) {
    const profileDir = process.env.CHROME_PROFILE_DIR.trim();
    console.log(`   ✅ Using CHROME_PROFILE_DIR from environment: "${profileDir}"`);
    return profileDir;
  }
  
  // Check for profile name (e.g., "Person 1") and try to find it
  if (process.env.CHROME_PROFILE_NAME) {
    const profileName = process.env.CHROME_PROFILE_NAME.trim();
    const userDataDir = resolveUserDataDir();
    
    try {
      const fs = require('fs');
      const localStatePath = path.join(userDataDir, 'Local State');
      
      if (fs.existsSync(localStatePath)) {
        const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
        const profiles = localState?.profile?.info_cache || {};
        
        for (const [dirName, profileInfo] of Object.entries(profiles)) {
          const info = profileInfo as any;
          const infoName = info?.name?.toLowerCase() || '';
          const searchName = profileName.toLowerCase();
          
          // Exact match
          if (infoName === searchName) {
            console.log(`   ✅ Found profile "${profileName}" -> directory: ${dirName}`);
            return dirName;
          }
          
          // Partial match (e.g., "Colin Merrill" matches "Colin")
          if (infoName.includes(searchName) || searchName.includes(infoName)) {
            console.log(`   ✅ Found profile "${info.name}" (matches "${profileName}") -> directory: ${dirName}`);
            return dirName;
          }
        }
        
        console.warn(`   ⚠️  Profile "${profileName}" not found in Chrome profiles`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Could not search for profile "${profileName}": ${(error as Error).message}`);
    }
  }
  
  // Default fallback - try Profile 1 first since that's where Keywords Everywhere likely is
  console.log(`   ⚠️  No profile specified. Defaulting to Profile 1 (has Keywords Everywhere). To use a specific profile, set CHROME_PROFILE_DIR or CHROME_PROFILE_NAME in .env`);
  return 'Profile 1'; // Changed from 'Default' to 'Profile 1' since that's where Keywords Everywhere is
}

async function launchChromeWithPuppeteer(options: {
  userDataDir?: string;
  profileDir?: string;
  reason?: string;
} = {}): Promise<Browser> {
  const { userDataDir, profileDir, reason } = options;
  const finalUserDataDir = resolveUserDataDir(userDataDir);
  let finalProfileDir = resolveProfileDir(profileDir);

  // Use the resolved profile directory (from env vars or explicit parameter)
  console.log(`   🔧 Using profile directory: "${finalProfileDir}"`);

  // Verify profile directory exists
  const profilePath = path.join(finalUserDataDir, finalProfileDir);
  const fs = require('fs');
  if (!fs.existsSync(profilePath)) {
    console.error(`   ❌ ERROR: Profile directory does not exist: ${profilePath}`);
    console.error(`   💡 Available profiles:`);
    try {
      const entries = fs.readdirSync(finalUserDataDir, { withFileTypes: true });
      entries.forEach((entry: any) => {
        if (entry.isDirectory() && (entry.name === 'Default' || entry.name.startsWith('Profile'))) {
          console.error(`      - ${entry.name}`);
        }
      });
    } catch (e) {
      console.error(`   Could not list profiles: ${(e as Error).message}`);
    }
    throw new Error(`Chrome profile directory not found: ${profilePath}`);
  }
  console.log(`   ✅ Verified profile directory exists: ${profilePath}`);

  if (reason) {
    console.log(`   ℹ️  Launch reason: ${reason}`);
  }
  console.log(`   📂 Using Chrome user data dir: ${finalUserDataDir}`);
  console.log(`   🔑 Using Chrome profile dir: ${finalProfileDir}`);
  console.log(`   🔍 Environment check - CHROME_PROFILE_DIR: ${process.env.CHROME_PROFILE_DIR || '(not set)'}`);
  console.log(`   🔍 Environment check - CHROME_PROFILE_NAME: ${process.env.CHROME_PROFILE_NAME || '(not set)'}`);

  await closeExistingChromeInstances();
  
  // Delete lock files that might prevent Chrome from launching
  await deleteChromeLockFiles(finalUserDataDir);

  console.log(`   🚀 Launching Chrome with Puppeteer...`);
  
  // CRITICAL: Use your actual Chrome installation, not Puppeteer's bundled Chromium
  // This ensures we use your Chrome profile with extensions (Keywords Everywhere)
  const systemChromePath = findChromePath();
  const puppeteerExecutablePath = puppeteer.executablePath();
  
  // Prefer system Chrome over Puppeteer's Chromium
  const chromeExecutablePath = process.env.CHROME_EXECUTABLE_PATH || systemChromePath || puppeteerExecutablePath;
  
  console.log(`   📍 Using Chrome executable: ${chromeExecutablePath}`);
  console.log(`   ℹ️  System Chrome found: ${systemChromePath || 'not found'}`);
  console.log(`   ℹ️  Puppeteer Chromium: ${puppeteerExecutablePath}`);
  
  // Verify executable exists
  if (!fs.existsSync(chromeExecutablePath)) {
    throw new Error(`Chrome executable not found at: ${chromeExecutablePath}. Please install Chrome or set CHROME_EXECUTABLE_PATH in .env`);
  }
  
  // CRITICAL: Ensure we use the correct profile directory
  console.log(`   🔧 CRITICAL: Setting profile directory to: "${finalProfileDir}"`);
  
  // Use a clean, fast-loading profile (no extensions)
  // We'll use Keywords Everywhere API for volume data instead of browser extension
  const debugPort = 9222;
  const baseArgs = [
    `--remote-debugging-port=${debugPort}`, // Explicit port for Puppeteer connection
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
    '--disable-sync', // Prevents "Sign in to sync" prompts
    '--no-service-autorun',
    '--password-store=basic',
    '--disable-blink-features=AutomationControlled',
    '--disable-gpu', // Add GPU disable for stability
    '--disable-dev-shm-usage', // Overcome limited resource problems
    '--no-sandbox', // Required for some environments
    '--disable-setuid-sandbox', // Additional sandbox fix
    '--disable-background-networking', // Prevent background sync operations
    '--disable-background-timer-throttling', // Don't throttle background tasks
    '--disable-extensions', // Don't load extensions for faster startup
    '--disable-component-extensions-with-background-pages',
  ];
  
  console.log(`   🔧 Using remote debugging port: ${debugPort}`);
  console.log(`   ℹ️  Using clean profile for fast startup (Keywords Everywhere API for volumes)`);
  
  console.log(`   🔧 Launch args:`);
  console.log(`      --user-data-dir=${finalUserDataDir}`);
  console.log(`      --profile-directory=${finalProfileDir}`);
  console.log(`      Full profile path: ${profilePath}`);
  
  // Use clean profile for fast startup
  const launchOptions: any = {
    headless: false,
    executablePath: chromeExecutablePath,
    args: baseArgs,
    timeout: 60000, // 1 minute - should be enough for clean profile
    protocolTimeout: 90000, // 1.5 minutes
  };
  
  console.log(`   🔧 Final launch options:`);
  console.log(`      - userDataDir: ${finalUserDataDir}`);
  console.log(`      - profile-directory: ${finalProfileDir}`);
  console.log(`      - profile path: ${profilePath}`);

  let launchedBrowser: Browser | null = null;
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`   🔄 Attempt ${retryCount + 1} of ${maxRetries}...`);
      console.log(`   ⏳ Launching Chrome (this may take 1-2 minutes with extensions)...`);
      
      // Try to connect to existing Chrome instance on debug port first
      try {
        const http = require('http');
        const testConnection = await new Promise<boolean>((resolve) => {
          const req = http.get(`http://localhost:${debugPort}/json/version`, { timeout: 2000 }, (res: any) => {
            resolve(res.statusCode === 200);
          });
          req.on('error', () => resolve(false));
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
        });
        
        if (testConnection) {
          console.log(`   ✅ Found existing Chrome instance on port ${debugPort}, connecting...`);
          try {
            launchedBrowser = await puppeteer.connect({
              browserURL: `http://localhost:${debugPort}`,
              defaultViewport: null,
            });
            if (launchedBrowser && launchedBrowser.isConnected()) {
              const pages = await launchedBrowser.pages();
              console.log(`   ✅ Connected to existing Chrome (${pages.length} page(s))`);
              break; // Success - use existing instance
            }
          } catch (connectError: any) {
            console.log(`   ⚠️  Could not connect to existing Chrome: ${connectError.message}`);
            // Continue to launch new instance
          }
        }
      } catch (checkError) {
        // No existing instance, continue to launch
      }
      
      // Launch new Chrome instance
      console.log(`   🚀 Launching new Chrome instance...`);
      console.log(`   ⚠️  NOTE: Chrome with extensions can take 2-4 minutes to fully start. Please be patient...`);
      const launchStartTime = Date.now();
      
      // Launch Chrome with extended timeout - extensions make it slow
      // Use a longer timeout since Chrome with extensions can be very slow
      const extendedLaunchOptions = {
        ...launchOptions,
        timeout: 300000, // 5 minutes - Chrome with many extensions needs this
        protocolTimeout: 360000, // 6 minutes
      };
      
      // Launch Chrome with timeout protection
      const launchPromise = puppeteer.launch(extendedLaunchOptions);
      const launchTimeout = 300000; // 5 minutes for launch itself (extensions are slow)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Chrome launch timed out after ${launchTimeout/1000}s. Chrome with extensions can be very slow. Try: 1) Disable some Chrome extensions, 2) Close other Chrome windows, 3) Restart computer`));
        }, launchTimeout);
      });
      
      // Show progress while launching
      const progressInterval = setInterval(() => {
        const elapsed = ((Date.now() - launchStartTime) / 1000).toFixed(0);
        if (parseInt(elapsed) > 30 && parseInt(elapsed) % 30 === 0) {
          console.log(`   ⏳ Still launching Chrome... (${elapsed}s elapsed - extensions are loading)`);
        }
      }, 5000);
      
      try {
        launchedBrowser = await Promise.race([launchPromise, timeoutPromise]);
        clearInterval(progressInterval);
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
      
      const launchDuration = ((Date.now() - launchStartTime) / 1000).toFixed(1);
      console.log(`   ✅ Chrome process launched in ${launchDuration}s, waiting for connection...`);
      
      // Wait for browser to fully initialize and connect
      // Chrome with extensions can take 60-120 seconds to fully start
      let connectionAttempts = 0;
      const maxConnectionAttempts = 120; // 120 attempts * 2 seconds = 240 seconds max (4 minutes)
      let lastError: any = null;
      const connectionStartTime = Date.now();
      
      console.log(`   ⏳ Waiting for Chrome to fully initialize (extensions loading)...`);
      
      while (connectionAttempts < maxConnectionAttempts) {
        try {
          if (launchedBrowser) {
            // Try to check connection
            const isConnected = launchedBrowser.isConnected();
            if (isConnected) {
              // Test connection by getting pages
              try {
                const pages = await launchedBrowser.pages();
                const connectionDuration = ((Date.now() - connectionStartTime) / 1000).toFixed(1);
                console.log(`   ✅ Browser connected! (${pages.length} page(s)) - took ${connectionDuration}s`);
                break; // Success!
              } catch (pageError: any) {
                lastError = pageError;
                // Connection exists but pages() failed - might still be initializing
              }
            }
          }
        } catch (connError: any) {
          lastError = connError;
          // Connection not ready yet, continue waiting
        }
        
        // Progress updates every 20 seconds
        if (connectionAttempts % 10 === 0 && connectionAttempts > 0) {
          const elapsed = ((Date.now() - connectionStartTime) / 1000).toFixed(0);
          console.log(`   ⏳ Still waiting for browser connection... (${elapsed}s elapsed - extensions are still loading)`);
        }
        
        await new Promise((resolve) => setTimeout(resolve, 2000));
        connectionAttempts++;
      }
      
      // Final verification
      if (!launchedBrowser) {
        throw new Error(`Chrome process did not launch successfully`);
      }
      
      if (!launchedBrowser.isConnected()) {
        throw new Error(`Browser launched but not connected after ${maxConnectionAttempts * 2} seconds. Chrome may be hanging during startup. Last error: ${lastError?.message || 'unknown'}`);
      }
      
      // Verify we can actually use the browser
      try {
        const pages = await launchedBrowser.pages();
        console.log(`   ✅ Browser connection verified (${pages.length} page(s))`);
      } catch (testError: any) {
        throw new Error(`Browser connection test failed: ${testError.message}`);
      }
      
      // Success - break out of retry loop
      break;
      
    } catch (error: any) {
      retryCount++;
      const errorMsg = error.message || String(error);
      
      console.error(`   ❌ Chrome launch attempt ${retryCount} failed: ${errorMsg}`);
      
      // Check if Chrome process is actually running (might be hanging)
      try {
        if (process.platform === 'win32') {
          const { execSync } = require('child_process');
          const chromeProcesses = execSync('tasklist /FI "IMAGENAME eq chrome.exe" 2>nul || echo ""', { encoding: 'utf8' });
          if (chromeProcesses.includes('chrome.exe')) {
            console.warn(`   ⚠️  Chrome process is running but not connecting - may be hanging`);
            console.warn(`   💡 Trying to kill hanging Chrome processes...`);
            exec('taskkill /F /IM chrome.exe /T', () => {});
            await new Promise(resolve => setTimeout(resolve, 5000));
            // Also delete lock files again
            await deleteChromeLockFiles(finalUserDataDir);
          }
        }
      } catch (checkError) {
        // Ignore process check errors
      }
      
      // Close any partially launched browsers
      try {
        if (launchedBrowser) {
          await launchedBrowser.close().catch(() => {});
          launchedBrowser = null;
        }
      } catch {}
      
      if (retryCount >= maxRetries) {
        console.error(`   💥 All ${maxRetries} attempts failed. Trying with minimal options...`);
        
        // Last resort: try with minimal configuration (no profile, no extensions)
        console.log(`   🔄 Attempting minimal launch (no profile/extensions)...`);
        const minimalOptions = {
          headless: false,
          executablePath: chromeExecutablePath,
          args: [
            `--remote-debugging-port=${debugPort + 1}`, // Use different port to avoid conflicts
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-sync',
            '--disable-background-networking',
            '--disable-extensions', // Disable extensions for faster launch
          ],
          timeout: 120000, // 2 minutes for minimal launch
          protocolTimeout: 180000, // 3 minutes
        };
        
        try {
          console.log(`   ⏳ Launching Chrome with minimal config (no profile/extensions)...`);
          const minimalLaunchPromise = puppeteer.launch(minimalOptions);
          const minimalTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Minimal Chrome launch timed out after 120s`));
            }, 120000);
          });
          
          launchedBrowser = await Promise.race([minimalLaunchPromise, minimalTimeoutPromise]);
          await new Promise((resolve) => setTimeout(resolve, 3000));
          
          // Wait for connection
          let minimalConnAttempts = 0;
          while (minimalConnAttempts < 30) {
            if (launchedBrowser && launchedBrowser.isConnected()) {
              try {
                await launchedBrowser.pages();
                break;
              } catch {}
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));
            minimalConnAttempts++;
          }
          
          if (!launchedBrowser || !launchedBrowser.isConnected()) {
            throw new Error(`Minimal launch also failed - Chrome may be corrupted or blocked`);
          }
          
          console.log(`   ✅ Browser launched with minimal configuration (WARNING: Extensions may not work)`);
          break;
        } catch (minimalError: any) {
          throw new Error(`Failed to launch Chrome after ${maxRetries} retries and minimal config attempt. Original: ${errorMsg}. Minimal: ${minimalError.message}. Try: 1) Close all Chrome windows, 2) Restart computer, 3) Check Chrome installation`);
        }
      }
      
      // Wait before retry (longer wait on later retries)
      const waitTime = 3000 + (retryCount * 2000); // 3s, 5s, 7s
      console.log(`   ⏳ Waiting ${waitTime/1000}s before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      
      // Add more stability flags on retry
      if (retryCount === 2) {
        launchOptions.args = [
          ...baseArgs,
          '--disable-software-rasterizer',
        ];
      }
      
      continue;
    }
  }
  
  // Ensure browser was launched
  if (!launchedBrowser) {
    throw new Error('Failed to launch Chrome browser after all retry attempts');
  }

  // Give extensions and profile time to load
  console.log('   ⏳ Waiting for Chrome profile to fully load (including sign-in state)...');
  await new Promise((resolve) => setTimeout(resolve, 5000)); // Increased from 3 to 5 seconds

  try {
    const pages = await launchedBrowser.pages();
    const testPage = pages[0] || await launchedBrowser.newPage();
    
    // Navigate to a page that requires sign-in to verify session
    console.log('   🔍 Verifying Chrome session and profile...');
    await testPage.goto('https://www.google.com', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    
    // Verify we're using the correct profile by checking the profile path
    const actualProfileInfo = await testPage.evaluate(() => {
      // Try to detect which profile we're using
      return {
        url: window.location.href,
        title: document.title,
      };
    }).catch(() => ({ url: 'unknown', title: 'unknown' }));
    
    console.log(`   🔍 Profile verification - URL: ${actualProfileInfo.url}`);
    
    // Check if we're signed in by looking for profile indicator
    const isSignedIn = await testPage.evaluate(() => {
      // Check for sign-in indicators in the page
      const signInIndicators = [
        document.querySelector('[aria-label*="Google Account"]'),
        document.querySelector('img[alt*="Google Account"]'),
        document.querySelector('[data-ved*="account"]'),
      ];
      return signInIndicators.some(el => el !== null);
    }).catch(() => false);
    
    if (isSignedIn) {
      console.log('   ✅ Chrome profile appears to be signed in');
    } else {
      console.log('   ⚠️  Chrome profile may not be signed in - extensions should still work');
      console.log(`   ⚠️  WARNING: If you see "Person 1" instead of "colin", Chrome is using the wrong profile!`);
      console.log(`   ⚠️  Expected profile: Profile 1 (colin - onkaulauto@gmail.com)`);
      console.log(`   ⚠️  Actual profile path: ${profilePath}`);
    }
    
    await testPage.close().catch(() => {});
    console.log('   ✅ Chrome launch verified with a test navigation');
  } catch (testError: any) {
    console.log(`   ⚠️  Test navigation warning: ${testError.message}`);
  }

  return launchedBrowser;
}

export async function initBrowserContext(): Promise<Browser> {
  // Check for global cancellation BEFORE launching Chrome
  if (isGloballyCancelled()) {
    throw new Error('Analysis cancelled - stopping Chrome initialization');
  }

  if (browser && browser.isConnected()) {
    return browser;
  }

  // Check if Chrome is already running (might block launch)
  console.log(`   🔍 Checking if Chrome is already running...`);
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Check for Chrome processes on Windows
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq chrome.exe" 2>nul || echo ""');
    if (stdout && stdout.includes('chrome.exe')) {
      console.log(`   ⚠️  WARNING: Chrome is already running!`);
      console.log(`   💡 This might cause launch conflicts. Consider closing Chrome and trying again.`);
      console.log(`   💡 Or wait 10 seconds for Chrome to fully initialize...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  } catch (e) {
    // Ignore errors checking for Chrome
  }

  console.log(`   ⚙️  Launching Chrome with Puppeteer (no DevTools needed)`);
  console.log(`   ⏳ This may take 1-3 minutes if Chrome is already running or has many extensions...`);
  
  browser = await launchChromeWithPuppeteer({
    userDataDir: process.env.CHROME_USER_DATA_DIR,
    profileDir: process.env.CHROME_PROFILE_DIR,
    reason: 'Initial browser launch',
  });

  // Verify Keywords Everywhere is enabled
  const kwEnabled = await verifyKeywordsEverywhereEnabled(browser);
  if (!kwEnabled) {
    console.log('\n⚠️  WARNING: Keywords Everywhere extension may not be detected.');
    console.log('   Analysis will continue, but volume data may not be available.');
    console.log('   Make sure Keywords Everywhere is installed and enabled in Chrome.\n');
  }

  return browser;
}

// Keep old name for backwards compatibility (deprecated)
export async function initSearchAtlasContext(): Promise<Browser> {
  console.log('⚠️  initSearchAtlasContext() is deprecated. Use initBrowserContext() instead.');
  return initBrowserContext();
}

async function verifyKeywordsEverywhereEnabled(browser: Browser): Promise<boolean> {
  try {
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    
    // Navigate to a simple page to check for Keywords Everywhere
    await page.goto('https://www.google.com/search?q=test', {
      waitUntil: 'networkidle0' as const,
      timeout: 10000,
    });

    // Wait a bit for extension to inject
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if Keywords Everywhere has injected any elements
    const hasKWElements = await page.evaluate(() => {
      const selectors = [
        '[class*="kw"]',
        '[class*="keywords-everywhere"]',
        '[id*="kw"]',
        '[data-kw]',
      ];

      for (const selector of selectors) {
        if ((document as any).querySelector(selector)) {
          return true;
        }
      }

      // Check if chrome.runtime is available (extensions loaded)
      if ((window as any).chrome && (window as any).chrome.runtime) {
        return true;
      }

      return false;
    });

    if (!hasKWElements) {
      console.log('\n⚠️  Keywords Everywhere extension may not be enabled.');
      console.log('   Please ensure:');
      console.log('   1. Keywords Everywhere extension is installed in Chrome');
      console.log('   2. Extension is enabled in chrome://extensions/');
      console.log('   3. Extension has API credits/access configured');
      console.log('   The analysis will continue but may not find volume data.\n');
      return false;
    }

    console.log('✅ Keywords Everywhere extension appears to be enabled\n');
    return true;
  } catch (error: any) {
    console.log(`⚠️  Could not verify Keywords Everywhere: ${error.message}`);
    console.log('   Continuing anyway...\n');
    return false;
  }
}

// Helper function to retry Prisma queries with reconnection on prepared statement errors
async function retryPrismaQuery<T>(
  queryFn: () => Promise<T>,
  retries: number = 5
): Promise<T> {
  let attempt = 0;
  while (retries > 0) {
    attempt++;
    try {
      return await queryFn();
    } catch (error: any) {
      // Check for prepared statement errors (both "does not exist" and "already exists")
      const isPreparedStatementError = 
        error.code === '26000' || // prepared statement does not exist
        error.code === '42P05' || // prepared statement already exists
        error.message?.includes('prepared statement');
      
      if (isPreparedStatementError && retries > 1) {
        retries--;
        const waitTime = 500 + (attempt * 200); // Progressive backoff: 500ms, 700ms, 900ms, etc.
        console.log(`   ⚠️  [DB_RETRY] Prepared statement error (attempt ${attempt}/${5 - retries + 1}), retrying in ${waitTime}ms...`);
        
        // Wait with progressive backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Disconnect and reconnect Prisma to clear connection state
        try {
          await prisma.$disconnect();
          await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause between disconnect/connect
        } catch (e) {
          // Ignore disconnect errors
        }
        try {
          await prisma.$connect();
        } catch (e) {
          // Ignore connect errors, will retry
        }
        continue;
      }
      throw error; // Re-throw if not a prepared statement error or out of retries
    }
  }
  throw new Error('Query failed after all retries');
}

export async function getLocalVolume(
  keyword: string,
  city: string,
  state: string,
  reusePage?: Page,
  checkCancellation?: () => boolean,
  niche?: string
): Promise<{ volume: number; cpc?: number; similarKeywords: string[] }> {
  // Check if Keywords Everywhere API should be used (preferred method)
  // If not available, check SearchAtlas API
  // If API is available, we'll check cache but prioritize fresh API data
  const useKeywordsEverywhereAPI = await shouldUseKeywordsEverywhereAPI();
  const useSearchAtlasAPI = !useKeywordsEverywhereAPI && await shouldUseSearchAtlasAPI();
  const useAPI = useKeywordsEverywhereAPI || useSearchAtlasAPI;
  const apiSource = useKeywordsEverywhereAPI ? 'keywords-everywhere-api' : 'searchatlas_api';
  
  // Check cache first (but don't use it if volume is 0 or if API is available and cache is old)
  const ttlDays = parseInt(process.env.SEARCH_TTL_DAYS || '30', 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ttlDays);

  const cached = await retryPrismaQuery(() => 
    prisma.volumeSample.findFirst({
      where: {
        keyword,
        city,
        state,
      },
    })
  );

  // Use cache only if:
  // 1. Cache exists
  // 2. Cache is within TTL
  // 3. Cache volume is NOT 0 (0 means "no data" - treat as invalid)
  // 4. If API is available, only use cache if it's from the same API source (not old browser data)
  const shouldUseCache = cached && 
                         cached.capturedAt > cutoffDate && 
                         cached.volume > 0 &&
                         (!useAPI || cached.source === apiSource);

  if (shouldUseCache) {
    // VALIDATION: For cached city queries, verify the cached keyword actually contained the city
    // If the cache was created with a keyword that doesn't contain the city, it's national data
    if (city && cached.keyword) {
      const cachedKeywordLower = cached.keyword.toLowerCase();
      const cityLower = city.toLowerCase();
      const keywordLower = keyword.toLowerCase();
      
      const containsCity = cachedKeywordLower.includes(cityLower);
      const containsBaseKeyword = cachedKeywordLower.includes(keywordLower);
      
      if (!containsCity || !containsBaseKeyword) {
        console.log(`   ⚠️  [LOCAL_VOLUME_REJECT] Cached keyword "${cached.keyword}" doesn't contain city "${city}" - purging cache, fetching fresh data`);
        // Purge the bad cache entry
        try {
          await retryPrismaQuery(() => 
            prisma.volumeSample.delete({ where: { id: cached.id } })
          );
          console.log(`   🗑️  Purged bad cached volume from database`);
        } catch (deleteError: any) {
          console.warn(`   ⚠️  Failed to purge bad cache: ${deleteError.message}`);
        }
        // Don't use cache, continue to fetch fresh data
      } else {
        console.log(`📦 Using cached volume ${cached.volume} for "${cached.keyword}" (contains city "${city}")`);
        console.log(`   Cached on: ${cached.capturedAt.toLocaleString()} (source: ${cached.source})`);
        return { volume: cached.volume, cpc: undefined, similarKeywords: [] };
      }
    } else {
      // No city or no cached keyword - use cache as-is
      console.log(`📦 Using cached volume ${cached.volume} for "${keyword}" in ${city}, ${state}`);
      console.log(`   Cached on: ${cached.capturedAt.toLocaleString()} (source: ${cached.source})`);
      return { volume: cached.volume, cpc: undefined, similarKeywords: [] };
    }
  }

  if (cached && cached.volume === 0) {
    console.log(`⚠️  Cached volume is 0 (invalid data) - fetching fresh data for "${keyword}" in ${city}, ${state}...`);
  } else if (cached && cached.capturedAt <= cutoffDate) {
    console.log(`⏰ Cache expired (older than ${ttlDays} days) - fetching fresh data for "${keyword}" in ${city}, ${state}...`);
  } else if (cached && useAPI && cached.source !== apiSource) {
    console.log(`🔄 Cache from different source - fetching fresh API data for "${keyword}" in ${city}, ${state}...`);
  } else {
    console.log(`🔍 Fetching NEW volume data for "${keyword}" in ${city}, ${state}...`);
  }
  
  // Try Keywords Everywhere API first (preferred)
  if (useKeywordsEverywhereAPI) {
    const apiKey = await getKeywordsEverywhereAPIKey();
    if (!apiKey) {
      console.warn(`   ⚠️  [Keywords Everywhere API] KEYWORDS_EVERYWHERE_API_KEY is set but empty`);
      console.warn(`   ⚠️  [Keywords Everywhere API] Falling back to browser method...`);
    } else {
      try {
        console.log(`   📡 [Keywords Everywhere API] Using API (no browser needed)...`);
        console.log(`   🔑 [Keywords Everywhere API] API key detected (length: ${apiKey.length}), fetching volume for "${keyword}" in ${city}, ${state}`);
        
        const result = await getVolumeFromKeywordsEverywhereAPI(keyword, city, state, apiKey);
        
        console.log(`   ✅ [Keywords Everywhere API] Got volume ${result.volume} for "${keyword}" in ${city}, ${state}`);
        if (result.competition) {
          console.log(`   📊 [Keywords Everywhere API] Competition: ${result.competition}, CPC: ${result.cpc?.currency}${result.cpc?.value}`);
        }
        
        // Cache the result (only if volume > 0 - don't cache "no data" as 0)
        if (result.volume > 0) {
          try {
            const existing = await retryPrismaQuery(() =>
              prisma.volumeSample.findFirst({
                where: { keyword, city, state },
              })
            );
            
            if (existing) {
              await retryPrismaQuery(() =>
                prisma.volumeSample.update({
                  where: { id: existing.id },
                  data: {
                    volume: result.volume,
                    capturedAt: new Date(),
                    source: 'keywords-everywhere-api',
                  },
                })
              );
            } else {
              await retryPrismaQuery(() =>
                prisma.volumeSample.create({
                  data: {
                    keyword,
                    city,
                    state,
                    volume: result.volume,
                    capturedAt: new Date(),
                    source: 'keywords-everywhere-api',
                  },
                })
              );
            }
            console.log(`   💾 Cached volume ${result.volume} for future use`);
          } catch (dbError: any) {
            console.warn(`   ⚠️  Failed to cache API result: ${dbError.message}`);
            // Continue anyway - caching is not critical
          }
        } else {
          console.log(`   ℹ️  Volume is 0 (no data) - not caching to avoid invalid data`);
        }
        
        // Extract CPC value from API response (cpc.value is a string like "5.50")
        let cpcValue: number | undefined = undefined;
        if (result.cpc && result.cpc.value) {
          const parsedCpc = parseFloat(result.cpc.value);
          if (!isNaN(parsedCpc) && parsedCpc > 0) {
            cpcValue = parsedCpc;
          }
        }
        
        // No volume cap - we validate by ensuring the returned keyword contains the city
        // This validation happens in keywords-everywhere-api.ts
        
        return { volume: result.volume, cpc: cpcValue, similarKeywords: [] };
      } catch (error: any) {
        console.error(`   ❌ Keywords Everywhere API error: ${error.message}`);
        console.error(`   💡 Check your API key at https://keywordseverywhere.com/first-install-addon.html`);
        console.log(`   🔄 Falling back to browser method...`);
        // Fall through to browser method below
      }
    }
  }
  
  // Try SearchAtlas API as fallback
  if (useSearchAtlasAPI) {
    const apiKey = await getSearchAtlasAPIKey();
    if (!apiKey) {
      console.warn(`   ⚠️  SEARCHATLAS_API_KEY is set but empty`);
      console.warn(`   ⚠️  Falling back to browser method...`);
    } else {
      try {
        console.log(`   📡 Using SearchAtlas API (no browser needed)...`);
        console.log(`   🔑 API key detected, fetching volume for "${keyword}" in ${city}, ${state}`);
        
        const result = await getVolumeFromSearchAtlasAPI(keyword, city, state, apiKey);
        
        console.log(`   ✅ Got volume ${result.volume} from SearchAtlas API for "${keyword}"`);
        if (result.similarKeywords && result.similarKeywords.length > 0) {
          console.log(`   💡 Found ${result.similarKeywords.length} similar keywords from API`);
        }
        
        // Cache the result (only if volume > 0 - don't cache "no data" as 0)
        if (result.volume > 0) {
          try {
            const existing = await retryPrismaQuery(() =>
              prisma.volumeSample.findFirst({
                where: { keyword, city, state },
              })
            );
            
            if (existing) {
              await retryPrismaQuery(() =>
                prisma.volumeSample.update({
                  where: { id: existing.id },
                  data: {
                    volume: result.volume,
                    capturedAt: new Date(),
                    source: 'searchatlas_api',
                  },
                })
              );
            } else {
              await retryPrismaQuery(() =>
                prisma.volumeSample.create({
                  data: {
                    keyword,
                    city,
                    state,
                    volume: result.volume,
                    capturedAt: new Date(),
                    source: 'searchatlas_api',
                  },
                })
              );
            }
            console.log(`   💾 Cached volume ${result.volume} for future use`);
          } catch (dbError: any) {
            console.warn(`   ⚠️  Failed to cache API result: ${dbError.message}`);
            // Continue anyway - caching is not critical
          }
        } else {
          console.log(`   ℹ️  Volume is 0 (no data) - not caching to avoid invalid data`);
        }
        
        // No volume cap - SearchAtlas API should handle local queries properly
        // If it doesn't, we'll catch it through other validation
        return { ...result };
      } catch (error: any) {
        console.error(`   ❌ SearchAtlas API error: ${error.message}`);
        console.error(`   💡 Check your .env file or Settings dashboard`);
        console.log(`   🔄 Falling back to browser method...`);
        // Fall through to browser method below
      }
    }
  }
  
  console.log(`   Using ${reusePage ? 'reused page' : 'new browser context'}...`);
  
  // If reusePage is provided, use its browser. Otherwise get browser
  const browserInstance = reusePage ? reusePage.browser() : await initBrowserContext();
  console.log(`   ✅ Got browser context, starting Google search...`);
  
  // Use Keywords Everywhere extension to get volume from Google SERP
  try {
    console.log(`   📍 Navigating to Google for "${keyword} ${city} ${state}"...`);
    const result = await getVolumeFromKeywordsEverywhere(
      keyword, 
      city, 
      state, 
      browserInstance, 
      reusePage, 
      checkCancellation,
      niche
    );
    console.log(`   ✅ Got volume ${result.volume} for "${keyword}"`);
    
    // Validation happens in keywords-everywhere.ts - it checks if scraped keyword contains city
    return { ...result };
  } catch (error: any) {
    console.error(
      `Error fetching volume for ${keyword} in ${city}, ${state}:`,
      error.message
    );
    // Return cached value if available, otherwise 0 with no keywords
    // Cache validation happens earlier in the function
    const cachedVolume = cached?.volume || 0;
    return { volume: cachedVolume, cpc: undefined, similarKeywords: [] };
  }
}

export async function closeBrowserContext(): Promise<void> {
  if (browser && browser.isConnected()) {
    await browser.close();
    browser = null;
  }
}

// Keep old name for backwards compatibility (deprecated)
export async function closeSearchAtlasContext(): Promise<void> {
  return closeBrowserContext();
}
