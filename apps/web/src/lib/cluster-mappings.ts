/**
 * Cluster Mappings
 * 
 * Defines keyword clusters for internal linking and content organization.
 * Each cluster groups related service keywords together.
 */

export interface Cluster {
  key: string;
  tokens: string[];
  priority: number; // Lower number = higher priority (checked first)
}

export const HVAC_CLUSTERS: Cluster[] = [
  { key: 'ac', tokens: ['ac', 'air conditioner', 'air conditioning', 'a/c', 'cooling'], priority: 1 },
  { key: 'furnace', tokens: ['furnace', 'heater', 'heating'], priority: 1 },
  { key: 'heat-pump', tokens: ['heat pump', 'heatpump'], priority: 2 },
  { key: 'hvac', tokens: ['hvac', 'heating and cooling'], priority: 1 },
  { key: 'duct', tokens: ['duct', 'ductwork', 'duct cleaning'], priority: 3 },
  { key: 'thermostat', tokens: ['thermostat', 'smart thermostat'], priority: 3 },
  { key: 'maintenance', tokens: ['maintenance', 'tune up', 'tune-up', 'service', 'inspection'], priority: 2 },
  { key: 'installation', tokens: ['installation', 'install', 'replacement', 'replace'], priority: 2 },
  { key: 'repair', tokens: ['repair', 'fix', 'broken'], priority: 1 },
  { key: 'emergency', tokens: ['emergency', '24 hour', '24/7', 'urgent'], priority: 2 },
];

/**
 * Derive cluster key from focus keyword and page type
 * 
 * @param focusKeyword - The primary keyword for the page
 * @param pageType - Type of page (Home, Service, City, Blog, etc.)
 * @returns Cluster key string
 */
export function deriveClusterKey(focusKeyword: string, pageType: string): string {
  // Special cases
  if (pageType === 'City') return 'city';
  if (pageType === 'Home') return 'home';
  if (pageType === 'About' || pageType === 'Contact') return 'general';

  const lower = focusKeyword.toLowerCase();

  // Check clusters in priority order (lower priority number = checked first)
  const sorted = [...HVAC_CLUSTERS].sort((a, b) => a.priority - b.priority);

  for (const cluster of sorted) {
    if (cluster.tokens.some((token) => lower.includes(token))) {
      return cluster.key;
    }
  }

  return 'general';
}


