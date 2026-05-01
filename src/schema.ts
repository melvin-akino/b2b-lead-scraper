import { z } from 'zod';

export const LeadSchema = z.object({
  id: z.string(),
  company_name: z.string(),
  prospect_name: z.string(),
  role: z.string(),
  website_url: z.string().url(),
  linkedin_url: z.string().url().optional(),
  raw_scraped_content: z.string().optional(),
  analysis_summary: z.string().optional(),
  pain_points: z.array(z.string()).optional(),
  business_focus: z.string().optional(),
  generated_hooks: z.array(z.string()).optional(),
  scraped_at: z.string().datetime().optional(),
  analyzed_at: z.string().datetime().optional(),
});

export type Lead = z.infer<typeof LeadSchema>;

export const LeadInputSchema = LeadSchema.pick({
  company_name: true,
  prospect_name: true,
  role: true,
  website_url: true,
  linkedin_url: true,
});

export type LeadInput = z.infer<typeof LeadInputSchema>;
