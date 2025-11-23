const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findRequest(requestId) {
  console.log(`\n🔍 Searching for Request ID: ${requestId}\n`);

  try {
    // Check if it's a Run
    const run = await prisma.run.findUnique({
      where: { id: requestId },
      include: { scans: true }
    });

    if (run) {
      console.log('✅ Found as Run:');
      console.log('  Niche:', run.niche);
      console.log('  Status:', run.status);
      console.log('  Created:', run.createdAt);
      console.log('  Scans:', run.scans.length);
      console.log('\nThis is a completed run. You can view results or export them.');
      await prisma.$disconnect();
      return { type: 'run', data: run };
    }

    // Check if it's a ScanBatch
    const batch = await prisma.scanBatch.findUnique({
      where: { id: requestId },
      include: { 
        niche: true,
        keywords: { take: 5 }
      }
    });

    if (batch) {
      console.log('✅ Found as ScanBatch:');
      console.log('  Name:', batch.name || '(unnamed)');
      console.log('  Status:', batch.status);
      console.log('  Niche:', batch.niche?.name || 'N/A');
      console.log('  Created:', batch.createdAt);
      console.log('  Total Keywords:', batch.totalKeywords || 0);
      console.log('  Processed:', batch.processedKeywords || 0);
      console.log('  Completed:', batch.completedAt || 'Not yet');
      
      if (batch.status === 'queued' || batch.status === 'processing') {
        console.log('\n🚀 This batch can be processed!');
      } else {
        console.log('\n✅ This batch has already been processed.');
      }
      await prisma.$disconnect();
      return { type: 'batch', data: batch };
    }

    // Check if it's a Scan
    const scan = await prisma.scan.findUnique({
      where: { id: requestId }
    });

    if (scan) {
      console.log('✅ Found as Scan:');
      console.log('  Location:', scan.city, ',', scan.state);
      console.log('  Opportunity:', scan.opportunity);
      console.log('  Created:', scan.createdAt);
      await prisma.$disconnect();
      return { type: 'scan', data: scan };
    }

    console.log('❌ Request ID not found in database.');
    console.log('   It may be from an old run or invalid.');
    await prisma.$disconnect();
    return null;

  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run the search
const requestId = process.argv[2] || 'ed818629-00c4-49b0-9e35-f1b8fe4ecdea';
findRequest(requestId);


