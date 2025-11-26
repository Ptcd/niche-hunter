import { NextApiRequest, NextApiResponse } from 'next';
import { getKeywordSuggestions } from '@niche-hunter/crawler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { seed } = req.body;

    if (!seed) {
      return res.status(400).json({ error: 'Seed keyword is required' });
    }

    const suggestions = await getKeywordSuggestions(seed);

    return res.status(200).json(suggestions);
  } catch (error: any) {
    console.error('Error fetching keyword suggestions:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: error.message || 'Failed to fetch keyword suggestions',
      details: error.toString(),
    });
  }
}




