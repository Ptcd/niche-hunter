# Environment Variables for Vercel Deployment

Add these to your Vercel project: **Settings → Environment Variables**

## 🔴 Required (Core System)

```bash
# Database Connection
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"

# Supabase Auth (Multi-tenant system)
NEXT_PUBLIC_SUPABASE_URL="https://fpwayqwhdendrgtottwj.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."  # From Supabase Dashboard → Settings → API
SUPABASE_SERVICE_ROLE_KEY="eyJ..."      # Secret key (keep secure!)

# Access Code (Signup gating)
SIGNUP_ACCESS_CODE="o0fw8j"

# Cron Security
CRON_SECRET="your-random-secret-string-here"  # Generate: openssl rand -hex 32
```

## 🟡 Required (Site Factory Features)

```bash
# WordPress Integration
WP_APP_URL="https://your-wordpress-site.com"
WP_APP_USER="your-wp-username"
WP_APP_PASS="your-wp-application-password"

# OpenAI (AI Content Generation)
OPENAI_API_KEY="sk-..."

# At least ONE phone provider:
# Option 1: Twilio
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_DEFAULT_COUNTRY="US"
TWILIO_VOICE_WEBHOOK_URL="https://your-vercel-domain.vercel.app/api/webhooks/twilio"

# Option 2: Ringba
RINGBA_API_TOKEN="your-ringba-token"
RINGBA_ACCOUNT_ID="your-ringba-account-id"

# Option 3: VoIP.ms (Bearer Token)
VOIPMS_API_TOKEN="aIdPNHNFUkFV5JRNb2JPU29FcHBnM1FpOGZSbJJobnNUR2JYQ0xzduFFTS10="
```

## 🟢 Optional (Enhanced Features)

```bash
# Google Search Console (for metrics)
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'  # Single-line JSON

# Domain Registration (Namecheap)
NAMECHEAP_API_USER="your-namecheap-api-user"
NAMECHEAP_API_KEY="your-namecheap-api-key"
NAMECHEAP_USERNAME="your-namecheap-username"
NAMECHEAP_CLIENT_IP="your-public-ip-address"

# SearchAtlas (keyword research)
SEARCHATLAS_API_KEY="your-searchatlas-key"

# Keywords Everywhere
KEYWORDS_EVERYWHERE_API_KEY=""
KEYWORDS_EVERYWHERE_COUNTRY="us"
KEYWORDS_EVERYWHERE_CURRENCY="usd"
KEYWORDS_EVERYWHERE_DATA_SOURCE="cli"

# DataForSEO
DATAFORSEO_LOGIN=""
DATAFORSEO_PASSWORD=""
```

## 📋 Quick Copy-Paste for Vercel

**Minimum Required (copy these first):**
```
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SIGNUP_ACCESS_CODE
CRON_SECRET
WP_APP_URL
WP_APP_USER
WP_APP_PASS
OPENAI_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_VOICE_WEBHOOK_URL
```

## ⚠️ Important Notes for Vercel

1. **TWILIO_VOICE_WEBHOOK_URL**: Update this to your Vercel domain:
   ```
   https://your-app.vercel.app/api/webhooks/twilio
   ```

2. **Environment Scope**: Set variables for:
   - **Production** (required)
   - **Preview** (optional, for testing)
   - **Development** (optional)

3. **NEXT_PUBLIC_*** variables: These are exposed to the browser, so they're safe to use client-side.

4. **Secret Keys**: Never commit these to Git. Only add them in Vercel dashboard.

5. **After Adding Variables**: 
   - Redeploy your app for changes to take effect
   - Or trigger a new deployment

## 🔗 Where to Find Values

- **Supabase**: Dashboard → Settings → API
- **Twilio**: Console → Account → Account SID & Auth Token
- **OpenAI**: https://platform.openai.com/api-keys
- **WordPress**: Users → Profile → Application Passwords

