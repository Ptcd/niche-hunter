/**
 * Logo Generator
 * 
 * Generates logos using OpenAI DALL-E API
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface LogoGenerationOptions {
  brandName: string;
  niche: string;
  city?: string;
  state?: string;
  promptHint?: string; // Optional user hint like "modern, blue, minimalist"
}

/**
 * Generate a logo using DALL-E
 * 
 * @param options - Logo generation options
 * @returns URL to the generated logo image
 */
export async function generateLogo(options: LogoGenerationOptions): Promise<string> {
  const { brandName, niche, city, state, promptHint } = options;

  // Build the prompt
  let prompt = `Create a professional logo for "${brandName}", a ${niche} business`;
  
  if (city && state) {
    prompt += ` in ${city}, ${state}`;
  }
  
  prompt += `. The logo should be:`;
  prompt += `\n- Simple and clean, suitable for a local service business`;
  prompt += `\n- Professional and trustworthy`;
  prompt += `\n- Works well at small sizes (for website headers)`;
  prompt += `\n- Modern design style`;
  
  if (promptHint) {
    prompt += `\n- ${promptHint}`;
  }
  
  prompt += `\n\nCRITICAL RULES (MUST FOLLOW):`;
  prompt += `\n- NO TEXT: Do not include any letters, words, numbers, or text of any kind`;
  prompt += `\n- NO BRAND NAME: Do not spell out "${brandName}" or any words`;
  prompt += `\n- ICON/SYMBOL ONLY: Create only a visual icon, symbol, or graphic element`;
  prompt += `\n- NO TYPOGRAPHY: Absolutely no letters, characters, or written text`;
  prompt += `\n\nStyle: Minimalist logo design, icon/symbol only, white background.`;

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt.trim(),
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from DALL-E');
    }

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E');
    }

    return imageUrl;
  } catch (error: any) {
    console.error('[logoGenerator] Error:', error);
    throw new Error(`Failed to generate logo: ${error.message || 'Unknown error'}`);
  }
}

