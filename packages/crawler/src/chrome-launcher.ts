import * as child_process from 'child_process';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const exec = promisify(child_process.exec);
const execAsync = promisify(child_process.exec);

/**
 * Check if Chrome is already running with remote debugging on the given port
 */
async function isChromeRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    // Try IPv4 first (127.0.0.1), then localhost
    const req = http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // Chrome's /json endpoint returns an array of tabs
        // If we get valid JSON, Chrome is ready
        try {
          const parsed = JSON.parse(data);
          resolve(Array.isArray(parsed) || typeof parsed === 'object');
        } catch {
          // If it's not JSON but we got a 200, Chrome is at least responding
          resolve(res.statusCode === 200);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Find Chrome executable path on Windows
 */
export function findChromePath(): string {
  const possiblePaths = [
    process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'chrome.exe', // If in PATH
  ];

  for (const chromePath of possiblePaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  // Fallback - assume chrome.exe is in PATH
  return 'chrome.exe';
}

/**
 * Find Chrome profile by name (e.g., "Person 1", "Colin", etc.)
 * Reads Chrome's Local State file or Preferences file to find profile names
 */
function findProfileByName(userDataDir: string, profileName: string): string | null {
  // Try to read Local State file which contains profile info
  const localStatePath = path.join(userDataDir, 'Local State');
  
  try {
    if (fs.existsSync(localStatePath)) {
      const localStateContent = fs.readFileSync(localStatePath, 'utf-8');
      const localState = JSON.parse(localStateContent);
      
      // Look in profile.info_cache for profile names
      if (localState.profile && localState.profile.info_cache) {
        for (const [profileDir, profileInfo] of Object.entries(localState.profile.info_cache)) {
          const info = profileInfo as any;
          // Check name (case insensitive)
          if (info.name && info.name.toLowerCase() === profileName.toLowerCase()) {
            return profileDir;
          }
          // Also check if profileDir contains the name
          if (profileDir.toLowerCase().includes(profileName.toLowerCase())) {
            return profileDir;
          }
        }
      }
    }
  } catch (e) {
    // Continue to other methods
  }

  // Fallback: Check each profile's Preferences file for name
  try {
    const entries = fs.readdirSync(userDataDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && (entry.name === 'Default' || entry.name.startsWith('Profile'))) {
        const prefsPath = path.join(userDataDir, entry.name, 'Preferences');
        try {
          if (fs.existsSync(prefsPath)) {
            const prefsContent = fs.readFileSync(prefsPath, 'utf-8');
            const prefs = JSON.parse(prefsContent);
            // Check account_info or profile name
            if (prefs.account_info && prefs.account_info.given_name) {
              if (prefs.account_info.given_name.toLowerCase().includes(profileName.toLowerCase())) {
                return entry.name;
              }
            }
            // Check profile name field
            if (prefs.profile && prefs.profile.name) {
              if (prefs.profile.name.toLowerCase().includes(profileName.toLowerCase())) {
                return entry.name;
              }
            }
          }
        } catch (e) {
          // Continue to next profile
        }
      }
    }
  } catch (e) {
    // Can't read directory
  }

  return null;
}

/**
 * Find the default Chrome profile directory
 * Chrome stores profiles in User Data/Default, User Data/Profile 1, etc.
 * If profileName is provided, tries to find that specific profile
 */
function findDefaultProfile(userDataDir: string, profileName?: string): string | null {
  // If profile name is specified, try to find it
  if (profileName) {
    const foundProfile = findProfileByName(userDataDir, profileName);
    if (foundProfile) {
      return foundProfile;
    }
    console.log(`   ⚠️  Profile "${profileName}" not found, will search for profiles...`);
  }

  // First, check for "Default" profile (most common)
  const defaultProfile = path.join(userDataDir, 'Default');
  if (fs.existsSync(defaultProfile)) {
    return 'Default';
  }

  // Check for Profile 1, Profile 2, etc.
  for (let i = 1; i <= 10; i++) {
    const profilePath = path.join(userDataDir, `Profile ${i}`);
    if (fs.existsSync(profilePath)) {
      return `Profile ${i}`;
    }
  }

  // List all directories in User Data to find profiles
  try {
    const entries = fs.readdirSync(userDataDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('Profile')) {
        return entry.name;
      }
    }
    // If we find a "Default" directory (case insensitive)
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.toLowerCase() === 'default') {
        return entry.name;
      }
    }
  } catch (e) {
    // Can't read directory
  }

  return null;
}

