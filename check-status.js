const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStatus() {
  try {
    const runs = await prisma.run.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: { scans: true }
    });

    if (runs.length === 0) {
      console.log('No runs found');
      await prisma.$disconnect();
      return;
    }

    const run = runs[0];
    console.log('\n📊 CURRENT RUN STATUS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ID:', run.id.substring(0, 12) + '...');
    console.log('Niche:', run.niche);
    console.log('Status:', run.status);
    console.log('Progress:', run.notes || '(none)');
    console.log('Scans completed:', run.scans.length);
    console.log('Created:', run.createdAt.toLocaleString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (run.scans.length > 0) {
      console.log('\n📍 Recent scans:');
      run.scans.slice(0, 5).forEach((scan, i) => {
        console.log(`  ${i+1}. ${scan.city}, ${scan.state} - Opportunity: ${scan.opportunity.toFixed(3)}`);
      });
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkStatus();

