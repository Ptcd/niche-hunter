import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@niche-hunter/db';
import pino from 'pino';
import {
  computeOpportunity,
  computeScoreBreakdown,
  computeFinalScore,
} from '@niche-hunter/core';

const logger = pino({ level: 'info' });

export async function reweightCommand(
  runId: string,
  weightsPath: string
): Promise<void> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { scans: true },
  });

  if (!run) {
    logger.error({ runId }, 'Run not found');
    process.exit(1);
  }

  const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));
  const alpha = weights.alpha || parseFloat(process.env.ALPHA || '0.6');
  const beta = weights.beta || parseFloat(process.env.BETA || '0.4');

  logger.info({ runId, alpha, beta }, 'Reweighting run');

  for (const scan of run.scans) {
    const breakdown = computeScoreBreakdown(
      scan.demandScore,
      scan.difficulty,
      scan.profitEst || undefined,
      alpha,
      beta
    );

    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        opportunity: breakdown.opportunity,
        classification: breakdown.classification,
      },
    });
  }

  logger.info({ runId }, 'Reweighting completed');
  console.log(`Recalculated opportunity scores for run ${runId}`);
}

