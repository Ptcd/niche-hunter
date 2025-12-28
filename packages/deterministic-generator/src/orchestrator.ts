/**
 * Main Orchestrator
 * 
 * Coordinates the entire deterministic site generation pipeline
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { SiteInput, LocalContext, Blueprint, BlogPlan, PagePayload, RunConfig, RunManifest, ValidationReport } from './types';
import { buildSiteInputFromDb } from './input/siteInputBuilder';
import { generateLocalContext } from './context/localContextHydrator';
import { generateBlueprint } from './blueprint/blueprintGenerator';
import { generateBlogPlan } from './blog/blogPlanGenerator';
import { buildAllPagePayloads } from './payload/payloadBuilder';
import { generatePageHtml, PageWriterConfig } from './writers/pageWriter';
import { replacePlaceholders } from './linking/placeholderReplacer';
import { validateAllPages } from './validate/validator';
import {
  createOutputStructure,
  writeSiteInput,
  writeLocalContext,
  writeBlueprint,
  writeBlogPlan,
  writePagePayload,
  writeRawPage,
  writeFinalPage,
  writeValidationReport,
  writeRunManifest,
} from './output/artifactWriter';
import { createRunManifest } from './output/runManifest';

interface GenerationResult {
  html: string;
  finalHtml: string;
  validation: ValidationReport;
}

/**
 * Generate and validate a single page with retry logic
 */
async function generateAndValidatePage(
  payload: PagePayload,
  blueprint: Blueprint,
  config: RunConfig,
  attempt: number = 1
): Promise<GenerationResult> {
  const writerConfig: PageWriterConfig = {
    model: config.model,
    temperature: config.temperature,
    promptVersion: config.prompt_version,
  };

  // Generate HTML
  const rawHtml = await generatePageHtml(payload, writerConfig);

  // Replace placeholders
  const replacementResult = replacePlaceholders(rawHtml, payload.slug, blueprint);
  const finalHtml = replacementResult.html;

  // Validate
  const validation = validateAllPages(
    [{
      slug: payload.slug,
      html: finalHtml,
      pageType: payload.page_type,
      primaryKeyword: payload.primary_keyword,
    }],
    blueprint
  );

  // Retry logic: if hard failure and first attempt, retry once
  if (!validation.pass && validation.hard_failures.length > 0 && attempt < 2) {
    console.log(`[Orchestrator] Page ${payload.slug} failed validation, retrying...`);
    return generateAndValidatePage(payload, blueprint, config, attempt + 1);
  }

  return {
    html: rawHtml,
    finalHtml,
    validation,
  };
}

/**
 * Main orchestrator function
 * 
 * Generates a complete site using deterministic generator
 */
