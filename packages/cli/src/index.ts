#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { runCommand } from './commands/run';
import { exportCommand } from './commands/export';
import { reweightCommand } from './commands/reweight';

yargs(hideBin(process.argv))
  .command(
    'run',
    'Run a batch analysis for a niche',
    (yargs) => {
      return yargs
        .option('data', {
          type: 'string',
          describe: 'Path to single CSV with cities, payouts, and optional niche column',
          conflicts: ['cities', 'revenue'],
        })
        .option('niche', {
          type: 'string',
          describe: 'Niche name (e.g., "roofing"). Required if not in CSV niche column.',
        })
        .option('cities', {
          type: 'string',
          describe: 'Path to CSV/JSON file with cities or ZIPs (use with --revenue)',
          conflicts: ['data'],
        })
        .option('payout', {
          type: 'number',
          describe: 'Base payout per lead (used if revenue file not provided)',
        })
        .option('revenue', {
          type: 'string',
          describe: 'Path to CSV file with city/ZIP payouts (use with --cities)',
          conflicts: ['data'],
        })
        .option('limit', {
          type: 'number',
          default: 100,
          describe: 'Maximum number of locations to process',
        })
        .option('ctr', {
          type: 'number',
          describe: 'Click-through rate (override default)',
        })
        .option('siteconv', {
          type: 'number',
          describe: 'Site conversion rate (override default)',
        })
        .option('leadconv', {
          type: 'number',
          describe: 'Lead conversion rate (override default)',
        })
        .check((argv) => {
          if (!argv.data && !argv.cities) {
            throw new Error('Either --data or --cities must be provided');
          }
          if (!argv.data && !argv.niche) {
            throw new Error('--niche is required when using --cities');
          }
          return true;
        });
    },
    async (argv) => {
      await runCommand(argv);
    }
  )
  .command(
    'export',
    'Export results from a run',
    (yargs) => {
      return yargs
        .option('run', {
          type: 'string',
          demandOption: true,
          alias: 'r',
          describe: 'Run ID to export',
        })
        .option('out', {
          type: 'string',
          demandOption: true,
          alias: 'o',
          describe: 'Output file path (CSV or JSON)',
        });
    },
    async (argv) => {
      await exportCommand(argv.run, argv.out);
    }
  )
  .command(
    'reweight',
    'Recalculate opportunity scores with new weights',
    (yargs) => {
      return yargs
        .option('run', {
          type: 'string',
          demandOption: true,
          alias: 'r',
          describe: 'Run ID to recalculate',
        })
        .option('weights', {
          type: 'string',
          demandOption: true,
          alias: 'w',
          describe: 'Path to weights JSON file',
        });
    },
    async (argv) => {
      await reweightCommand(argv.run, argv.weights);
    }
  )
  .command(
    'generate-keywords',
    'Generate keyword taxonomy using AI',
    (yargs) => {
      return yargs
        .option('niche', {
          type: 'string',
          demandOption: true,
          describe: 'Niche name to generate keywords for',
        })
        .option('provider', {
          type: 'string',
          choices: ['openai', 'anthropic', 'custom'],
          describe: 'AI provider to use (overrides AI_PROVIDER env var)',
        })
        .option('model', {
          type: 'string',
          describe: 'Model name (overrides AI_MODEL env var)',
        });
    },
    async (argv) => {
      const { generateKeywordTaxonomy } = await import('@niche-hunter/core/src/keywords/ai-generate');
      const { getAIConfig } = await import('@niche-hunter/ai');
      
      let config = getAIConfig();
      if (argv.provider) {
        config.provider = argv.provider as 'openai' | 'anthropic' | 'custom';
      }
      if (argv.model) {
        config.model = argv.model;
      }
      
      // Override env temporarily
      if (argv.provider || argv.model) {
        process.env.AI_PROVIDER = config.provider;
        process.env.AI_MODEL = config.model;
      }
      
      await generateKeywordTaxonomy(argv.niche, true);
    }
  )
  .demandCommand(1, 'You need at least one command before moving on')
  .help()
  .parse();
