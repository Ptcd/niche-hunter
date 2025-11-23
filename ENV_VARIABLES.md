# Environment Variables for .env.local

Add all of these to your `apps/web/.env.local` file.

## Required Core Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"

# Cron Security (for automated jobs)
CRON_SECRET="your-random-secret-string-here"

# Supabase Auth (for multi-tenant system)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."  # Public anon key from Supabase dashboard
SUPABASE_SERVICE_ROLE_KEY="eyJ..."      # Secret service role key (keep secure!)

# Access Code (for signup gating)
SIGNUP_ACCESS_CODE="o0fw8j"
```

## WordPress Integration

```bash
# WordPress Factory Plugin
WP_APP_URL="https://your-wordpress-site.com"
WP_APP_USER="your-wp-username"
WP_APP_PASS="your-wp-application-password"
```

## OpenAI (AI Content Generation)

```bash
OPENAI_API_KEY="sk-..."
```

## Phone Number Providers

### Twilio
```bash
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_DEFAULT_COUNTRY="US"
TWILIO_VOICE_WEBHOOK_URL="https://your-domain.com/api/webhooks/twilio"
```

### Ringba
```bash
RINGBA_API_TOKEN="your-ringba-token"
RINGBA_ACCOUNT_ID="your-ringba-account-id"
```

### VoIP.ms
```bash
# Your VoIP.ms account email/username
VOIPMS_API_USER="your-email@example.com"
# API password (set in VoIP.ms portal: Main Menu > SOAP and REST/JSON API)
VOIPMS_API_PASSWORD="your-api-password"
```

## Domain Registration (Namecheap)

```bash
NAMECHEAP_API_USER="your-namecheap-api-user"
NAMECHEAP_API_KEY="your-namecheap-api-key"
NAMECHEAP_USERNAME="your-namecheap-username"
NAMECHEAP_CLIENT_IP="your-public-ip-address"
```

## Google Search Console

```bash
# Service Account JSON (paste the entire JSON as a single-line string)
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

## Optional / Advanced

```bash
# WordPress (alternative/legacy)
WORDPRESS_USERNAME="admin"
WORDPRESS_APP_PASSWORD=""

# SearchAtlas (for keyword research)
SEARCHATLAS_API_KEY="your-searchatlas-key"

# Chrome Profile (for crawler)
CHROME_PROFILE_DIR="Profile 1"
CHROME_USER_DATA_DIR=""
CHROME_PROFILE_NAME=""
CHROME_EXECUTABLE_PATH=""

# Keywords Everywhere
KEYWORDS_EVERYWHERE_API_KEY=""
KEYWORDS_EVERYWHERE_COUNTRY="us"
KEYWORDS_EVERYWHERE_CURRENCY="usd"
KEYWORDS_EVERYWHERE_DATA_SOURCE="cli"

# DataForSEO
DATAFORSEO_LOGIN=""
DATAFORSEO_PASSWORD=""

# Algorithm Parameters (optional, have defaults)
CTR="0.05"
SITE_CONV="0.03"
LEAD_CONV="0.30"
ALPHA="0.6"
BETA="0.4"
```

---

## Quick Setup Checklist

**Minimum Required for Site Factory:**
- ✅ `DATABASE_URL`
- ✅ `CRON_SECRET`
- ✅ `WP_APP_URL`, `WP_APP_USER`, `WP_APP_PASS`
- ✅ `OPENAI_API_KEY`
- ✅ At least one phone provider (Twilio, Ringba, or VoIP.ms)

**For Full Functionality:**
- ✅ All phone providers (if you use multiple)
- ✅ `GOOGLE_SERVICE_ACCOUNT_JSON` (for Search Console metrics)
- ✅ `NAMECHEAP_*` (if using domain registration)

---

## Notes

1. **CRON_SECRET**: Generate a random string (e.g., `openssl rand -hex 32`). This secures your cron endpoints.

2. **GOOGLE_SERVICE_ACCOUNT_JSON**: This should be a single-line JSON string. If you have a `.json` file, you can convert it:
   ```bash
   # On Linux/Mac:
   cat service-account.json | jq -c
   
   # Or manually: remove all newlines and ensure it's on one line
   ```

3. **NAMECHEAP_CLIENT_IP**: Your public IP address. You can find it at https://whatismyipaddress.com/

4. **TWILIO_VOICE_WEBHOOK_URL**: The URL where Twilio will send call webhooks. Should point to your deployed app's webhook endpoint.

