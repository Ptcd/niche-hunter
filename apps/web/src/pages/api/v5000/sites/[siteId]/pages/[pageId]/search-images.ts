/**
 * GET /api/v5000/sites/[siteId]/pages/[pageId]/search-images
 * 
 * Search Unsplash for images based on page keywords
 * Also returns suggested visual keywords for the niche
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../../../../lib/auth/withAuth';
import { prisma } from '@niche-hunter/db';
import { searchUnsplashPhotos } from '../../../../../../../lib/unsplashClient';

// Visual keywords by niche - simple terms that return good stock photos
const VISUAL_KEYWORDS_BY_NICHE: Record<string, string[]> = {
  // HVAC
  'hvac': ['HVAC technician', 'air conditioner unit', 'home cooling', 'thermostat', 'AC repair', 'heating system'],
  'air conditioning': ['air conditioner', 'AC unit', 'HVAC technician', 'home cooling', 'thermostat'],
  'heating': ['heating system', 'furnace', 'home heating', 'thermostat', 'HVAC service'],
  
  // Plumbing
  'plumbing': ['plumber working', 'pipe repair', 'bathroom faucet', 'water heater', 'sink repair', 'plumbing tools'],
  'plumber': ['plumber working', 'pipe wrench', 'bathroom plumbing', 'kitchen sink', 'water leak repair'],
  
  // Roofing
  'roofing': ['roof repair', 'roofing contractor', 'shingles', 'house roof', 'roofer working', 'roof inspection'],
  'roof': ['roof shingles', 'roofing work', 'house roof', 'roof repair', 'contractor on roof'],
  
  // Electrical
  'electrical': ['electrician working', 'electrical panel', 'wiring', 'light installation', 'electrical repair'],
  'electrician': ['electrician tools', 'electrical work', 'wiring installation', 'circuit breaker', 'home electrical'],
  
  // Junk Removal
  'junk removal': ['junk removal truck', 'hauling debris', 'cleanup crew', 'dumpster', 'debris removal', 'clean out'],
  'junk car': ['junk car', 'auto salvage', 'car towing', 'old car', 'scrap car', 'tow truck'],
  'towing': ['tow truck', 'car towing', 'roadside assistance', 'vehicle recovery', 'auto transport'],
  
  // Landscaping
  'landscaping': ['landscaper working', 'lawn care', 'garden design', 'lawn mower', 'yard work', 'beautiful garden'],
  'lawn care': ['lawn mowing', 'green lawn', 'grass cutting', 'yard maintenance', 'lawn service'],
  
  // Pest Control
  'pest control': ['pest control technician', 'exterminator', 'bug spray', 'home inspection', 'pest treatment'],
  
  // Cleaning
  'cleaning': ['cleaning service', 'house cleaning', 'professional cleaner', 'mop and bucket', 'clean home'],
  'carpet cleaning': ['carpet cleaner', 'steam cleaning', 'carpet care', 'floor cleaning', 'professional cleaning'],
  
  // Moving
  'moving': ['moving truck', 'movers carrying boxes', 'packing boxes', 'moving day', 'furniture moving'],
  
  // General/Default
  'default': ['professional service', 'home repair', 'contractor working', 'handyman', 'home improvement', 'customer service'],
};

function getVisualKeywords(nicheName: string): string[] {
  const nicheKey = nicheName.toLowerCase();
  
  // Try exact match
  if (VISUAL_KEYWORDS_BY_NICHE[nicheKey]) {
    return VISUAL_KEYWORDS_BY_NICHE[nicheKey];
  }
  
  // Try partial match
  for (const [key, keywords] of Object.entries(VISUAL_KEYWORDS_BY_NICHE)) {
    if (nicheKey.includes(key) || key.includes(nicheKey)) {
      return keywords;
    }
  }
  
  // Return default
  return VISUAL_KEYWORDS_BY_NICHE['default'];
}

async function handler(req: NextApiRequest & { auth: any }, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { siteId, pageId } = req.query;
  const { query, perPage, suggestionsOnly } = req.query;

  if (!siteId || typeof siteId !== 'string' || !pageId || typeof pageId !== 'string') {
    return res.status(400).json({ error: 'Invalid siteId or pageId' });
  }

  // Validate auth context
  if (!req.auth || !req.auth.currentAccountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify site belongs to account
  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      accountId: req.auth.currentAccountId,
    },
    include: {
      niche: true,
      pages: {
        where: { id: pageId },
      },
    },
  });

  if (!site || site.pages.length === 0) {
    return res.status(404).json({ error: 'Site or page not found' });
  }

  // Get visual keywords for this niche
  const suggestedKeywords = getVisualKeywords(site.niche.name);

  // If only requesting suggestions, return them
  if (suggestionsOnly === 'true') {
    return res.status(200).json({ suggestedKeywords, photos: [] });
  }

  // Use provided query or first suggested keyword
  const searchQuery = (query as string) || suggestedKeywords[0] || 'professional service';

  try {
    const photos = await searchUnsplashPhotos(
      searchQuery,
      perPage ? parseInt(perPage as string) : 12
    );

    return res.status(200).json({ photos, suggestedKeywords });
  } catch (error: any) {
    console.error('[search-images] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to search images' });
  }
}

export default withAuth(handler);

