import { z } from 'zod';

// Normalise a URL string: prepend https:// if no protocol is present
const normaliseUrl = (val: string) => {
  const trimmed = val.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const urlField = z
  .string()
  .transform(normaliseUrl)
  .pipe(z.string().url());

const optionalUrlField = z
  .string()
  .transform(normaliseUrl)
  .pipe(z.string().url())
  .optional();

export const LeadSchema = z.object({
  id: z.string(),
  company_name: z.string(),
  prospect_name: z.string(),
  role: z.string(),
  website_url: urlField,
  linkedin_url: optionalUrlField,
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
