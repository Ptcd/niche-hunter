/**
 * Regenerate all pages for the Wesley Chapel site
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding Wesley Chapel site with pages...');
  
  const sites = await prisma.site.findMany({
    where: {
      city: { contains: 'Wesley', mode: 'insensitive' }
    },
    include: {
      pages: true,
    }
  });

  // Pick the site with pages
  const site = sites.sort((a, b) => b.pages.length - a.pages.length)[0];
  
  if (!site || site.pages.length === 0) {
    console.log('❌ No site with pages found');
    return;
  }

  console.log(`✅ Found site: ${site.city}, ${site.state} with ${site.pages.length} pages`);
  console.log(`\n🔄 Regenerating all pages...`);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  for (const page of site.pages) {
    console.log(`\n   Regenerating: ${page.pageType} - ${page.slug || 'home'}`);
    console.log(`   Focus keyword: ${page.focusKeyword}`);
    
    try {
      const response = await fetch(`${baseUrl}/api/v5000/sites/${site.id}/pages/${page.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o' })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Generated ${data.wordCount} words`);
      } else {
        const error = await response.text();
        console.log(`   ❌ Error: ${error}`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n✅ All pages regenerated!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

