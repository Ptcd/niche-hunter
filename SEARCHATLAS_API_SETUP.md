# SearchAtlas API Setup Guide

## Overview

The SearchAtlas API integration allows you to fetch keyword search volumes without using browser automation. This is faster, more reliable, and doesn't require Chrome.

## Configuration

### Required

Add to your `.env` or `.env.local` file:

```env
SEARCHATLAS_API_KEY=your_api_key_here
```

### Optional Configuration

```env
# Base API URL (default: https://api.searchatlas.com/v1)
SEARCHATLAS_API_URL=https://api.searchatlas.com/v1

# API endpoint path (default: /keywords/volume)
SEARCHATLAS_API_ENDPOINT=/keywords/volume

# Authentication method: 'bearer', 'header', or 'query' (default: 'bearer')
SEARCHATLAS_AUTH_METHOD=bearer

# Header name for API key auth (default: 'X-API-Key')
# Only used when SEARCHATLAS_AUTH_METHOD=header
SEARCHATLAS_AUTH_HEADER=X-API-Key

# Maximum retries for failed requests (default: 3)
SEARCHATLAS_MAX_RETRIES=3

# Initial retry delay in milliseconds (default: 1000)
SEARCHATLAS_RETRY_DELAY=1000
```

## How It Works

1. **API Detection**: The system checks if `SEARCHATLAS_API_KEY` is set
2. **Automatic Fallback**: If API fails, it automatically falls back to browser method
3. **Multiple Formats**: The API client tries different request formats automatically
4. **Flexible Authentication**: Supports Bearer token, custom header, or query parameter auth
5. **Retry Logic**: Automatically retries on network errors and rate limits

## Authentication Methods

### Bearer Token (Default)
```env
SEARCHATLAS_AUTH_METHOD=bearer
```
Uses: `Authorization: Bearer {api_key}` header

### Custom Header
```env
SEARCHATLAS_AUTH_METHOD=header
SEARCHATLAS_AUTH_HEADER=X-API-Key
```
Uses: `X-API-Key: {api_key}` header (or custom header name)

### Query Parameter
```env
SEARCHATLAS_AUTH_METHOD=query
```
Uses: `?api_key={api_key}` in URL

## Request Formats

The API client automatically tries multiple request formats:

1. `{ keyword: "plumber denver colorado", location: "Denver, CO" }`
2. `{ query: "plumber denver colorado", city: "Denver", state: "CO" }`
3. `{ keywords: ["plumber denver colorado"], geo: "Denver, CO" }`
4. `{ keyword: "plumber", location: { city: "Denver", state: "CO" } }`
5. `{ search_term: "plumber denver colorado", location: "Denver, CO" }`

## Response Parsing

The client automatically tries multiple field names for volume:
- `volume`
- `search_volume`
- `monthly_searches`
- `avg_monthly_searches`
- `data.volume`
- `result.volume`

And for similar keywords:
- `similar_keywords`
- `related_keywords`
- `suggestions`
- `recommendations`
- `data.similar_keywords`
- `result.similar_keywords`

## Troubleshooting

### API Not Being Called

**Check:**
- Is `SEARCHATLAS_API_KEY` set in `.env` or `.env.local`?
- Is the server running? (Restart after adding env var)
- Check server logs for API detection messages

### 401 Unauthorized Error

**Possible causes:**
- Invalid API key
- Wrong authentication method

**Solutions:**
1. Verify API key is correct
2. Try different auth method: `SEARCHATLAS_AUTH_METHOD=header`
3. Check if API key needs to be in a specific format

### 404 Not Found Error

**Possible causes:**
- Wrong API endpoint URL
- Endpoint doesn't exist

**Solutions:**
1. Check `SEARCHATLAS_API_URL` and `SEARCHATLAS_API_ENDPOINT`
2. Verify the endpoint exists in SearchAtlas documentation
3. Contact SearchAtlas support for correct endpoint

### 429 Rate Limit Error

**Solutions:**
- The client automatically retries with exponential backoff
- Wait for rate limit to reset
- Reduce request frequency

### Network Errors

**Solutions:**
- Check internet connection
- Verify API URL is accessible
- Check firewall/proxy settings
- The client automatically retries on network errors

### Volume Always Returns 0

**Possible causes:**
- Wrong request format
- Wrong endpoint
- API returns data in unexpected format

**Solutions:**
1. Check server logs in development mode (shows request/response)
2. Try different request formats by adjusting `SEARCHATLAS_API_ENDPOINT`
3. Verify API response format matches expected structure

## Debug Mode

In development mode (`NODE_ENV=development`), the API client logs:
- Request URL and body
- Response status
- Response data (first 200 chars)
- Retry attempts

This helps identify configuration issues.

## Testing

1. Add `SEARCHATLAS_API_KEY` to `.env.local`
2. Restart the server
3. Start a new analysis
4. Check logs for: `📡 Using SearchAtlas API - no browser needed!`
5. Verify Chrome doesn't launch
6. Check for API success messages in logs

## Fallback Behavior

If the API fails for any reason, the system automatically falls back to browser automation:
- Chrome will launch
- Keywords Everywhere extension will be used
- Analysis continues normally

This ensures the system always works, even if API is unavailable.






