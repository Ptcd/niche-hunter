/**
 * POST /api/v5000/sites/[siteId]/generate-logo-concepts
 * 
 * Generate 3-5 logo concept prompts using GPT
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../../lib/auth/withAuth';
import { prisma } from '@niche-hunter/db';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface LogoConcept {
  name: string;
  description: string;
  prompt: string;
}

async function handler(req: NextApiRequest & { auth: any }, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { siteId } = req.query;

  if (!siteId || typeof siteId !== 'string') {
    return res.status(400).json({ error: 'Invalid siteId' });
  }

  // Validate auth context
  if (!req.auth || !req.auth.currentAccountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get site
  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      accountId: req.auth.currentAccountId,
    },
    include: {
      niche: true,
    },
  });

  if (!site) {
    return res.status(404).json({ error: 'Site not found' });
  }

  try {
    // Generate logo concepts using GPT-4o-mini
    const systemPrompt = `You are a professional logo designer. Generate 3-5 different logo concept ideas for a ${site.niche.name} business in ${site.city}, ${site.state}.

For each concept, provide:
1. A short name (2-3 words) - e.g., "Modern Geometric", "Classic Emblem", "Abstract Symbol"
2. A brief description (1-2 sentences explaining the concept and why it fits this business)
3. A detailed DALL-E prompt optimized for clean, flat vector logos

CRITICAL RULES for all prompts:
- NO TEXT, letters, words, or numbers in the logo
- Icon/symbol only - no wordmarks
- Clean, flat, vector-style design
- White or transparent background
- Professional and modern
- Works well at small sizes
- Tailored to ${site.niche.name} industry

Return ONLY a valid JSON object with this exact structure:
{
  "concepts": [
    {
      "name": "Concept Name",
      "description": "Brief description",
      "prompt": "Full DALL-E prompt here"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate logo concepts for ${site.niche.name} in ${site.city}, ${site.state}` },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from GPT');
    }

    // Parse JSON response
    const parsed = JSON.parse(responseContent);
    
    // Handle both { concepts: [...] } and direct array formats
    const concepts: LogoConcept[] = Array.isArray(parsed) 
      ? parsed 
      : parsed.concepts || parsed.concept || [];

    if (!Array.isArray(concepts) || concepts.length === 0) {
      throw new Error('Invalid response format from GPT');
    }

    // Validate each concept has required fields
    const validConcepts = concepts.filter(
      (c) => c.name && c.description && c.prompt
    );

    if (validConcepts.length === 0) {
      throw new Error('No valid concepts generated');
    }

    // Log cost (GPT-4o-mini ~$0.001 per call)
    await prisma.siteCostLog.create({
      data: {
        siteId,
        type: 'ai_generation',
        amountCents: 1, // ~$0.001, rounded up
        provider: 'openai',
        description: 'Logo concept generation (GPT-4o-mini)',
      },
    });

    return res.status(200).json({ concepts: validConcepts });
  } catch (error: any) {
    console.error('[generate-logo-concepts] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate logo concepts' });
  }
}

export default withAuth(handler);

