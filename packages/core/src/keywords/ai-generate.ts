import * as fs from 'fs';
import * as path from 'path';
import { callAI, getAIConfig } from '@niche-hunter/ai';
import { generateKeywordTaxonomyPrompt } from '@niche-hunter/ai/src/prompts';
import { KeywordTaxonomy } from '../types';

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

export async function generateKeywordTaxonomy(
  niche: string,
  saveToFile: boolean = true
): Promise<KeywordTaxonomy> {
  const config = getAIConfig();
  const messages = generateKeywordTaxonomyPrompt(niche);

  console.log(`Generating keyword taxonomy for "${niche}" using ${config.provider}/${config.model}...`);

  const response = await callAI(messages, config);

  // Parse JSON from response
  let taxonomy: KeywordTaxonomy;
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = response.content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response.content.trim();

    taxonomy = JSON.parse(jsonStr) as KeywordTaxonomy;

    // Validate structure
    if (!taxonomy.core || !taxonomy.transactional || !taxonomy.emergency || !taxonomy.adjacency) {
      throw new Error('Invalid taxonomy structure');
    }
  } catch (error) {
    console.error('Failed to parse AI response as JSON:', response.content);
    throw new Error(`Failed to generate keyword taxonomy: ${error}`);
  }

  // Save to file if requested
  if (saveToFile) {
    const outputPath = path.join(KEYWORDS_DIR, `${niche}.json`);
    if (!fs.existsSync(KEYWORDS_DIR)) {
      fs.mkdirSync(KEYWORDS_DIR, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(taxonomy, null, 2));
    console.log(`Saved keyword taxonomy to ${outputPath}`);
  }

  return taxonomy;
}

