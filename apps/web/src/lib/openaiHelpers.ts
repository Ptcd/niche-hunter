/**
 * OpenAI API Helpers
 * 
 * Provides fallback logic for GPT-5 to GPT-4o models
 */

import OpenAI from 'openai';

// Lazy initialize to avoid issues at build time
let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

// Model fallback configuration
export const MODEL_FALLBACKS: Record<string, string[]> = {
  'gpt-5': ['gpt-5', 'gpt-4o'],
  'gpt-5-mini': ['gpt-5-mini', 'gpt-4o-mini'],
  'gpt-5-nano': ['gpt-5-nano', 'gpt-4o-mini'],
  // Direct fallbacks for GPT-4o models
  'gpt-4o': ['gpt-4o'],
  'gpt-4o-mini': ['gpt-4o-mini'],
};

/**
 * Make an OpenAI chat completion call with automatic fallback
 * Tries GPT-5 first, then falls back to GPT-4o if it fails
 */
export async function chatWithFallback(
  options: Omit<OpenAI.Chat.ChatCompletionCreateParams, 'model'> & { model: string }
): Promise<OpenAI.Chat.ChatCompletion> {
  const openai = getOpenAI();
  const models = MODEL_FALLBACKS[options.model] || [options.model];
  let lastError: Error | null = null;
  
  for (const model of models) {
    try {
      console.log(`[OpenAI] Trying model: ${model}`);
      const result = await openai.chat.completions.create({
        ...options,
        model,
      });
      
      // Check if we got actual content
      const content = result.choices[0]?.message?.content;
      if (content && content.trim().length > 0) {
        console.log(`[OpenAI] Success with model: ${model}`);
        return result;
      }
      
      console.warn(`[OpenAI] Model ${model} returned empty content, trying fallback...`);
      lastError = new Error(`Model ${model} returned empty content`);
    } catch (error: any) {
      console.warn(`[OpenAI] Model ${model} failed: ${error.message}, trying fallback...`);
      lastError = error;
    }
  }
  
  throw lastError || new Error('All models failed');
}

/**
 * Get the fallback model for a given model
 */
export function getFallbackModel(model: string): string {
  const fallbacks = MODEL_FALLBACKS[model];
  return fallbacks ? fallbacks[fallbacks.length - 1] : model;
}

