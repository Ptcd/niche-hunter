/**
 * ZIP to Area Code Lookup
 * 
 * Maps US ZIP codes to their primary area codes for local phone number searches.
 * Uses a free API to get location data, then maps to area codes.
 */

/**
 * Lookup area codes for a given ZIP code
 * Returns an array of area codes (e.g., ["813", "727"] for Wesley Chapel, FL)
 */
export async function getAreaCodesForZip(zip: string): Promise<string[]> {
  if (!zip || zip.length < 5) {
    return [];
  }

  // Normalize ZIP (take first 5 digits)
  const normalizedZip = zip.substring(0, 5);

  try {
    // Use zippopotam.us API to get location data
    const response = await fetch(`https://api.zippopotam.us/us/${normalizedZip}`);
    
    if (!response.ok) {
      console.warn(`[zipToAreaCode] ZIP lookup failed for ${normalizedZip}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data || !data.places || data.places.length === 0) {
      return [];
    }

    // Get state and city from the response
    const state = data.state;
    const city = data.places[0]?.['place name'] || data.places[0]?.city || '';

    // Map state/city to area codes using our lookup
    return getAreaCodesForLocation(city, state);
  } catch (err: any) {
    console.error(`[zipToAreaCode] Error looking up ZIP ${normalizedZip}:`, err);
    return [];
  }
}

/**
 * Map city/state to area codes
 * This is a curated mapping of major metros and their area codes.
 * For smaller cities, falls back to state-level common area codes.
 */
function getAreaCodesForLocation(city: string, state: string): string[] {
  const cityLower = city.toLowerCase().trim();
  const stateUpper = state.toUpperCase().trim();

  // Major metro area mappings (prioritized for rank-and-rent markets)
  const metroMap: Record<string, string[]> = {
    // Florida - Tampa Bay Area
    'tampa': ['813', '727'],
    'wesley chapel': ['813', '727'],
    'st. petersburg': ['727', '813'],
    'clearwater': ['727'],
    'largo': ['727'],
    'pinellas park': ['727'],
    'brandon': ['813'],
    'riverview': ['813'],
    'plant city': ['813'],
    
    // Florida - Other major metros
    'orlando': ['407', '321'],
    'miami': ['305', '786'],
    'fort lauderdale': ['954', '754'],
    'west palm beach': ['561'],
    'jacksonville': ['904'],
    'tallahassee': ['850'],
    'gainesville': ['352'],
    'sarasota': ['941'],
    'naples': ['239'],
    'pensacola': ['850'],
    'lakeland': ['863'],
    'port st. lucie': ['772'],
    'daytona beach': ['386'],
    
    // California - Major metros
    'los angeles': ['213', '310', '323', '424', '661', '818'],
    'san francisco': ['415', '628'],
    'san diego': ['619', '858'],
    'san jose': ['408', '669'],
    'sacramento': ['916'],
    'oakland': ['510'],
    'fresno': ['559'],
    'long beach': ['562'],
    'anaheim': ['714'],
    'santa ana': ['714'],
    'riverside': ['951'],
    'stockton': ['209'],
    'irvine': ['949'],
    
    // Texas - Major metros
    'houston': ['281', '346', '713', '832'],
    'dallas': ['214', '469', '972'],
    'austin': ['512', '737'],
    'san antonio': ['210', '726'],
    'fort worth': ['817'],
    'el paso': ['915'],
    
    // New York
    'new york': ['212', '347', '646', '718', '917', '929'],
    'buffalo': ['716'],
    'rochester': ['585'],
    
    // Illinois
    'chicago': ['312', '773', '872'],
    'aurora': ['630'],
    
    // Pennsylvania
    'philadelphia': ['215', '267'],
    'pittsburgh': ['412'],
    
    // Ohio
    'columbus': ['614'],
    'cleveland': ['216'],
    'cincinnati': ['513'],
    
    // Georgia
    'atlanta': ['404', '470', '678', '770'],
    
    // North Carolina
    'charlotte': ['704', '980'],
    'raleigh': ['919', '984'],
    
    // Michigan
    'detroit': ['313'],
    'grand rapids': ['616'],
    
    // Other major metros
    'phoenix': ['480', '602', '623'],
    'seattle': ['206', '253'],
    'denver': ['303', '720'],
    'boston': ['339', '617', '781', '857'],
    'nashville': ['615', '629'],
    'indianapolis': ['317'],
    'kansas city': ['816'],
    'baltimore': ['240', '410', '443'],
    'milwaukee': ['262', '414'],
    'portland': ['503', '971'],
  };

  // Check exact city match first
  if (metroMap[cityLower]) {
    return metroMap[cityLower];
  }

  // Check state-level fallbacks for common area codes (return top 2-3)
  const stateAreaCodes: Record<string, string[]> = {
    'FL': ['305', '321', '352', '386', '407', '561', '727', '754', '772', '786', '813', '850', '863', '904', '941', '954'],
    'CA': ['209', '213', '310', '323', '408', '415', '424', '510', '530', '559', '562', '619', '626', '628', '650', '661', '669', '707', '714', '747', '760', '805', '818', '831', '858', '909', '916', '925', '949', '951'],
    'TX': ['210', '214', '254', '281', '325', '346', '361', '409', '430', '432', '469', '512', '682', '713', '726', '737', '806', '817', '830', '832', '903', '915', '936', '940', '956', '972', '979'],
    'NY': ['212', '315', '347', '516', '518', '585', '607', '631', '646', '716', '718', '845', '914', '917', '929'],
    'IL': ['217', '224', '309', '312', '331', '618', '630', '708', '773', '779', '815', '847', '872'],
    'PA': ['215', '267', '272', '412', '484', '570', '610', '717', '724', '814', '878'],
    'OH': ['216', '220', '234', '330', '380', '419', '440', '513', '567', '614', '740', '937'],
    'GA': ['229', '404', '470', '478', '678', '706', '762', '770', '912'],
    'NC': ['252', '336', '704', '743', '828', '910', '919', '980', '984'],
    'MI': ['231', '248', '269', '313', '517', '586', '616', '734', '810', '906', '947', '989'],
    'NJ': ['201', '551', '609', '732', '848', '856', '862', '908', '973'],
    'VA': ['276', '434', '540', '571', '703', '757', '804'],
    'WA': ['206', '253', '360', '425', '509', '564'],
    'AZ': ['480', '520', '602', '623', '928'],
    'MA': ['339', '351', '413', '508', '617', '774', '781', '857', '978'],
    'TN': ['423', '615', '629', '731', '865', '901', '931'],
    'IN': ['219', '260', '317', '463', '574', '765', '812'],
    'MO': ['314', '417', '573', '636', '660', '816'],
    'MD': ['240', '301', '410', '443', '667'],
    'WI': ['262', '414', '534', '608', '715', '920'],
    'CO': ['303', '719', '720', '970'],
    'MN': ['218', '320', '507', '612', '651', '763', '952'],
    'SC': ['803', '843', '854', '864'],
    'AL': ['205', '251', '256', '334', '938'],
    'LA': ['225', '318', '337', '504', '985'],
    'KY': ['270', '364', '502', '606', '859'],
    'OR': ['458', '503', '541', '971'],
    'OK': ['405', '539', '580', '918'],
    'CT': ['203', '475', '860', '959'],
    'IA': ['319', '515', '563', '641', '712'],
    'UT': ['385', '435', '801'],
    'AR': ['479', '501', '870'],
    'NV': ['702', '725', '775'],
    'MS': ['228', '601', '662', '769'],
    'KS': ['316', '620', '785', '913'],
    'NM': ['505', '575'],
    'NE': ['308', '402', '531'],
    'WV': ['304', '681'],
    'ID': ['208', '986'],
    'HI': ['808'],
    'NH': ['603'],
    'ME': ['207'],
    'RI': ['401'],
    'MT': ['406'],
    'DE': ['302'],
    'SD': ['605'],
    'ND': ['701'],
    'AK': ['907'],
    'DC': ['202'],
    'VT': ['802'],
    'WY': ['307'],
  };

  // If we have state-level area codes, return a subset (first 2-3 most common)
  if (stateAreaCodes[stateUpper]) {
    return stateAreaCodes[stateUpper].slice(0, 3);
  }

  // Last resort: return empty array
  return [];
}
