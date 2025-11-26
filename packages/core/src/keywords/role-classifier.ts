/**
 * Keyword Role Classifier
 * 
 * Classifies keywords into semantic roles for blueprint-driven content generation.
 * Uses GPT to classify keywords into roles like primary_service_city, problem_symptom, etc.
 */

import { KeywordRole } from '../blueprints/types';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface KeywordForClassification {
  id: string;
  keyword: string;
  localizedQuery: string;
  keywordType: string | null; // money, supporting, informational, etc.
  city?: string;
  state?: string;
}

export interface ClassifiedKeyword {
  id: string;
  keyword: string;
  role: KeywordRole | null;
  confidence: number;
}

/**
 * Classify a batch of keywords into roles using GPT
 */
export async function classifyKeywords(
  keywords: KeywordForClassification[],
  niche: string,
  city?: string,
  state?: string
): Promise<ClassifiedKeyword[]> {
  if (keywords.length === 0) {
    return [];
  }
  
  // Build prompt
  const locationContext = city && state ? ` in ${city}, ${state}` : '';
  const prompt = `You are a keyword classifier for local SEO content generation.

Niche: ${niche}${locationContext}

Classify each keyword into ONE of these roles:
- primary_service_city: Exact money phrase with location (e.g., "hvac repair wesley chapel fl")
- primary_service: Core service phrase without location (e.g., "hvac repair", "cash for junk cars")
- service_category: Broader category (e.g., "hvac services", "junk car buyers")
- problem_symptom: Common problems/symptoms (e.g., "ac not blowing cold air", "car won't start")
- benefit_outcome: Outcomes people want (e.g., "lower energy bills", "same-day cash")
- modifier_urgency: Urgency/time modifiers (e.g., "24/7", "same-day", "emergency")
- neighborhood: Named areas/suburbs/zip clusters
- supporting_longtail: Extra long-tail keywords
- topical_entity: Gear/materials/vehicle types
- brand_name: Brand or company name (rare, usually skip)

Keywords to classify:
${keywords.map((kw, idx) => `${idx + 1}. "${kw.keyword}" (type: ${kw.keywordType || 'unknown'}, query: "${kw.localizedQuery}")`).join('\n')}

Respond with JSON array:
[
  {"index": 1, "role": "primary_service_city", "confidence": 0.9},
  {"index": 2, "role": "problem_symptom", "confidence": 0.85},
  ...
]

Only assign roles that clearly match. If uncertain, use null.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a precise keyword classifier. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }
    
    // Parse response
    const parsed = JSON.parse(content);
    const classifications = Array.isArray(parsed) ? parsed : parsed.classifications || [];
    
    // Map back to keywords
    const results: ClassifiedKeyword[] = keywords.map((kw, idx) => {
      const classification = classifications.find((c: any) => c.index === idx + 1);
      return {
        id: kw.id,
        keyword: kw.keyword,
        role: classification?.role || null,
        confidence: classification?.confidence || 0,
      };
    });
    
    return results;
  } catch (error) {
    console.error('Error classifying keywords:', error);
    // Fallback: return null roles
    return keywords.map(kw => ({
      id: kw.id,
      keyword: kw.keyword,
      role: null,
      confidence: 0,
    }));
  }
}

/**
 * Extract keyword roles from a batch of keywords
 * Groups keywords by role for easy lookup
 */
export function extractKeywordRoles(
  classified: ClassifiedKeyword[]
): Map<KeywordRole, string[]> {
  const roles = new Map<KeywordRole, string[]>();
  
  for (const kw of classified) {
    if (kw.role) {
      if (!roles.has(kw.role)) {
        roles.set(kw.role, []);
      }
      roles.get(kw.role)!.push(kw.keyword);
    }
  }
  
  return roles;
}


