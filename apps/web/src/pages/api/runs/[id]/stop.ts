import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@niche-hunter/db';

// Helper function to retry Prisma queries with reconnection on prepared statement errors
async function retryPrismaQuery<T>(
  queryFn: () => Promise<T>,
  retries: number = 5
): Promise<T> {
  let attempt = 0;
  while (retries > 0) {
    attempt++;
    try {
      return await queryFn();
    } catch (error: any) {
      // Check for prepared statement errors (both "does not exist" and "already exists")
      const isPreparedStatementError = 
        error.code === '26000' || // prepared statement does not exist
        error.code === '42P05' || // prepared statement already exists
        error.message?.includes('prepared statement');
      
      if (isPreparedStatementError && retries > 1) {
        retries--;
        const waitTime = 500 + (attempt * 200); // Progressive backoff: 500ms, 700ms, 900ms, etc.
        console.log(`   ⚠️  [DB_RETRY] Prepared statement error (attempt ${attempt}/${5 - retries + 1}), retrying in ${waitTime}ms...`);
        
        // Wait with progressive backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Disconnect and reconnect Prisma to clear connection state
        try {
          await prisma.$disconnect();
          await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause between disconnect/connect
        } catch (e) {
          // Ignore disconnect errors
        }
        try {
          await prisma.$connect();
        } catch (e) {
          // Ignore connect errors, will retry
        }
        continue;
      }
      throw error; // Re-throw if not a prepared statement error or out of retries
    }
  }
  throw new Error('Query failed after all retries');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Run ID is required' });
  }

  try {
    console.log(`[Stop] Attempting to stop run: ${id}`);
    const run = await retryPrismaQuery(() =>
      prisma.run.findUnique({
        where: { id },
      })
    );

    if (!run) {
      console.log(`[Stop] Run ${id} not found`);
      return res.status(404).json({ error: 'Run not found' });
    }

    console.log(`[Stop] Run ${id} current status: "${run.status}"`);

    // Allow stopping if running, or if already cancelled (idempotent)
    if (run.status === 'cancelled') {
      console.log(`[Stop] Run ${id} already cancelled`);
      return res.status(200).json({ message: 'Run was already cancelled' });
    }

    // Only prevent stopping if already completed or errored
    if (run.status === 'completed') {
      console.log(`[Stop] Run ${id} already completed - cannot stop`);
      return res.status(400).json({ 
        error: 'Cannot stop run - analysis has already completed.' 
      });
    }

    // Allow stopping runs in error state - user might want to clear it
    // Just mark as cancelled instead of returning error
    if (run.status === 'error') {
      console.log(`[Stop] Run ${id} is in error state - marking as cancelled anyway`);
      // Proceed to mark as cancelled below
    }

    // For 'running' or any other status (pending, etc.), allow cancellation
    console.log(`[Stop] Run ${id} has status "${run.status}" - proceeding with cancellation`);

    // Set cancellation flag immediately (fast, in-memory check)
    try {
      const createModule = await import('../create');
      if (createModule.cancellationFlags) {
        (createModule.cancellationFlags as any).set(id, true);
      }
    } catch (error) {
      // If import fails, continue with database update only
      console.warn('Could not set in-memory cancellation flag:', error);
    }

    // Set global cancellation flag to prevent Chrome from launching
    try {
      const { setGlobalCancellation } = await import('@niche-hunter/crawler');
      setGlobalCancellation(true);
    } catch (error) {
      console.warn('Could not set global cancellation flag:', error);
    }

    // Mark run as cancelled in database - processAnalysis will check this and stop
    // Use retry logic to handle prepared statement errors
    await retryPrismaQuery(() =>
      prisma.run.update({
        where: { id },
        data: { 
          status: 'cancelled',
          notes: 'Analysis stopped by user',
        },
      })
    );
    
    console.log(`[Stop] ✅ Successfully marked run ${id} as cancelled in database`);

    return res.status(200).json({ message: 'Analysis stopped successfully' });
  } catch (error: any) {
    console.error('Error stopping analysis:', error);
    return res.status(500).json({ error: error.message || 'Failed to stop analysis' });
  }
}

