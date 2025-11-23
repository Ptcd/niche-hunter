# Chrome Profile Configuration

## Using a Specific Chrome Profile

If you have multiple Chrome profiles (like "Person 1", "Colin", "Mary"), you need to tell the system which one to use so it can access the extensions installed in that profile.

## Setup

### Step 1: Find Your Profile Name

1. Open Chrome
2. Click your profile icon (top right)
3. Note the profile name you want to use (e.g., "Person 1")

### Step 2: Configure in .env

Add to your `.env` file:
```env
CHROME_PROFILE_NAME=Person 1
```

### Step 3: Verify

When you run an analysis, you should see:
```
✅ Found profile "Person 1" -> directory: Profile 1
```

## Why This Matters

- **Extensions are profile-specific** - Each Chrome profile has its own extensions
- **Keywords Everywhere** must be installed in the profile you're using
- Without specifying the profile, the system might use the wrong one or "Default"

## Troubleshooting

### Profile Not Found

If you see:
```
⚠️  Profile "Person 1" not found
```

**Solutions:**
1. Make sure the profile name matches exactly (case insensitive)
2. Make sure the profile exists in Chrome
3. Check that Chrome's Local State file is accessible (may need to close Chrome first)

### Profile Directory Directly

If profile name detection doesn't work, you can specify the directory directly via code:
- "Default" for the default profile
- "Profile 1" for the first additional profile
- "Profile 2" for the second, etc.

The system automatically detects profile names from Chrome's Local State file, so setting `CHROME_PROFILE_NAME` should work for most cases.

## Multiple Profiles

If you have:
- Colin (red)
- Mary (brown)  
- Person 1 (blue) ← Keywords Everywhere installed here

Set `CHROME_PROFILE_NAME=Person 1` to use the blue profile with Keywords Everywhere.

