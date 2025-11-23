require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runBatch(batchId) {
  console.log(`\n🔍 Looking up batch: ${batchId}\n`);

  try {
    // Find the batch
    const batch = await prisma.scanBatch.findUnique({
      where: { id: batchId },
      include: { 
        niche: true,
        keywords: {
          take: 10,
          include: {
            city: true,
            nicheKeyword: true
          }
        }
      }
    });

    if (!batch) {
      console.log('❌ Batch not found with ID:', batchId);
      console.log('\nLet me check if this is a Run ID instead...\n');
      
      const run = await prisma.run.findUnique({
        where: { id: batchId },
        include: { scans: true }
      });

      if (run) {
        console.log('✅ Found as a Run!');
        console.log('  Niche:', run.niche);
        console.log('  Status:', run.status);
        console.log('  Created:', run.createdAt);
        console.log('  Scans:', run.scans.length);
        console.log('\n📊 This run is already completed!');
        
        if (run.scans.length > 0) {
          console.log('\nTop 3 results:');
          const top3 = run.scans
            .sort((a, b) => b.opportunity - a.opportunity)
            .slice(0, 3);
          
          top3.forEach((scan, i) => {
            console.log(`\n${i + 1}. ${scan.city}, ${scan.state}`);
            console.log(`   Opportunity: ${scan.opportunity.toFixed(3)}`);
            console.log(`   Profit: $${scan.profitEst?.toFixed(2) || 'N/A'}/month`);
          });
        }
      } else {
        console.log('❌ Not found as Run or Batch. This ID may be invalid.');
      }
      
      await prisma.$disconnect();
      return;
    }

    console.log('✅ Found ScanBatch!');
    console.log('  Name:', batch.name || '(unnamed)');
    console.log('  Status:', batch.status);
    console.log('  Niche:', batch.niche?.name || 'N/A');
    console.log('  Total Keywords:', batch.totalKeywords || 0);
    console.log('  Processed:', batch.processedKeywords || 0);
    console.log('  Created:', batch.createdAt);

    if (batch.keywords.length > 0) {
      console.log('\n📍 Sample Keywords:');
      batch.keywords.slice(0, 5).forEach((kw, i) => {
        console.log(`  ${i + 1}. ${kw.localizedQuery}`);
        console.log(`     City: ${kw.city?.city}, ${kw.city?.state}`);
      });
    }

    if (batch.status === 'completed') {
      console.log('\n✅ This batch has already been processed!');
    } else if (batch.status === 'processing') {
      console.log('\n⏳ This batch is currently being processed...');
    } else if (batch.status === 'queued') {
      console.log('\n🚀 This batch is queued and ready to process!');
      console.log('\nTo process this batch, you would need to run the batch processor.');
      console.log('This typically involves fetching keyword data for each location.');
    } else if (batch.status === 'failed') {
      console.log('\n❌ This batch failed previously.');
    }

    await prisma.$disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

const batchId = process.argv[2] || 'ed818629-00c4-49b0-9e35-f1b8fe4ecdea';
runBatch(batchId);


