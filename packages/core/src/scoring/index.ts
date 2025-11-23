import * as fs from 'fs';
import * as path from 'path';
import {
  DifficultySignals,
  ScoreBreakdown,
  IntentWeights,
  KeywordTaxonomy,
} from '../types';

export * from './v5000-engine';

interface DifficultyWeights {
  localPack: number;
  aggregatorCount: number;
  directoryCount: number;
  emdCount: number;
  titleContainsCity: number;
  thinPageRatio: number;
}

interface DifficultyThresholds {
  superEasy: number;
  kindOfEasy: number;
}

function loadDifficultyWeights(): DifficultyWeights {
  const weightsPath = path.join(process.cwd(), 'config', 'weights.json');
  if (!fs.existsSync(weightsPath)) {
    return {
      localPack: 0.25,
      aggregatorCount: 0.25,
      directoryCount: 0.1,
      emdCount: -0.1,
      titleContainsCity: -0.1,
      thinPageRatio: 0.2,
    };
  }
  
  try {
    const config = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));
    return config.difficultyWeights as DifficultyWeights;
  } catch {
    return {
      localPack: 0.25,
      aggregatorCount: 0.25,
      directoryCount: 0.1,
      emdCount: -0.1,
      titleContainsCity: -0.1,
      thinPageRatio: 0.2,
    };
  }
}

function loadDifficultyThresholds(): DifficultyThresholds {
  const weightsPath = path.join(process.cwd(), 'config', 'weights.json');
  if (!fs.existsSync(weightsPath)) {
    return {
      superEasy: 0.3,
      kindOfEasy: 0.6,
    };
  }

  try {
    const config = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));
    return config.difficultyThresholds as DifficultyThresholds;
  } catch {
    return {
      superEasy: 0.3,
      kindOfEasy: 0.6,
    };
  }
}

export function computeDifficulty(signals: DifficultySignals): number {
  const weights = loadDifficultyWeights();

  let difficulty =
    (signals.hasLocalPack ? 1 : 0) * weights.localPack +
    Math.min(signals.aggregatorCount / 3, 1) * weights.aggregatorCount +
    Math.min(signals.directoryCount / 4, 1) * weights.directoryCount +
    Math.min(signals.emdCount / 2, 1) * weights.emdCount +
    signals.avgTitleContainsCity * weights.titleContainsCity +
    signals.thinPageRatio * weights.thinPageRatio;

  return Math.max(0, Math.min(1, difficulty));
}

export function classifyDifficulty(difficulty: number): 'super easy' | 'kind of easy' | 'challenging' {
  const thresholds = loadDifficultyThresholds();

  if (difficulty <= thresholds.superEasy) {
    return 'super easy';
  } else if (difficulty <= thresholds.kindOfEasy) {
    return 'kind of easy';
  } else {
    return 'challenging';
  }
}

export function computeDemandScore(
  volumesByBucket: Record<string, number>,
  taxonomy: KeywordTaxonomy,
  intentWeights: IntentWeights
): number {
  let weightedSum = 0;

  for (const [bucket, volume] of Object.entries(volumesByBucket)) {
    const weight = intentWeights[bucket as keyof IntentWeights] || 1.0;
    weightedSum += weight * Math.log1p(volume);
  }

  // Normalize to [0, 1] using a sigmoid-like transformation
  // This prevents extreme values from dominating
  return 1 / (1 + Math.exp(-weightedSum / 10));
}

export function computeProfitEstimate(
  totalVolume: number,
  keywordCount: number,
  payout: number,
  ctr: number = 0.05,
  siteConv: number = 0.03,
  leadConv: number = 0.3
): number {
  if (keywordCount === 0) return 0;

  const avgVolume = totalVolume / keywordCount;
  const profit =
    avgVolume * ctr * siteConv * leadConv * payout * keywordCount;

  return Math.round(profit * 100) / 100;
}

export function computeOpportunity(
  demandScore: number,
  difficulty: number,
  alpha: number = 0.6,
  beta: number = 0.4
): number {
  const opportunity = alpha * demandScore + beta * (1 - difficulty);
  return Math.max(0, Math.min(1, opportunity));
}

export function computeFinalScore(
  opportunity: number,
  profitEst?: number
): number {
  if (!profitEst || profitEst <= 0) {
    return opportunity;
  }

  // Use profit as a multiplier, but cap it to prevent extreme scaling
  const profitMultiplier = Math.min(1 + Math.log1p(profitEst / 1000), 2);
  return opportunity * profitMultiplier;
}

export function computeScoreBreakdown(
  demandScore: number,
  difficulty: number,
  profitEst?: number,
  alpha?: number,
  beta?: number
): ScoreBreakdown {
  const opportunity = computeOpportunity(demandScore, difficulty, alpha, beta);
  const classification = classifyDifficulty(difficulty);

  return {
    demandScore,
    difficulty,
    opportunity,
    profitEst,
    classification,
  };
}