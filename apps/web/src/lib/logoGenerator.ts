/**
 * Logo Generator
 * 
 * Generates logos using OpenAI DALL-E API
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface LogoRules {
  noText?: boolean; // Default: true
  whiteBackground?: boolean; // Default: true
  iconOnly?: boolean; // Default: true
}

export interface LogoGenerationOptions {
  brandName: string;
  niche: string;
  city?: string;
  state?: string;
  promptHint?: string; // Optional user hint like "modern, blue, minimalist"
  rules?: LogoRules; // Optional rules configuration
  customPrompt?: string; // Optional: if provided, use this prompt directly
}

/**
 * Generate a default logo prompt template
 * 
 * @param niche - Business niche
 * @param city - City name (optional)
 * @param state - State name (optional)
 * @returns Default prompt template
 */
export function generateDefaultLogoPrompt(niche: string, city?: string, state?: string): string {
  let prompt = `Create a simple pictorial mark (icon only, absolutely no text or letters) for a ${niche} business`;
  
  if (city && state) {
    prompt += ` in ${city}, ${state}`;
  }
  
  prompt += `.\n\nStyle:\n- Pure visual symbol, no words or characters\n- Simple geometric or abstract design\n- Clean, minimal, professional\n- Works well at small sizes\n- White background\n\nCreate only the icon/symbol - no text, no brand name, no letters.`;
  
  return prompt;
}

/**
 * Generate a logo using DALL-E
 * 
 * @param options - Logo generation options
 * @returns URL to the generated logo image
 */
export async function generateLogo(options: LogoGenerationOptions): Promise<string> {
  const { customPrompt } = options;

  // If custom prompt provided, use it directly
  let prompt: string;
  if (customPrompt) {
    prompt = customPrompt;
  } else {
    // Fallback to old logic for backwards compatibility
    const { brandName, niche, city, state, promptHint, rules } = options;

    // Default rules (all enabled by default)
    const noText = rules?.noText !== false; // Default: true
    const whiteBackground = rules?.whiteBackground !== false; // Default: true
    const iconOnly = rules?.iconOnly !== false; // Default: true

    // Build the prompt
    prompt = `Create a professional logo for "${brandName}", a ${niche} business`;
    
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
    
    // Apply rules conditionally
    const rulesList: string[] = [];
    
    if (noText) {
      rulesList.push(`NO TEXT: Do not include any letters, words, numbers, or text of any kind`);
      rulesList.push(`NO BRAND NAME: Do not spell out "${brandName}" or any words`);
      rulesList.push(`NO TYPOGRAPHY: Absolutely no letters, characters, or written text`);
    }
    
    if (iconOnly) {
      rulesList.push(`ICON/SYMBOL ONLY: Create only a visual icon, symbol, or graphic element`);
    }
    
    if (rulesList.length > 0) {
      prompt += `\n\nCRITICAL RULES (MUST FOLLOW):`;
      rulesList.forEach(rule => {
        prompt += `\n- ${rule}`;
      });
    }
    
    // Background specification
    let styleDescription = `Minimalist logo design`;
    if (iconOnly) {
      styleDescription += `, icon/symbol only`;
    }
    if (whiteBackground) {
      styleDescription += `, white background`;
    } else {
      styleDescription += `, transparent background`;
    }
    
    prompt += `\n\nStyle: ${styleDescription}.`;
  }

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

