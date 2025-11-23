export type AIProvider = 'openai' | 'anthropic' | 'custom';

export interface AIModelConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseURL?: string; // For custom providers
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

