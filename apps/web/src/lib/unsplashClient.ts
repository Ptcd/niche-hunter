/**
 * Unsplash API Client
 * 
 * Fetches stock photos from Unsplash API
 */

export interface UnsplashPhoto {
  id: string;
  urls: {
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string | null;
  description: string | null;
  user: {
    name: string;
    username: string;
  };
}

export interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
  total: number;
  total_pages: number;
}

/**
 * Search Unsplash for photos
 * 
 * @param query - Search query (e.g., "HVAC technician", "plumber working")
 * @param perPage - Number of results per page (default: 8)
 * @returns Array of photo results
 */
export async function searchUnsplashPhotos(
  query: string,
  perPage: number = 8
): Promise<UnsplashPhoto[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  
  if (!accessKey) {
    throw new Error('UNSPLASH_ACCESS_KEY environment variable is not set');
  }

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
      {
        headers: {
          'Authorization': `Client-ID ${accessKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0] || `Unsplash API error: ${response.statusText}`);
    }

    const data: UnsplashSearchResponse = await response.json();
    return data.results || [];
  } catch (error: any) {
    console.error('[unsplashClient] Error:', error);
    throw new Error(`Failed to search Unsplash: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get a single photo by ID
 */
export async function getUnsplashPhoto(photoId: string): Promise<UnsplashPhoto> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  
  if (!accessKey) {
    throw new Error('UNSPLASH_ACCESS_KEY environment variable is not set');
  }

  try {
    const response = await fetch(
      `https://api.unsplash.com/photos/${photoId}`,
      {
        headers: {
          'Authorization': `Client-ID ${accessKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[unsplashClient] Error:', error);
    throw new Error(`Failed to get Unsplash photo: ${error.message || 'Unknown error'}`);
  }
}

