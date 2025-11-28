/**
 * Fix Wesley Chapel site - reassign keywords using new logic and regenerate all pages
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding sites with pages...');
  
  // First, list all sites with page counts
  const allSites = await prisma.site.findMany({
    include: {
      _count: { select: { pages: true } }
    }
  });
  
  console.log('\nAll sites:');
  allSites.forEach(s => console.log(`  ${s.id.substring(0,8)}... ${s.city}, ${s.state} - ${s._count.pages} pages`));
  
  // Find the site with pages containing Wesley Chapel keywords
  const sites = await prisma.site.findMany({
    where: {
      OR: [
        { city: { contains: 'Wesley', mode: 'insensitive' } },
        { pages: { some: { focusKeyword: { contains: 'Wesley', mode: 'insensitive' } } } }
      ]
    },
    include: {
      batch: {
        include: {
          keywords: {
            where: { isSkipped: false },
            include: {
              metrics: true,
              city: true,
            }
          }
        }
      },
      pages: true,
      niche: true,
    }
  });

  if (sites.length === 0) {
    console.log('❌ No Wesley Chapel site found');
    return;
  }

  // Pick the site with the most pages
  const site = sites.sort((a, b) => b.pages.length - a.pages.length)[0];
  
  if (site.pages.length === 0) {
    console.log('❌ Site has no pages');
    return;
  }
  console.log(`✅ Found site: ${site.siteName} (${site.city}, ${site.state})`);
  console.log(`   Pages: ${site.pages.length}`);
  console.log(`   Batch keywords: ${site.batch?.keywords?.length || 0}`);

  if (!site.batch?.keywords?.length) {
    console.log('❌ No keywords in batch');
    return;
  }

  // Get local keywords for this city (highest volume)
  const localKeywords = site.batch.keywords
    .filter(kw => 
      kw.city?.city?.toLowerCase() === site.city.toLowerCase() &&
      kw.city?.state?.toLowerCase() === site.state.toLowerCase() &&
      kw.metrics?.searchVolume > 0
    )
    .sort((a, b) => (b.metrics?.searchVolume || 0) - (a.metrics?.searchVolume || 0));

  // Get all keywords sorted by volume
  const allKeywords = site.batch.keywords
    .filter(kw => kw.metrics?.searchVolume > 0)
    .sort((a, b) => (b.metrics?.searchVolume || 0) - (a.metrics?.searchVolume || 0));

  console.log('\n📊 Top Local Keywords:');
  localKeywords.slice(0, 10).forEach((kw, i) => {
    console.log(`   ${i + 1}. "${kw.localizedQuery}" - Vol: ${kw.metrics?.searchVolume}`);
  });

  console.log('\n📊 Top All Keywords:');
  allKeywords.slice(0, 10).forEach((kw, i) => {
    console.log(`   ${i + 1}. "${kw.localizedQuery}" - Vol: ${kw.metrics?.searchVolume}`);
  });

  // Track used keywords to avoid duplicates
  const usedKeywords = new Set();
  
  // Assign best keywords to pages
  console.log('\n🔄 Reassigning keywords to pages...');

  // Sort pages so HOME comes first
  const sortedPages = [...site.pages].sort((a, b) => {
    if (a.pageType === 'HOME') return -1;
    if (b.pageType === 'HOME') return 1;
    if (a.pageType === 'CORE_SERVICE' && b.pageType !== 'CORE_SERVICE') return -1;
    if (b.pageType === 'CORE_SERVICE' && a.pageType !== 'CORE_SERVICE') return 1;
    return 0;
  });

  for (const page of sortedPages) {
    let newKeyword = null;
    let newSupportingKeywords = [];

    if (page.pageType === 'HOME') {
      // Homepage: highest volume LOCAL keyword
      newKeyword = localKeywords[0]?.localizedQuery || allKeywords[0]?.localizedQuery;
      newSupportingKeywords = localKeywords.slice(1, 6).map(k => k.localizedQuery);
      if (newKeyword) usedKeywords.add(newKeyword.toLowerCase());
    } else if (page.pageType === 'CORE_SERVICE') {
      // Service pages: find best UNUSED match by slug terms
      const slug = page.slug?.toLowerCase() || '';
      const slugParts = slug.split('-').filter(p => p.length > 2 && !['near', 'me', 'wesley', 'chapel', 'and', 'the', 'in'].includes(p));
      
      // Find keywords that match this service and aren't used yet
      const matchingKeywords = localKeywords.filter(kw => {
        const kwLower = kw.localizedQuery?.toLowerCase() || '';
        if (usedKeywords.has(kwLower)) return false;
        return slugParts.some(part => kwLower.includes(part));
      });
      
      if (matchingKeywords.length > 0) {
        newKeyword = matchingKeywords[0].localizedQuery;
        newSupportingKeywords = matchingKeywords.slice(1, 4).map(k => k.localizedQuery);
        usedKeywords.add(newKeyword.toLowerCase());
      } else {
        // Fallback: find any unused local keyword
        const unusedLocal = localKeywords.find(kw => !usedKeywords.has(kw.localizedQuery?.toLowerCase()));
        if (unusedLocal) {
          newKeyword = unusedLocal.localizedQuery;
          usedKeywords.add(newKeyword.toLowerCase());
        }
      }
    } else if (page.pageType === 'SUPPORT') {
      // Support pages: find matching unused keyword
      const slug = page.slug?.toLowerCase() || '';
      const slugParts = slug.split('-').filter(p => p.length > 3 && !['near', 'wesley', 'chapel', 'and', 'the', 'home'].includes(p));
      
      const matchingKeywords = localKeywords.filter(kw => {
        const kwLower = kw.localizedQuery?.toLowerCase() || '';
        if (usedKeywords.has(kwLower)) return false;
        return slugParts.some(part => kwLower.includes(part));
      });
      
      if (matchingKeywords.length > 0) {
        newKeyword = matchingKeywords[0].localizedQuery;
        usedKeywords.add(newKeyword.toLowerCase());
      }
    }

    if (newKeyword && newKeyword !== page.focusKeyword) {
      console.log(`   ${page.pageType} (${page.slug}): "${page.focusKeyword}" → "${newKeyword}"`);
      
      await prisma.sitePage.update({
        where: { id: page.id },
        data: {
          focusKeyword: newKeyword,
          keyword: newKeyword,
          supportingKeywords: newSupportingKeywords,
          // Reset to draft so it gets regenerated
          status: 'DRAFT',
          contentStatus: 'needs_regeneration',
        }
      });
    } else {
      console.log(`   ${page.pageType} (${page.slug}): keeping "${page.focusKeyword}"`);
    }
  }

  console.log('\n✅ Keywords reassigned!');
  console.log('\n📝 To regenerate all content, click "Regenerate" on each page in the dashboard.');
  console.log('   Or use the bulk regenerate API endpoint.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

