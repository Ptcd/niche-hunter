/**
 * Supported AI Models by Provider
 * This file documents available models for reference
 */

export const OPENAI_MODELS = {
  // GPT-5 Models (Latest)
  'gpt-5-nano': {
    name: 'GPT-5 Nano',
    description: 'Fastest and most cost-effective GPT-5 model',
    recommended: true,
  },
  'gpt-5': {
    name: 'GPT-5',
    description: 'Standard GPT-5 model with balanced performance',
  },
  'gpt-5-turbo': {
    name: 'GPT-5 Turbo',
    description: 'Faster GPT-5 variant with optimized latency',
  },
  'gpt-5-pro': {
    name: 'GPT-5 Pro',
    description: 'Highest quality GPT-5 model for complex tasks',
  },
  
  // GPT-4 Models (Legacy)
  'gpt-4': {
    name: 'GPT-4',
    description: 'Previous generation high-quality model',
  },
  'gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    description: 'Faster GPT-4 variant',
  },
  'gpt-4o': {
    name: 'GPT-4o',
    description: 'Optimized GPT-4 model',
  },
  
  // GPT-3.5 Models (Legacy)
  'gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    description: 'Fast and affordable legacy model',
  },
} as const;

export const ANTHROPIC_MODELS = {
  'claude-3-opus-20240229': {
    name: 'Claude 3 Opus',
    description: 'Most capable Claude 3 model',
  },
  'claude-3-sonnet-20240229': {
    name: 'Claude 3 Sonnet',
    description: 'Balanced Claude 3 model',
  },
  'claude-3-haiku-20240307': {
    name: 'Claude 3 Haiku',
    description: 'Fastest Claude 3 model',
  },
} as const;

export type OpenAIModel = keyof typeof OPENAI_MODELS;
export type AnthropicModel = keyof typeof ANTHROPIC_MODELS;

/**
 * Check if a model name is a GPT-5 variant
 */
export function isGPT5Model(model: string): boolean {
  return model.startsWith('gpt-5');
}

/**
 * Get recommended model for a provider
 */
export function getRecommendedModel(provider: 'openai' | 'anthropic'): string {
  if (provider === 'openai') {
    return 'gpt-5-nano';
  }
  return 'claude-3-sonnet-20240229';
}

