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
 * Make an OpenAI chat completion call with detailed logging
 */
export async function chatWithFallback(
  options: Omit<OpenAI.Chat.ChatCompletionCreateParams, 'model'> & { model: string }
): Promise<OpenAI.Chat.ChatCompletion> {
  const openai = getOpenAI();
  const model = options.model;
  
  console.log(`[OpenAI] Calling model: ${model}`);
  console.log(`[OpenAI] Max tokens: ${options.max_tokens}`);
  
  try {
    const result = await openai.chat.completions.create({
      ...options,
      model,
      stream: false,
    });
    
    console.log(`[OpenAI] Response from ${model}`);
    console.log(`[OpenAI] Finish reason: ${result.choices[0]?.finish_reason}`);
    console.log(`[OpenAI] Content length: ${result.choices[0]?.message?.content?.length || 0}`);
    
    // Check for refusal
    const message = result.choices[0]?.message;
    if ((message as any)?.refusal) {
      console.error(`[OpenAI] Model refused: ${(message as any).refusal}`);
      throw new Error(`GPT refused: ${(message as any).refusal}`);
    }
    
    const content = message?.content;
    if (!content || content.trim().length === 0) {
      console.error(`[OpenAI] Empty content. Full response:`, JSON.stringify(result, null, 2));
      throw new Error(`GPT returned empty content. Finish reason: ${result.choices[0]?.finish_reason}`);
    }
    
    return result;
  } catch (error: any) {
    console.error(`[OpenAI] Error:`, error.message);
    throw error;
  }
}

/**
 * Get the fallback model for a given model
 */
export function getFallbackModel(model: string): string {
  const fallbacks = MODEL_FALLBACKS[model];
  return fallbacks ? fallbacks[fallbacks.length - 1] : model;
}

