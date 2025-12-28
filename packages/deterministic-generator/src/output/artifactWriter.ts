/**
 * Write file artifacts (pages_raw, pages_final, reports)
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { ValidationReport, RunManifest } from '../types';

export interface ArtifactWriterOptions {
  outputDirectory: string;
  siteId: string;
  timestamp: string;
}

/**
 * Create output directory structure
 */
export async function createOutputStructure(options: ArtifactWriterOptions): Promise<void> {
  const { outputDirectory } = options;
  
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.mkdir(join(outputDirectory, 'pages_raw'), { recursive: true });
  await fs.mkdir(join(outputDirectory, 'pages_final'), { recursive: true });
  await fs.mkdir(join(outputDirectory, 'page_payloads'), { recursive: true });
  await fs.mkdir(join(outputDirectory, 'blog_post_payloads'), { recursive: true });
}

/**
 * Write site_input.json
 */
export async function writeSiteInput(
  siteInput: unknown,
  outputPath: string
): Promise<void> {
  await fs.writeFile(
    outputPath,
    JSON.stringify(siteInput, null, 2),
    'utf-8'
  );
}

/**
 * Write raw HTML page (with placeholders)
 */
export async function writeRawPage(
  slug: string,
  html: string,
  outputDirectory: string
): Promise<void> {
  const filename = slug === '/' ? 'index.html' : `${slug.replace(/^\//, '').replace(/\//g, '-')}.html`;
  const path = join(outputDirectory, 'pages_raw', filename);
  await fs.writeFile(path, html, 'utf-8');
}

/**
 * Write final HTML page (placeholders replaced)
 */
export async function writeFinalPage(
  slug: string,
  html: string,
  outputDirectory: string
): Promise<void> {
  const filename = slug === '/' ? 'index.html' : `${slug.replace(/^\//, '').replace(/\//g, '-')}.html`;
  const path = join(outputDirectory, 'pages_final', filename);
  await fs.writeFile(path, html, 'utf-8');
}

/**
 * Write page payload JSON
 */
export async function writePagePayload(
  slug: string,
  payload: unknown,
  outputDirectory: string
): Promise<void> {
  const filename = slug === '/' ? 'home.json' : `${slug.replace(/^\//, '').replace(/\//g, '-')}.json`;
  const path = join(outputDirectory, 'page_payloads', filename);
  await fs.writeFile(
    path,
    JSON.stringify(payload, null, 2),
    'utf-8'
  );
}

/**
 * Write validation report
 */
export async function writeValidationReport(
  report: ValidationReport,
  outputPath: string
): Promise<void> {
  await fs.writeFile(
    outputPath,
    JSON.stringify(report, null, 2),
    'utf-8'
  );
}

/**
 * Write run manifest
 */
export async function writeRunManifest(
  manifest: RunManifest,
  outputPath: string
): Promise<void> {
  await fs.writeFile(
    outputPath,
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );
}

/**
 * Write local context JSON
 */
export async function writeLocalContext(
  context: unknown,
  outputPath: string
): Promise<void> {
  await fs.writeFile(
    outputPath,
    JSON.stringify(context, null, 2),
    'utf-8'
  );
}

/**
 * Write blueprint JSON
 */
export async function writeBlueprint(
  blueprint: unknown,
  outputPath: string
): Promise<void> {
  await fs.writeFile(
    outputPath,
    JSON.stringify(blueprint, null, 2),
    'utf-8'
  );
}

/**
 * Write blog plan JSON
 */
export async function writeBlogPlan(
  blogPlan: unknown,
  outputPath: string
): Promise<void> {
  await fs.writeFile(
    outputPath,
    JSON.stringify(blogPlan, null, 2),
    'utf-8'
  );
}

/**
 * Write validation report
 */
export async function writeValidationReport(
  report: unknown,
  outputPath: string
): Promise<void> {
  await fs.writeFile(
    outputPath,
    JSON.stringify(report, null, 2),
    'utf-8'
  );
}

