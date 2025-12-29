/**
 * Zod schema for site_input.json validation
 */

import { z } from 'zod';

export const SiteInputSchema = z.object({
  business_name: z.string().min(1),
  cta_phone: z.string().regex(/^[\d\s\(\)\-\+]+$/),
  primary_service: z.string().min(1),
  supporting_services: z.array(z.string()).min(0),
  target_city: z.string().min(1),
  state: z.string().length(2).toUpperCase(),
  business_type: z.enum(['lead_gen', 'local_service']),
  semantic_keywords_map: z.record(z.string(), z.array(z.string())),
  top_keywords: z.array(z.object({
    keyword: z.string(),
    volume: z.number(),
  })).optional(),
  blog: z.object({
    enabled: z.boolean(),
    num_posts: z.number().int().min(0).max(20),
    publish_mode: z.enum(['draft', 'publish']),
    avoid_topics: z.array(z.string()),
  }).optional(),
  external_links_policy: z.enum(['default_us']).default('default_us'),
});

export type SiteInput = z.infer<typeof SiteInputSchema>;

/**
 * Validate site input JSON
 */
export function validateSiteInput(data: unknown): SiteInput {
  return SiteInputSchema.parse(data);
}

