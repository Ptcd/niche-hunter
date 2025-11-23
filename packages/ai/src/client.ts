import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { AIModelConfig, ChatMessage, AIResponse } from './types';

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getOpenAIClient(apiKey?: string): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

function getAnthropicClient(apiKey?: string): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

async function callOpenAI(
  model: string,
  messages: ChatMessage[],
  config?: AIModelConfig
): Promise<AIResponse> {
  const client = getOpenAIClient(config?.apiKey);

  const response = await client.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: config?.temperature ?? 0.7,
    max_tokens: config?.maxTokens,
  });

  const choice = response.choices[0];
  if (!choice || !choice.message) {
    throw new Error('No response from OpenAI');
  }

  return {
    content: choice.message.content || '',
    model: response.model,
    usage: response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined,
  };
}

async function callAnthropic(
  model: string,
  messages: ChatMessage[],
  config?: AIModelConfig
): Promise<AIResponse> {
  const client = getAnthropicClient(config?.apiKey);

  // Convert messages to Anthropic format
  const systemMessage = messages.find((m) => m.role === 'system');
  const conversationMessages = messages.filter((m) => m.role !== 'system');

  const response = await (client as any).messages.create({
    model,
    max_tokens: config?.maxTokens ?? 1024,
    temperature: config?.temperature ?? 0.7,
    system: systemMessage?.content,
    messages: conversationMessages.map((m: ChatMessage) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('No text response from Anthropic');
  }

  return {
    content: content.text,
    model: response.model,
    usage: {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}

async function callCustom(
  model: string,
  messages: ChatMessage[],
  config: AIModelConfig
): Promise<AIResponse> {
  if (!config.baseURL || !config.apiKey) {
    throw new Error('Custom provider requires baseURL and apiKey');
  }

  // Generic OpenAI-compatible API call
  const response = await fetch(`${config.baseURL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`Custom API error: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: any;
  };
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content || '',
    model: data.model || model,
    usage: data.usage,
  };
}

export async function callAI(
  messages: ChatMessage[],
  config: AIModelConfig
): Promise<AIResponse> {
  const { provider, model } = config;

  switch (provider) {
    case 'openai':
      return callOpenAI(model, messages, config);
    case 'anthropic':
      return callAnthropic(model, messages, config);
    case 'custom':
      return callCustom(model, messages, config);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export function getAIConfig(): AIModelConfig {
  const provider = (process.env.AI_PROVIDER || 'openai') as AIModelConfig['provider'];
  
  // Default model selection with GPT-5 support
  let defaultModel: string;
  if (provider === 'openai') {
    defaultModel = process.env.AI_MODEL || 'gpt-5-nano'; // Default to GPT-5 Nano
  } else if (provider === 'anthropic') {
    defaultModel = process.env.AI_MODEL || 'claude-3-opus-20240229';
  } else {
    defaultModel = process.env.AI_MODEL || 'gpt-5-nano';
  }

  return {
    provider,
    model: process.env.AI_MODEL || defaultModel,
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL,
    temperature: process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : 0.7,
    maxTokens: process.env.AI_MAX_TOKENS ? parseInt(process.env.AI_MAX_TOKENS, 10) : undefined,
  };
}
