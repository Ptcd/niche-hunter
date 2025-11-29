/**
 * Alt Text Generator
 * 
 * Generates SEO-optimized alt text for images
 */

export interface AltTextOptions {
  focusKeyword: string;
  city: string;
  state: string;
  context?: string; // e.g., "hero image", "service photo", "team photo"
  serviceName?: string; // Extracted service name (e.g., "AC Repair" from "AC repair in Tampa")
}

/**
 * Generate keyword-rich alt text for images
 * 
 * Format: {Service} in {City}, {State} - {Context}
 * Example: AC Repair in Tampa, FL - Professional HVAC technician servicing air conditioner
 */
export function generateAltText(options: AltTextOptions): string {
  const { focusKeyword, city, state, context = 'image', serviceName } = options;

  // Extract service name from focus keyword if not provided
  let service = serviceName;
  if (!service) {
    // Remove location parts from keyword
    service = focusKeyword
      .replace(new RegExp(`\\s+(in|near|for)\\s+${city}`, 'gi'), '')
      .replace(new RegExp(city, 'gi'), '')
      .replace(new RegExp(state, 'gi'), '')
      .trim();
    
    // Capitalize properly
    service = service.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  // Build alt text
  let altText = `${service} in ${city}, ${state}`;

  // Add context if provided
  if (context && context !== 'image') {
    // Capitalize context
    const contextCapitalized = context
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    
    altText += ` - ${contextCapitalized}`;
  }

  // Add descriptive details based on context
  if (context === 'hero image') {
    altText += ` - Professional ${service.toLowerCase()} services`;
  } else if (context === 'service photo') {
    altText += ` - ${service} professional at work`;
  } else if (context === 'team photo') {
    altText += ` - Experienced ${service.toLowerCase()} team`;
  }

  return altText;
}

