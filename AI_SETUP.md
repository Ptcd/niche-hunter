# AI API Setup Guide

This tool supports AI-powered features like automatic keyword taxonomy generation and opportunity analysis. Configure your AI provider and model in `.env`.

## Supported Providers

### OpenAI
- **GPT-5 Models**: `gpt-5-nano`, `gpt-5`, `gpt-5-turbo`, `gpt-5-pro`, etc.
- **GPT-4 Models**: `gpt-4`, `gpt-4-turbo`, `gpt-4o`, etc.
- **GPT-3.5 Models**: `gpt-3.5-turbo`, etc.
- **API Key**: Get from https://platform.openai.com/api-keys
- **Default**: `gpt-5-nano` (fastest, cost-effective)

### Anthropic (Claude)
- **Models**: `claude-3-opus-20240229`, `claude-3-sonnet-20240229`, `claude-3-haiku-20240307`
- **API Key**: Get from https://console.anthropic.com/

### Custom Providers
- OpenRouter, Together AI, or any OpenAI-compatible API
- Requires `baseURL` and `apiKey` in config

## Configuration

Add to your `.env` file:

```env
# AI Provider Selection
AI_PROVIDER=openai              # 'openai', 'anthropic', or 'custom'
AI_MODEL=gpt-4                  # Model name (varies by provider)
AI_API_KEY=sk-...               # Your API key

# Optional Settings
AI_TEMPERATURE=0.7              # 0-1, controls randomness
AI_MAX_TOKENS=2000              # Max response length

# For Custom Providers Only
AI_BASE_URL=https://api.openrouter.ai/v1
```

## Examples

### OpenAI (GPT-5 Nano - Recommended)
```env
AI_PROVIDER=openai
AI_MODEL=gpt-5-nano
AI_API_KEY=sk-your-key-here
```

### OpenAI (Other GPT-5 Models)
```env
AI_PROVIDER=openai
AI_MODEL=gpt-5              # Standard GPT-5
# or
AI_MODEL=gpt-5-turbo        # Faster GPT-5
# or
AI_MODEL=gpt-5-pro          # Highest quality GPT-5
AI_API_KEY=sk-your-key-here
```

### OpenAI (GPT-4 - Legacy)
```env
AI_PROVIDER=openai
AI_MODEL=gpt-4
AI_API_KEY=sk-your-key-here
```

### Anthropic (Claude)
```env
AI_PROVIDER=anthropic
AI_MODEL=claude-3-sonnet-20240229
AI_API_KEY=sk-ant-your-key-here
```

### OpenRouter (Access Multiple Models)
```env
AI_PROVIDER=custom
AI_MODEL=anthropic/claude-3-opus
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=sk-or-your-key-here
```

## Usage

### Generate Keyword Taxonomy

Automatically generate keyword lists for a new niche:

```bash
npx niche-hunter generate-keywords --niche "junk-car-removal"
```

This will:
1. Call your configured AI model
2. Generate keywords organized by intent (core, transactional, emergency, adjacency)
3. Save to `packages/core/keywords/junk-car-removal.json`

**Override model for one command:**
```bash
npx niche-hunter generate-keywords --niche "plumbing" --provider openai --model gpt-3.5-turbo
```

## Model Selection Tips

### GPT-5 Models (Recommended)
- **Fastest/Cost-Effective**: `gpt-5-nano` ⚡ (Default)
- **Balanced**: `gpt-5-turbo` 
- **Best Quality**: `gpt-5` or `gpt-5-pro`

### Legacy Models
- **Cost-Effective**: `gpt-3.5-turbo` or `claude-3-haiku-20240307`
- **Best Quality (Legacy)**: `gpt-4` or `claude-3-opus-20240229`
- **Balanced (Legacy)**: `gpt-4-turbo` or `claude-3-sonnet-20240229`

## Cost Considerations

- Keyword generation: ~500-1000 tokens per niche (~$0.01-0.03 with GPT-4)
- Opportunity analysis: ~300-600 tokens per location
- AI features are optional - tool works without AI for manual keyword entry

## Troubleshooting

**"API key not found"**
- Set `AI_API_KEY` in `.env`
- For custom providers, also set `AI_BASE_URL`

**"Unsupported provider"**
- Check `AI_PROVIDER` is one of: `openai`, `anthropic`, `custom`
- For custom, ensure `AI_BASE_URL` is set

**"Rate limit exceeded"**
- Add delays between requests
- Use a lower-tier model
- Check your API quota

## Future AI Features

Planned enhancements:
- AI-powered SERP content analysis
- Automatic opportunity insights
- Market trend analysis
- Competitive intelligence summaries
