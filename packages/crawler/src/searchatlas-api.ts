/**
 * SearchAtlas API integration (stub)
 * These functions are referenced but not yet implemented
 */

export async function shouldUseSearchAtlasAPI(): Promise<boolean> {
  return false;
}

export async function getSearchAtlasAPIKey(): Promise<string | null> {
  return null;
}

export async function getVolumeFromSearchAtlasAPI(
  keyword: string,
  city: string,
  state: string,
  apiKey: string
): Promise<{ volume: number; cpc?: number; similarKeywords: string[] }> {
  return { volume: 0, similarKeywords: [] };
}
