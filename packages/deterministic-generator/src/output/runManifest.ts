/**
 * Run manifest generation and management
 */

import { createHash } from 'crypto';
import { RunManifest, RunConfig, SiteInput } from '../types';

/**
 * Generate hash of site input for deterministic runs
 */
export function hashSiteInput(siteInput: SiteInput): string {
  const json = JSON.stringify(siteInput, Object.keys(siteInput).sort());
  return createHash('sha256').update(json).digest('hex').substring(0, 16);
}

/**
 * Create run manifest
 */
export function createRunManifest(
  siteId: string,
  siteInput: SiteInput,
  config: RunConfig,
  pagesGenerated: string[],
  validationPass: boolean,
  outputDirectory: string
): RunManifest {
  const timestamp = new Date().toISOString();
  const siteInputHash = hashSiteInput(siteInput);

  return {
    site_id: siteId,
    timestamp,
    site_input_hash: siteInputHash,
    model: config.model,
    temperature: config.temperature,
    prompt_version: config.prompt_version,
    pages_generated: pagesGenerated,
    validation_pass: validationPass,
    output_directory: outputDirectory,
  };
}

/**
 * Write manifest to file
 */
export async function writeManifest(
  manifest: RunManifest,
  outputPath: string
): Promise<void> {
  const fs = await import('fs/promises');
  await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

