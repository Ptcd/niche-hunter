import { z } from 'zod';

export const RunConfigSchema = z.object({
  niche: z.string(),
  payout: z.number().positive().optional(),
  revenueFile: z.string().optional(),
  citiesFile: z.string(),
  limit: z.number().int().positive().max(100).default(100),
  ctr: z.number().min(0).max(1).optional(),
  siteConv: z.number().min(0).max(1).optional(),
  leadConv: z.number().min(0).max(1).optional(),
});

export type RunConfig = z.infer<typeof RunConfigSchema>;

export interface IntentWeights {
  core: number;
  transactional: number;
  emergency: number;
  adjacency: number;
}

export interface DifficultySignals {
  hasLocalPack: boolean;
  aggregatorCount: number;
  directoryCount: number;
  emdCount: number;
  pmdCount: number;
  thinPageRatio: number;
  avgTitleContainsCity: number;
}

export interface ScoreBreakdown {
  demandScore: number;
  difficulty: number;
  opportunity: number;
  profitEst?: number;
  classification: 'super easy' | 'kind of easy' | 'challenging';
}

export interface KeywordTaxonomy {
  core: string[];
  transactional: string[];
  emergency: string[];
  adjacency: string[];
}

export interface SerpResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
  // Source of the result in the SERP. 'local' = local pack/map pack, 'organic' = standard organic result
  source?: 'local' | 'organic';
  domain?: string;
  metaDescription?: string;
  estimatedWordCount?: number;
  hasImages?: boolean;
  hasVideos?: boolean;
}

export interface SerpData {
  query: string;
  results: SerpResult[];
  hasLocalPack: boolean;
  localPackCount?: number;
  relatedKeywords?: string[];
}

export interface Location {
  city: string;
  state: string;
  zip?: string;
}

export interface KeywordMetrics {
  keyword: string;
  volume: number;
  difficulty?: number; // 0-100 scale
  intent?: 'core' | 'transactional' | 'emergency' | 'adjacency';
  cpc?: number;
  priority?: number; // Calculated: volume × (1 / difficulty) × intent weight
}

export interface LeadEstimate {
  conservative: number; // Rank #5 estimate
  realistic: number; // Rank #3 estimate
  optimistic: number; // Rank #1 estimate
  monthlyValue: {
    conservative: number;
    realistic: number;
    optimistic: number;
  };
}

export interface CompetitorInfo {
  domain: string;
  title: string;
  url: string;
  position: number;
  type: 'local-business' | 'aggregator' | 'directory' | 'lead-gen' | 'unknown';
  contentQuality: 'high' | 'medium' | 'low';
  estimatedDA?: number;
}

