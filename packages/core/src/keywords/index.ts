import * as fs from 'fs';
import * as path from 'path';
import { KeywordTaxonomy, IntentWeights } from '../types';

// Resolve keywords directory - works from both root and when bundled
const getKeywordsDir = () => {
  const possiblePaths = [
    path.join(process.cwd(), 'packages', 'core', 'keywords'), // Root when run from CLI
    path.join(process.cwd(), 'packages', 'core', 'src', 'keywords'), // Source location
    path.join(process.cwd(), '..', '..', 'packages', 'core', 'keywords'), // From apps/web
    path.join(process.cwd(), '..', '..', 'packages', 'core', 'src', 'keywords'), // From apps/web (src)
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  // Fallback to root
  return path.join(process.cwd(), 'packages', 'core', 'keywords');
};

const KEYWORDS_DIR = getKeywordsDir();

export async function loadKeywordTaxonomy(
  niche: string
): Promise<KeywordTaxonomy> {
  const jsonPath = path.join(KEYWORDS_DIR, `${niche}.json`);
  const yamlPath = path.join(KEYWORDS_DIR, `${niche}.yaml`);
  const ymlPath = path.join(KEYWORDS_DIR, `${niche}.yml`);

  let content: string;
  let isJson = false;

  if (fs.existsSync(jsonPath)) {
    content = fs.readFileSync(jsonPath, 'utf-8');
    isJson = true;
  } else if (fs.existsSync(yamlPath)) {
    content = fs.readFileSync(yamlPath, 'utf-8');
  } else if (fs.existsSync(ymlPath)) {
    content = fs.readFileSync(ymlPath, 'utf-8');
  } else {
    throw new Error(
      `Keyword taxonomy not found for niche "${niche}". Expected file at ${jsonPath}, ${yamlPath}, or ${ymlPath}`
    );
  }

  if (isJson) {
    return JSON.parse(content) as KeywordTaxonomy;
  } else {
    // Simple YAML parser for basic structure
    return parseYamlKeywords(content);
  }
}

function parseYamlKeywords(content: string): KeywordTaxonomy {
  const taxonomy: KeywordTaxonomy = {
    core: [],
    transactional: [],
    emergency: [],
    adjacency: [],
  };

  const lines = content.split('\n');
  let currentBucket: keyof KeywordTaxonomy | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.endsWith(':')) {
      const bucket = trimmed.slice(0, -1).trim() as keyof KeywordTaxonomy;
      if (bucket in taxonomy) {
        currentBucket = bucket;
      }
      continue;
    }

    if (currentBucket && trimmed.startsWith('-')) {
      const keyword = trimmed.slice(1).trim();
      if (keyword) {
        taxonomy[currentBucket].push(keyword);
      }
    }
  }

  return taxonomy;
}

export function loadIntentWeights(): IntentWeights {
  const weightsPath = path.join(process.cwd(), 'config', 'weights.json');
  if (!fs.existsSync(weightsPath)) {
    // Default weights
    return {
      core: 1.0,
      transactional: 1.1,
      emergency: 0.7,
      adjacency: 0.6,
    };
  }

  const config = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));
  return config.intentWeights as IntentWeights;
}

export function getAllKeywords(taxonomy: KeywordTaxonomy): string[] {
  return [
    ...taxonomy.core,
    ...taxonomy.transactional,
    ...taxonomy.emergency,
    ...taxonomy.adjacency,
  ];
}