export async function generateSiteDeterministic(
  siteId: string,
  config: RunConfig
): Promise<RunManifest> {
  console.log(`[Orchestrator] Starting deterministic generation for site ${siteId}`);

  // Step 1: Build site_input.json from DB
  console.log(`[Orchestrator] Step 1: Building site input from database...`);
  const siteInput: SiteInput = await buildSiteInputFromDb(siteId);

  // Step 2: Create output directory structure
  await createOutputStructure({
    outputDirectory: config.output_directory,
    siteId,
    timestamp: new Date().toISOString(),
  });

  // Write site_input.json
  await writeSiteInput(siteInput, join(config.output_directory, 'site_input.json'));

  // Step 3: Generate local_context.json (with caching)
  console.log(`[Orchestrator] Step 2: Generating local context...`);
  const localContext: LocalContext = await generateLocalContext(
    siteInput.target_city,
    siteInput.state
  );
  await writeLocalContext(localContext, join(config.output_directory, 'local_context.json'));

  // Step 4: Generate blueprint.json
  console.log(`[Orchestrator] Step 3: Generating blueprint...`);
  let blueprint: Blueprint = await generateBlueprint(siteInput, localContext);

  // Step 5: Generate blog_plan.json if enabled
  let blogPlan: BlogPlan | null = null;
  if (siteInput.blog?.enabled) {
    console.log(`[Orchestrator] Step 4: Generating blog plan...`);
    blogPlan = await generateBlogPlan(siteInput, blueprint);
    await writeBlogPlan(blogPlan, join(config.output_directory, 'blog_plan.json'));

    // Add blog pages to blueprint
    blueprint.pages.push({
      slug: blogPlan.blog_index.slug,
      page_type: 'blog_index',
      can_link_to: blogPlan.posts.map(p => p.links_to.service_slug).filter(Boolean),
    });

    for (const post of blogPlan.posts) {
      blueprint.pages.push({
        slug: post.slug,
        page_type: 'blog_post',
        can_link_to: [
          post.links_to.service_slug,
          post.links_to.contact_slug,
          ...(post.links_to.related_post_slug ? [post.links_to.related_post_slug] : []),
        ].filter(Boolean),
        primary_keyword: post.primary_keyword,
      });
    }
  }

  // Write updated blueprint
  await writeBlueprint(blueprint, join(config.output_directory, 'blueprint.json'));

  // Step 6: Build page payloads
  console.log(`[Orchestrator] Step 5: Building page payloads...`);
  let pagePayloads: PagePayload[] = buildAllPagePayloads(blueprint, siteInput, localContext);

  // Add blog post payloads if enabled
  if (blogPlan) {
    for (const post of blogPlan.posts) {
      const blogPage = blueprint.pages.find(p => p.slug === post.slug);
      if (blogPage) {
        const blogPayload: PagePayload = {
          slug: post.slug,
          page_type: 'blog_post',
          business_name: siteInput.business_name,
          cta_phone: siteInput.cta_phone,
          state: siteInput.state.toLowerCase(),
          can_link_to: blogPage.can_link_to,
          external_link_placeholders: [`[[EXTERNAL:STATE_RESOURCE]]`],
          real_landmarks: [],
          primary_keyword: post.primary_keyword,
          semantic_keywords: [],
        };
        pagePayloads.push(blogPayload);
      }
    }

    // Add blog index payload
    const blogIndexPage = blueprint.pages.find(p => p.slug === blogPlan.blog_index.slug);
    if (blogIndexPage) {
      const blogIndexPayload: PagePayload = {
        slug: blogPlan.blog_index.slug,
        page_type: 'blog_index',
        business_name: siteInput.business_name,
        cta_phone: siteInput.cta_phone,
        state: siteInput.state.toLowerCase(),
        can_link_to: blogPlan.posts.map(p => p.slug),
        external_link_placeholders: [],
        real_landmarks: [],
      };
      pagePayloads.push(blogIndexPayload);
    }
  }

  // Write all payloads
  for (const payload of pagePayloads) {
    await writePagePayload(payload.slug, payload, config.output_directory);
  }

  // Step 7: Generate pages_raw/*.html and pages_final/*.html
  console.log(`[Orchestrator] Step 6: Generating pages...`);
  const pagesGenerated: string[] = [];
  const pageResults: Array<{ slug: string; html: string; finalHtml: string }> = [];

  for (const payload of pagePayloads) {
    console.log(`[Orchestrator] Generating page: ${payload.slug}`);
    
    const result = await generateAndValidatePage(payload, blueprint, config);
    
    // Write raw HTML
    await writeRawPage(payload.slug, result.html, config.output_directory);
    
    // Write final HTML
    await writeFinalPage(payload.slug, result.finalHtml, config.output_directory);
    
    pagesGenerated.push(payload.slug);
    pageResults.push({
      slug: payload.slug,
      html: result.finalHtml,
      finalHtml: result.finalHtml,
    });
  }

  // Step 8: Validate all pages together
  console.log(`[Orchestrator] Step 7: Validating all pages...`);
  const validationInputs = pageResults.map(p => {
    const payload = pagePayloads.find(pl => pl.slug === p.slug);
    return {
      slug: p.slug,
      html: p.finalHtml,
      pageType: payload?.page_type || 'home',
      primaryKeyword: payload?.primary_keyword,
    };
  });
  
  const finalValidation = validateAllPages(validationInputs, blueprint);

  await writeValidationReport(
    finalValidation,
    join(config.output_directory, 'validation_report.json')
  );

  // Step 9: Create and write run manifest
  console.log(`[Orchestrator] Step 8: Creating run manifest...`);
  const manifest = createRunManifest(
    siteId,
    siteInput,
    config,
    pagesGenerated,
    finalValidation.pass,
    config.output_directory
  );

  await writeRunManifest(manifest, join(config.output_directory, 'run_manifest.json'));

  console.log(`[Orchestrator] Generation complete. Validation: ${finalValidation.pass ? 'PASS' : 'FAIL'}`);
  console.log(`[Orchestrator] Pages generated: ${pagesGenerated.length}`);
  console.log(`[Orchestrator] Hard failures: ${finalValidation.hard_failures.length}`);
  console.log(`[Orchestrator] Warnings: ${finalValidation.warnings.length}`);

  return manifest;
}