/**
 * Start Chrome with remote debugging enabled
 * Uses the user's existing Chrome profile so extensions are available
 * IMPORTANT: Must use both --user-data-dir and --profile-directory to access extensions
 */
async function startChromeWithDebugging(port: number, userDataDir?: string, profileDir?: string): Promise<void> {
  // First check if port is already in use
  const portInUse = await isChromeRunning(port);
  if (portInUse) {
    console.log(`   ✅ Port ${port} is already in use - Chrome remote debugging is already running!`);
    return; // Chrome is already running with remote debugging
  }
  
  const chromePath = findChromePath();
  const args = [
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];

  // Use user's existing Chrome profile to access installed extensions (Keywords Everywhere)
  // CRITICAL: We must use both --user-data-dir AND --profile-directory to access extensions
  // Without --profile-directory, Chrome might use guest mode where extensions don't work
  
  // Check for environment variable overrides first
  let finalUserDataDir = userDataDir || process.env.CHROME_USER_DATA_DIR;
  let finalProfileDir = profileDir || process.env.CHROME_PROFILE_DIR;
  
  // Log what we got from env vars for debugging
  console.log(`   🔍 Environment variable check:`);
  console.log(`      CHROME_PROFILE_DIR: ${process.env.CHROME_PROFILE_DIR || '(not set)'}`);
  console.log(`      CHROME_PROFILE_NAME: ${process.env.CHROME_PROFILE_NAME || '(not set)'}`);
  console.log(`      CHROME_USER_DATA_DIR: ${process.env.CHROME_USER_DATA_DIR || '(not set)'}`);
  console.log(`   📋 Computed finalProfileDir: ${finalProfileDir || '(will detect)'}`);
  
  // If CHROME_PROFILE_DIR is explicitly set, use it and skip all detection logic
  if (process.env.CHROME_PROFILE_DIR) {
    finalProfileDir = process.env.CHROME_PROFILE_DIR.trim();
    console.log(`   ✅ Using CHROME_PROFILE_DIR from env: "${finalProfileDir}"`);
    // Verify the profile directory exists
    const profilePath = path.join(finalUserDataDir || path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'), finalProfileDir);
    if (!fs.existsSync(profilePath)) {
      console.log(`   ⚠️  Profile directory "${finalProfileDir}" not found at ${profilePath}`);
      console.log(`   🔍 Will try to detect correct profile...`);
      finalProfileDir = undefined; // Force detection
    } else {
      console.log(`   ✅ Profile directory exists: ${profilePath}`);
      // Skip all profile detection - use the explicitly set one
      // Set finalUserDataDir if not already set
      if (!finalUserDataDir) {
        finalUserDataDir = path.join(
          process.env.LOCALAPPDATA || process.env.USERPROFILE || '',
          'Google',
          'Chrome',
          'User Data'
        );
      }
      // Jump to the end where we add args
      // (We'll skip the entire profile detection block)
    }
  }

  if (!finalUserDataDir) {
    // Use default Chrome profile location
    // On Windows: %LOCALAPPDATA%\Google\Chrome\User Data
    finalUserDataDir = path.join(
      process.env.LOCALAPPDATA || process.env.USERPROFILE || '',
      'Google',
      'Chrome',
      'User Data'
    );

    if (!fs.existsSync(finalUserDataDir)) {
      console.log(`   ⚠️  Chrome User Data directory not found at ${finalUserDataDir}`);
      console.log(`   Extensions will NOT be available!`);
      console.log(`   Make sure Chrome is installed and you've used it at least once.\n`);
      throw new Error(`Chrome profile not found. Please install Chrome and use it at least once.`);
    }
  }

  // Find profile directory if not specified (only if CHROME_PROFILE_DIR wasn't explicitly set)
  let skipProfileArgs = false; // Flag for when we need to skip profile-specific arguments
  
  if (!finalProfileDir) {
    console.log(`   🔍 No profile directory specified, detecting from env vars...`);
    // Check environment variable for profile name (e.g., "Person 1")
    const profileName = process.env.CHROME_PROFILE_NAME;
    
    // List available profiles for debugging
    let availableProfiles: string[] = [];
    try {
      const entries = fs.readdirSync(finalUserDataDir, { withFileTypes: true });
      availableProfiles = entries
        .filter(e => e.isDirectory() && (e.name === 'Default' || e.name.startsWith('Profile')))
        .map(e => e.name);
      console.log(`   📋 Available Chrome profiles: ${availableProfiles.join(', ')}`);
      
      if (profileName) {
        console.log(`   🔍 Looking for profile: "${profileName}"`);
      }
      
      // SPECIAL CASE: Only "Default" profile exists (single profile setup)
      if (availableProfiles.length === 1 && availableProfiles[0] === 'Default') {
        console.log(`   ℹ️  Only 'Default' profile found - single profile Chrome setup detected`);
        console.log(`   ℹ️  Will launch Chrome without profile-specific flags`);
        console.log(`   ℹ️  Chrome will use its default profile behavior with all extensions`);
        skipProfileArgs = true;
        finalProfileDir = 'Default'; // Set it but flag to skip args
      }
    } catch (e) {
      console.log(`   ⚠️  Could not list profiles: ${(e as Error).message}`);
    }
    
    // ALWAYS check Chrome's Local State FIRST for ANY profile name
    // This works for "Colin Merrill", "Person 1", "Work", or any custom profile name
    // Skip this if we're already handling single Default profile
    if (profileName && !skipProfileArgs) {
      let foundProfileDir: string | null = null;
      try {
        const localStatePath = path.join(finalUserDataDir, 'Local State');
        if (fs.existsSync(localStatePath)) {
          console.log(`   🔍 Reading Chrome Local State to find profile "${profileName}"...`);
          const localStateContent = fs.readFileSync(localStatePath, 'utf-8');
          const localState = JSON.parse(localStateContent);
          if (localState.profile && localState.profile.info_cache) {
            for (const [profileDir, profileInfo] of Object.entries(localState.profile.info_cache)) {
              const info = profileInfo as any;
              if (info.name && info.name === profileName) {
                foundProfileDir = profileDir;
                console.log(`   ✅ Found "${profileName}" in Local State -> directory: "${profileDir}"`);
                break;
              }
            }
          }
        } else {
          console.log(`   ⚠️  Local State file not found at ${localStatePath}`);
        }
      } catch (e) {
        console.log(`   ⚠️  Could not read Local State: ${(e as Error).message}`);
      }
      
      // Use the directory from Local State if found
      if (foundProfileDir && fs.existsSync(path.join(finalUserDataDir, foundProfileDir))) {
        finalProfileDir = foundProfileDir;
        console.log(`   ✅ Using profile directory from Chrome Local State: "${finalProfileDir}"`);
        console.log(`   ✅ PROFILE CONFIRMED: Will use "${finalProfileDir}" for "${profileName}"`);
      } else if (profileName.toLowerCase().includes('person')) {
        // Fallback: Try Person N → Profile N mapping as optimization
        const match = profileName.match(/(\d+)/);
        if (match) {
          const profileNum = match[1];
          const profileDirName = `Profile ${profileNum}`;
          const profilePath = path.join(finalUserDataDir, profileDirName);
          console.log(`   🔍 Trying Person N → Profile N mapping: "${profileName}" -> "${profileDirName}"`);
          
          if (fs.existsSync(profilePath)) {
            finalProfileDir = profileDirName;
            console.log(`   ✅ Mapped "${profileName}" to directory "${profileDirName}" (Person N → Profile N)`);
            console.log(`   ✅ PROFILE CONFIRMED: Will use "${finalProfileDir}"`);
          } else {
            console.log(`   ⚠️  Profile directory "${profileDirName}" does not exist at ${profilePath}`);
            console.log(`   🔍 Available profiles were: ${availableProfiles.join(', ')}`);
            console.log(`   ⚠️  Will try findDefaultProfile as fallback...`);
          }
        } else {
          console.log(`   ⚠️  Could not extract number from "${profileName}"`);
          console.log(`   ⚠️  Will try findDefaultProfile as fallback...`);
        }
      } else {
        console.log(`   ⚠️  Profile "${profileName}" not found in Local State and not a "Person N" pattern`);
        console.log(`   🔍 Available profiles were: ${availableProfiles.join(', ')}`);
        console.log(`   ⚠️  Will try findDefaultProfile as fallback...`);
      }
    }
    
    // Only call findDefaultProfile if we haven't already mapped Person N → Profile N
    let foundProfile: string | null = null;
    if (!finalProfileDir) {
      foundProfile = findDefaultProfile(finalUserDataDir, profileName);
    }
    
    // If profile name is provided, never use Default - it doesn't work with remote debugging
    if (profileName && foundProfile === 'Default') {
      console.log(`   ⚠️  Profile finder returned 'Default' but we need a named profile for remote debugging`);
      // Try to find first available Profile directory
      const profileDirs = availableProfiles.filter(p => p.startsWith('Profile'));
      if (profileDirs.length > 0) {
        finalProfileDir = profileDirs[0];
        console.log(`   ✅ Using first available profile directory: ${finalProfileDir}`);
      } else {
        throw new Error(
          `Cannot use 'Default' profile with remote debugging. ` +
          `Available profiles: ${availableProfiles.join(', ')}. ` +
          `Please set CHROME_PROFILE_DIR to one of these, or create a named profile.`
        );
      }
    } else if (!finalProfileDir && !foundProfile) {
      // No profile name provided, try to find a non-Default profile
      const profileDirs = availableProfiles.filter(p => p.startsWith('Profile'));
      if (profileDirs.length > 0) {
        finalProfileDir = profileDirs[0];
        console.log(`   ✅ Using first available profile directory: ${finalProfileDir}`);
      } else {
        throw new Error(
          `No Profile directories found. Cannot use 'Default' profile with remote debugging. ` +
          `Available profiles: ${availableProfiles.join(', ')}. ` +
          `Please create a named profile in Chrome or set CHROME_PROFILE_DIR.`
        );
      }
    } else if (foundProfile && foundProfile !== 'Default') {
      // Only use foundProfile if it's not Default
      finalProfileDir = foundProfile;
      if (profileName) {
        console.log(`   ✅ Found profile "${profileName}" -> directory: ${finalProfileDir}`);
      } else {
        console.log(`   ✅ Using profile directory: ${finalProfileDir}`);
      }
    } else if (foundProfile === 'Default') {
      // FoundProfile returned Default - this is not allowed
      const profileDirs = availableProfiles.filter(p => p.startsWith('Profile'));
      if (profileDirs.length > 0) {
        finalProfileDir = profileDirs[0];
        console.log(`   ⚠️  findDefaultProfile returned 'Default', using first Profile directory instead: ${finalProfileDir}`);
      } else {
        throw new Error(
          `Cannot use 'Default' profile with remote debugging. ` +
          `Available profiles: ${availableProfiles.join(', ')}. ` +
          `Please set CHROME_PROFILE_DIR to one of these.`
        );
      }
    }
    
    // Final safety check - if we still don't have a profile, use first Profile directory
    if (!finalProfileDir) {
      const profileDirs = availableProfiles.filter(p => p.startsWith('Profile'));
      if (profileDirs.length > 0) {
        finalProfileDir = profileDirs[0];
        console.log(`   ✅ Final fallback: Using first available profile directory: ${finalProfileDir}`);
      } else {
        throw new Error(
          `Failed to determine profile directory. Available: ${availableProfiles.join(', ')}. ` +
          `Cannot use 'Default' with remote debugging. Set CHROME_PROFILE_DIR=Profile 1`
        );
      }
    }
  }
  
  // Log final profile selection
  console.log(`   📋 Final profile directory selected: "${finalProfileDir}"`);
  
  // CRITICAL: Never use Default profile with remote debugging - Chrome rejects it
  // UNLESS it's the only profile (single profile setup) - then we try it anyway
  if (finalProfileDir === 'Default' && !skipProfileArgs) {
    console.log(`   ❌ ERROR: Attempted to use 'Default' profile - this will fail with remote debugging!`);
    try {
      const entries = fs.readdirSync(finalUserDataDir, { withFileTypes: true });
      const profiles = entries
        .filter(e => e.isDirectory() && e.name.startsWith('Profile'))
        .map(e => e.name);
      
      if (profiles.length > 0) {
        throw new Error(
          `Cannot use 'Default' profile with remote debugging. ` +
          `Chrome requires a non-default profile directory. ` +
          `Available Profile directories: ${profiles.join(', ')}. ` +
          `Please set CHROME_PROFILE_DIR to one of these (e.g., CHROME_PROFILE_DIR=Profile 1).`
        );
      } else {
        throw new Error(
          `Cannot use 'Default' profile with remote debugging. ` +
          `Chrome requires a non-default profile directory. ` +
          `Please create a named profile in Chrome first, then set CHROME_PROFILE_DIR.`
        );
      }
    } catch (error: any) {
      if (error.message.includes('Cannot use')) {
        throw error;
      }
      // If we can't list profiles, still warn but allow Default as last resort
      console.log(`   ⚠️  WARNING: Using 'Default' profile - remote debugging may fail!`);
    }
  }

  // Add both user-data-dir and profile-directory to ensure we use the actual profile with extensions
  // CRITICAL: Must use both flags to bypass profile picker and use the specific profile
  // UNLESS we're in single Default profile mode - then skip these args
  if (!skipProfileArgs) {
    args.push(`--user-data-dir=${finalUserDataDir}`);
    args.push(`--profile-directory=${finalProfileDir}`);
    // Also add flag to prevent profile picker from showing
    args.push('--no-first-run');
    args.push('--no-default-browser-check');
    
    console.log(`   🎯 FINAL PROFILE SELECTION: "${finalProfileDir}"`);
    console.log(`   📂 User Data Dir: ${finalUserDataDir}`);
    console.log(`   🔑 Profile Directory: ${finalProfileDir}`);

    console.log(`   Using Chrome User Data: ${finalUserDataDir}`);
    console.log(`   Using Chrome Profile: ${finalProfileDir}`);
    console.log(`   ✅ Extensions will be available from your Chrome profile\n`);
  } else {
    // Single Default profile - try using Default explicitly since it's the only profile
    // Chrome might accept Default profile with remote debugging when it's the only option
    args.push(`--user-data-dir=${finalUserDataDir}`);
    args.push(`--profile-directory=Default`);
    // Add flags to prevent prompts that might block remote debugging
    args.push('--no-first-run');
    args.push('--no-default-browser-check');
    // Additional flags for Default profile to prevent more prompts
    args.push('--disable-default-apps');
    args.push('--disable-sync'); // Prevent "Sign in to sync" prompts
    args.push('--no-service-autorun');
    args.push('--password-store=basic'); // Prevent password manager prompts
    
    console.log(`   ℹ️  Using Default profile explicitly (single profile setup)`);
    console.log(`   📂 User Data Dir: ${finalUserDataDir}`);
    console.log(`   🔑 Profile Directory: Default`);
    console.log(`   ✅ Extensions will be available from your default Chrome profile\n`);
  }

  console.log(`\n🚀 Starting Chrome with remote debugging on port ${port}...`);
  console.log(`   Chrome path: ${chromePath}`);
  console.log(`   ⚠️  IMPORTANT: Chrome window will open visibly - watch for it!`);
  console.log(`   If you don't see Chrome open, check Task Manager for chrome.exe\n`);

  // First, make sure no Chrome instances are running with this profile
  console.log(`   🔍 Checking for existing Chrome processes...`);
  try {
    if (process.platform === 'win32') {
      const { exec } = require('child_process');
      await new Promise<void>((resolve) => {
        exec('tasklist /FI "IMAGENAME eq chrome.exe"', (error: any, stdout: string) => {
          if (stdout.includes('chrome.exe')) {
            console.log(`   ⚠️  Chrome processes detected. Closing them...`);
            exec('taskkill /F /IM chrome.exe /T', () => {
              console.log(`   ✅ Closed existing Chrome processes`);
              setTimeout(resolve, 3000); // Wait 3 seconds for cleanup
            });
          } else {
            resolve();
          }
        });
      });
    }
  } catch (e) {
    console.log(`   ⚠️  Could not check for existing Chrome: ${(e as Error).message}`);
  }
  
  // Start Chrome - it will open visibly (not headless)
  // Use spawn with proper Windows handling
  console.log(`   Executing: ${chromePath}`);
  console.log(`   Args: ${args.join(' ')}`);
  
  const chromeProcess = child_process.spawn(chromePath, args, {
    detached: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    shell: false,
    windowsVerbatimArguments: false,
  });
  
  console.log(`   Chrome process started with PID: ${chromeProcess.pid || 'unknown'}`);
  
  // Check immediately if process died
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  if (chromeProcess.pid) {
    try {
      process.kill(chromeProcess.pid, 0); // Check if still exists
    } catch (e) {
      throw new Error(
        `Chrome process (PID: ${chromeProcess.pid}) exited immediately after starting.\n\n` +
        `This usually means:\n` +
        `- Another Chrome instance is using the profile directory "${finalProfileDir}"\n` +
        `- Chrome profile is locked by another process\n` +
        `- The profile directory doesn't exist or is corrupted\n\n` +
        `SOLUTION:\n` +
        `1. Close ALL Chrome windows completely (check Task Manager for chrome.exe)\n` +
        `2. Wait 5 seconds\n` +
        `3. Run: taskkill /F /IM chrome.exe\n` +
        `4. Wait another 5 seconds\n` +
        `5. Try the analysis again\n\n` +
        `Profile being used: "${finalProfileDir}"\n` +
        `User Data Dir: "${finalUserDataDir}"`
      );
    }
  }
  
  // Log any errors from Chrome startup
  chromeProcess.stderr?.on('data', (data: Buffer) => {
    const errorMsg = data.toString();
    if (errorMsg.trim()) {
      console.log(`   Chrome stderr: ${errorMsg.trim()}`);
    }
  });
  
  chromeProcess.on('error', (error) => {
    console.error(`   ❌ Failed to spawn Chrome process: ${error.message}`);
    throw error;
  });
  
  // Unref so parent process doesn't wait
  chromeProcess.unref();

  // Track retry process (declared early for scope)
  let retryChromeProcess: child_process.ChildProcess | null = null;

  // Give Chrome extra time to initialize remote debugging (extensions take longer on Windows)
  // Default profile might take longer, so give it 30s instead of 20s
  const initialWait = skipProfileArgs ? 30000 : 20000; // 30s for Default, 20s otherwise
  console.log(`   ⏳ Waiting ${initialWait/1000}s for Chrome remote debugging to initialize...`);
  console.log(`   Extensions (like Keywords Everywhere) need time to load...`);
  console.log(`   ⏳ Please wait - do NOT close Chrome during this time...`);
  await new Promise(resolve => setTimeout(resolve, initialWait));
  
  // Check if port is responding after initial wait
  const portResponding = await isChromeRunning(port);
  if (portResponding) {
    console.log(`   ✅ Chrome remote debugging is responding on port ${port}!`);
    return; // Success!
  }
  
  // If port still not responding after 20s, kill Chrome and retry once
  console.log(`   ⚠️  Port ${port} not responding after 20 seconds. Killing Chrome and retrying...`);
  try {
    if (chromeProcess.pid) {
      console.log(`   🔪 Killing Chrome process (PID: ${chromeProcess.pid})...`);
      process.kill(chromeProcess.pid, 'SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to kill forcefully if still running
      try {
        process.kill(chromeProcess.pid, 0); // Check if still exists
        process.kill(chromeProcess.pid, 'SIGKILL');
      } catch {
        // Process already dead
      }
      
      // Also kill any remaining Chrome processes on Windows
      if (process.platform === 'win32') {
        try {
          const { exec } = require('child_process');
          exec(`taskkill /F /IM chrome.exe /T`, () => {});
        } catch {
          // Ignore errors
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log(`   🔄 Retrying Chrome startup...`);
    }
  } catch (error) {
    console.log(`   ⚠️  Error killing Chrome: ${(error as Error).message}`);
  }
  
  // Retry: Start Chrome again
  console.log(`   🔄 Starting Chrome again (retry attempt)...`);
  retryChromeProcess = child_process.spawn(chromePath, args, {
    detached: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    shell: false,
    windowsVerbatimArguments: false,
  });
  
  console.log(`   Retry Chrome process started with PID: ${retryChromeProcess.pid || 'unknown'}`);
  
  retryChromeProcess.stderr?.on('data', (data: Buffer) => {
    const errorMsg = data.toString();
    if (errorMsg.trim()) {
      console.log(`   Retry Chrome stderr: ${errorMsg.trim()}`);
    }
  });
  
  retryChromeProcess.on('error', (error) => {
    console.error(`   ❌ Failed to spawn retry Chrome process: ${error.message}`);
  });
  
  retryChromeProcess.unref();
  
  // Wait again for remote debugging
  console.log(`   Waiting another 20 seconds for retry Chrome to initialize...`);
  await new Promise(resolve => setTimeout(resolve, 20000));

  // Wait for Chrome to start (check multiple times with longer timeout)
  console.log(`   Now checking if Chrome remote debugging is responding on port ${port}...`);
  console.log(`   This can take up to 60 more seconds on Windows with extensions...`);
  let isRunning = false;
  const maxAttempts = 30; // 30 more seconds (checking every 2 seconds)
  let chromeProcessExists = false;
  
  // Use retry process if we're in retry mode, otherwise use original
  const activeProcess = retryChromeProcess?.pid ? retryChromeProcess : chromeProcess;
  
  // First verify Chrome process is actually running
  if (activeProcess.pid) {
    try {
      process.kill(activeProcess.pid, 0); // Signal 0 checks if process exists
      chromeProcessExists = true;
      console.log(`   ✅ Chrome process is running (PID: ${activeProcess.pid})`);
    } catch (e) {
      console.error(`   ❌ Chrome process (PID: ${activeProcess.pid}) no longer exists!`);
      throw new Error(
        `Chrome process exited immediately. This usually means:\n` +
        `- Another Chrome instance is using the profile directory\n` +
        `- Close ALL Chrome windows and try again\n` +
        `- Or Chrome profile is locked\n\n` +
        `Try: Close all Chrome windows completely, wait 5 seconds, then run analysis again.`
      );
    }
  }
  
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Periodically verify Chrome process is still alive
    if (activeProcess.pid && i % 10 === 0) {
      try {
        process.kill(activeProcess.pid, 0);
        chromeProcessExists = true;
      } catch (e) {
        chromeProcessExists = false;
        console.error(`   ❌ Chrome process died during startup!`);
        throw new Error(
          `Chrome process exited during startup. This usually means:\n` +
          `- Chrome profile is locked by another instance\n` +
          `- User data directory is in use\n` +
          `- Close ALL Chrome windows and try again`
        );
      }
    }
    
    // Check if Chrome remote debugging is responding on the port
    isRunning = await isChromeRunning(port);
    if (isRunning) {
      const totalTime = 20 + (i * 2) + (retryChromeProcess?.pid ? 40 : 0);
      console.log(`✅ Chrome started successfully on port ${port} (took ${totalTime} seconds total)`);
      console.log(`   ⚠️  You should see a Chrome window open now!\n`);
      break;
    }
    
    if (i === 0) {
      console.log(`   Checking if Chrome remote debugging is responding... (attempt ${i + 1}/${maxAttempts})`);
    } else if (i % 5 === 0) {
      const elapsed = 20 + (i * 2) + (retryChromeProcess?.pid ? 40 : 0);
      console.log(`   Still waiting... Chrome is starting with extensions... (${elapsed}s elapsed, attempt ${i + 1}/${maxAttempts})`);
      // Also verify Chrome process is still running
      if (activeProcess.pid) {
        try {
          process.kill(activeProcess.pid, 0);
          console.log(`   ✅ Chrome process is still running (PID: ${activeProcess.pid})`);
        } catch (e) {
          console.log(`   ⚠️  Warning: Chrome process check failed, but continuing...`);
        }
      }
    }
  }

  if (!isRunning) {
    // Check if Chrome process is still running
    let processStillAlive = false;
    if (activeProcess.pid) {
      try {
        process.kill(activeProcess.pid, 0);
        processStillAlive = true;
      } catch (e) {
        processStillAlive = false;
      }
    }
    
    if (!chromeProcessExists || !processStillAlive) {
      throw new Error(
        `Chrome process failed to start or exited immediately.\n\n` +
        `This usually means:\n` +
        `- Another Chrome instance is using the profile directory (MOST COMMON)\n` +
        `- User data directory is locked\n` +
        `- Chrome cannot start with the specified profile\n\n` +
        `SOLUTION:\n` +
        `1. Close ALL Chrome windows completely (all tabs, all windows)\n` +
        `2. Wait 5 seconds\n` +
        `3. Check Task Manager - make sure no chrome.exe processes are running\n` +
        `4. Start the analysis again\n\n` +
        `If this persists, you may need to restart your computer to fully clear Chrome locks.`
      );
    } else {
      // Chrome is running but remote debugging isn't responding
      throw new Error(
        `Chrome process is running but remote debugging did not respond on port ${port} after 75 seconds.\n` +
        `Chrome PID: ${chromeProcess.pid}\n\n` +
        `This usually means:\n` +
        `- Chrome started but remote debugging port didn't enable\n` +
        `- Extensions are taking longer than expected to load\n` +
        `- Another process might be using port ${port}\n` +
        `- Chrome profile might have issues\n\n` +
        `Try:\n` +
        `1. Close all Chrome windows\n` +
        `2. Wait 10 seconds\n` +
        `3. Manually start Chrome with: chrome.exe --remote-debugging-port=9222\n` +
        `4. Check if http://127.0.0.1:9222/json works in your browser\n` +
        `5. Then start the analysis again`
      );
    }
  }
}

/**
 * Ensure Chrome is running with remote debugging and Keywords Everywhere is enabled
 * This will start Chrome automatically if not running, using the user's profile
 */
export async function ensureChromeReady(
  port: number = 9222,
  userDataDir?: string,
  profileDir?: string
): Promise<void> {
  // Import cancellation check
  const { isGloballyCancelled } = await import('./searchatlas');
  
  // Check for cancellation before launching Chrome
  if (isGloballyCancelled()) {
    throw new Error('Analysis cancelled - stopping Chrome launch');
  }

  // Check if Chrome is already running with remote debugging
  const isRunning = await isChromeRunning(port);

  if (!isRunning) {
    // Check if regular Chrome is running (could interfere)
    console.log('🔍 Checking for existing Chrome processes...');
    try {
      // On Windows, check if chrome.exe is running
      
      const platform = process.platform;
      if (platform === 'win32') {
        try {
          const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV');
          if (stdout.includes('chrome.exe')) {
            console.log('⚠️  Chrome is already running!');
            console.log('   Closing existing Chrome windows to prevent conflicts...');
            console.log('   You may see Chrome windows close - this is normal.\n');
            
            // Try to close Chrome gracefully first
            try {
              await execAsync('taskkill /IM chrome.exe /T');
              await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
            } catch (e) {
              // If graceful close fails, try force kill
              try {
                await execAsync('taskkill /F /IM chrome.exe /T');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
              } catch (e2) {
                console.log('   ⚠️  Could not close Chrome automatically');
                console.log('   Please close ALL Chrome windows manually, then try again.\n');
                throw new Error(
                  'Chrome is already running and could not be closed automatically.\n' +
                  'Please close ALL Chrome windows manually, wait 5 seconds, then try again.'
                );
              }
            }
          }
        } catch (e) {
          // If tasklist fails, continue anyway - Chrome might not be running
        }
      }
    } catch (e) {
      // Continue if we can't check for Chrome processes
    }
    // Check cancellation again before launching
    if (isGloballyCancelled()) {
      throw new Error('Analysis cancelled - stopping Chrome launch');
    }
    
    console.log('🔄 Chrome is not running with remote debugging.');
    console.log('   Starting Chrome automatically with your profile...');
    console.log('   ⚠️  Chrome window will open - watch for it!\n');
    
    try {
      await startChromeWithDebugging(port, userDataDir, profileDir);
      
      // startChromeWithDebugging already waits and verifies, so we're good here
      console.log('✅ Chrome is ready with your profile!\n');
    } catch (error: any) {
      console.error(`\n❌ Failed to start Chrome: ${error.message}\n`);
      throw error;
    }
  } else {
    console.log(`✅ Chrome is already running with remote debugging on port ${port}`);
    console.log(`   Connecting to existing Chrome window (no new window will open).`);
    console.log(`   Make sure it's using your Chrome profile (not guest mode) for extensions to work.\n`);
  }

  // Give Chrome a moment to fully initialize
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

/**
 * Verify Keywords Everywhere extension is enabled
 * This checks if we can access extension APIs (indicating extensions are loaded)
 */
export async function verifyKeywordsEverywhereEnabled(
  context: any
): Promise<boolean> {
  try {
    const page = await context.newPage();
    
    // Navigate to a simple page to check for Keywords Everywhere
    await page.goto('https://www.google.com/search?q=test', {
      waitUntil: 'networkidle',
      timeout: 10000,
    });

    // Wait a bit for extension to inject
    await page.waitForTimeout(3000);

    // Check if Keywords Everywhere has injected any elements
    // Look for common Keywords Everywhere indicators
    const hasKWElements = await page.evaluate(() => {
      // Check for Keywords Everywhere injected elements
      const selectors = [
        '[class*="kw"]',
        '[class*="keywords-everywhere"]',
        '[id*="kw"]',
        '[data-kw]',
      ];

      // @ts-ignore - document exists in browser context
      for (const selector of selectors) {
        // @ts-ignore - document exists in browser context
        if (document.querySelector(selector)) {
          return true;
        }
      }

      // Check if chrome.runtime is available (extensions loaded)
      // @ts-ignore - window exists in browser context
      if ((window as any).chrome && (window as any).chrome.runtime) {
        return true;
      }

      return false;
    });

    await page.close();

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

