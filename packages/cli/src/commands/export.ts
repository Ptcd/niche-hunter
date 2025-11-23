import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@niche-hunter/db';
import pino from 'pino';

const logger = pino({ level: 'info' });

export async function exportCommand(runId: string, outPath: string): Promise<void> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { scans: true },
  });

  if (!run) {
    logger.error({ runId }, 'Run not found');
    process.exit(1);
  }

  const ext = path.extname(outPath).toLowerCase();
  const scans = run.scans.sort((a, b) => b.opportunity - a.opportunity);

  if (ext === '.json') {
    const data = {
      run: {
        id: run.id,
        niche: run.niche,
        payout: run.payout,
        createdAt: run.createdAt,
        status: run.status,
      },
      scans: scans.map((s) => ({
        city: s.city,
        state: s.state,
        zip: s.zip,
        demandScore: s.demandScore,
        difficulty: s.difficulty,
        opportunity: s.opportunity,
        profitEst: s.profitEst,
        classification: s.classification,
        keywords: s.keywords,
      })),
      top3: scans.slice(0, 3).map((s) => ({
        city: s.city,
        state: s.state,
        zip: s.zip,
        demandScore: s.demandScore,
        difficulty: s.difficulty,
        opportunity: s.opportunity,
        profitEst: s.profitEst,
        classification: s.classification,
        keywords: s.keywords,
      })),
    };

    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  } else {
    // CSV
    const headers = [
      'city',
      'state',
      'zip',
      'demandScore',
      'difficulty',
      'opportunity',
      'profitEst',
      'classification',
      'keywords',
    ];

    const rows = scans.map((s) => [
      s.city,
      s.state,
      s.zip || '',
      s.demandScore.toFixed(3),
      s.difficulty.toFixed(3),
      s.opportunity.toFixed(3),
      s.profitEst?.toFixed(2) || '',
      s.classification || '',
      s.keywords || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(',')),
    ].join('\n');

    fs.writeFileSync(outPath, csv);
  }

  logger.info({ runId, outPath, count: scans.length }, 'Exported run');
  console.log(`Exported ${scans.length} scans to ${outPath}`);
}

