const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function stopAllRunning() {
  try {
    // Find all running analyses
    const runningRuns = await prisma.run.findMany({
      where: { status: 'running' }
    });

    console.log(`Found ${runningRuns.length} running analysis(es)`);
    
    // Cancel ALL of them, even if none are found (prevents stuck processes)
    if (runningRuns.length === 0) {
      console.log('No running analyses found in database.');
      console.log('Setting all runs to cancelled to stop any stuck processes...');
      
      // Set ALL runs (including completed ones) to cancelled to be safe
      await prisma.run.updateMany({
        where: { status: { in: ['running', 'pending'] } },
        data: {
          status: 'cancelled',
          notes: 'Stopped by user request - emergency stop'
        }
      });
    } else {
      // Cancel the running ones
      for (const run of runningRuns) {
        console.log(`Cancelling run ${run.id} (${run.niche})...`);
        await prisma.run.update({
          where: { id: run.id },
          data: {
            status: 'cancelled',
            notes: 'Stopped by user request - all running analyses cancelled'
          }
        });
      }

      console.log(`✅ Successfully cancelled ${runningRuns.length} analysis(es)`);
    }

    console.log('');
    console.log('✅ All analyses have been marked as cancelled.');
    console.log('⚠️  IMPORTANT: If Chrome windows are still opening, you may need to:');
    console.log('   1. Restart the web server (stop and restart "npm run dev" in apps/web)');
    console.log('   2. Or kill all Node.js processes completely');
    console.log('');
    console.log('The analysis processes should detect cancellation and stop within a few seconds.');
    
  } catch (error) {
    console.error('Error stopping analyses:', error);
  } finally {
    await prisma.$disconnect();
  }
}

stopAllRunning();

