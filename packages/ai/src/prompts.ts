import { ChatMessage } from './types';

export function generateKeywordTaxonomyPrompt(niche: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are an SEO expert specializing in local lead generation. Generate a comprehensive keyword taxonomy for a given niche, organizing keywords into intent buckets: core, transactional, emergency, and adjacency.`,
    },
    {
      role: 'user',
      content: `Generate a keyword taxonomy for the niche: "${niche}"

Organize keywords into these buckets:
- core: General service keywords (e.g., "roofing company", "roofing contractor")
- transactional: Action-oriented keywords (e.g., "roof repair", "roof replacement")
- emergency: Urgent/time-sensitive keywords (e.g., "emergency roof repair")
- adjacency: Related services or problems (e.g., "hail roof damage", "roof inspection")

Return ONLY a JSON object with this structure:
{
  "core": ["keyword1", "keyword2", ...],
  "transactional": ["keyword1", "keyword2", ...],
  "emergency": ["keyword1", "keyword2", ...],
  "adjacency": ["keyword1", "keyword2", ...]
}

Include 4-8 keywords per bucket. Focus on local search intent.`,
    },
  ];
}

export function analyzeOpportunityPrompt(
  city: string,
  state: string,
  niche: string,
  scores: {
    demand: number;
    difficulty: number;
    opportunity: number;
    profitEst?: number;
  },
  serpSummary?: string
): ChatMessage[] {
  const serpContext = serpSummary
    ? `\n\nSERP Analysis:\n${serpSummary}`
    : '';

  return [
    {
      role: 'system',
      content: `You are an expert local SEO strategist. Analyze opportunity data and provide actionable insights for local lead generation.`,
    },
    {
      role: 'user',
      content: `Analyze this opportunity:

Location: ${city}, ${state}
Niche: ${niche}
- Demand Score: ${scores.demand.toFixed(3)} (0-1, higher = more demand)
- Difficulty Score: ${scores.difficulty.toFixed(3)} (0-1, higher = harder to rank)
- Opportunity Score: ${scores.opportunity.toFixed(3)} (0-1, composite score)
${scores.profitEst ? `- Estimated Monthly Profit: $${scores.profitEst.toFixed(2)}` : ''}${serpContext}

Provide:
1. A brief assessment (2-3 sentences)
2. Top 3 actionable recommendations
3. Potential risks or challenges

Keep it concise and practical.`,
    },
  ];
}

export function generateInsightsPrompt(runSummary: {
  niche: string;
  totalLocations: number;
  topOpportunities: Array<{
    city: string;
    state: string;
    opportunity: number;
    profitEst?: number;
  }>;
}): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a data analyst specializing in local lead generation opportunities. Summarize analysis results and provide strategic insights.`,
    },
    {
      role: 'user',
      content: `Generate insights for this analysis run:

Niche: ${runSummary.niche}
Total Locations Analyzed: ${runSummary.totalLocations}
Top 3 Opportunities:
${runSummary.topOpportunities
  .map(
    (o, i) =>
      `${i + 1}. ${o.city}, ${o.state} - Opportunity: ${o.opportunity.toFixed(3)}${o.profitEst ? ` - Profit: $${o.profitEst.toFixed(2)}/mo` : ''}`
  )
  .join('\n')}

Provide:
1. Overall market assessment (2-3 sentences)
2. Key patterns or trends observed
3. Strategic recommendations for prioritizing markets

Keep it concise and actionable.`,
    },
  ];
}

