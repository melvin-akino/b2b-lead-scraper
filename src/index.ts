/**
 * index.ts
 *
 * Programmatic entry point for the lead generation system.
 *
 * Use this when you want to drive the pipeline from code rather than the CLI —
 * for example, inside a cron job, a webhook handler, or a larger application.
 *
 * ── Quick example ─────────────────────────────────────────────────────────
 *
 *   import { runPipeline } from './pipeline';
 *   import { exportToCSV }  from './exporter';
 *   import { getAllLeads }  from './store';
 *
 *   const results = await runPipeline([
 *     {
 *       prospect_name: 'Maria Santos',
 *       role:          'CEO',
 *       company_name:  'Kumu',
 *       website_url:   'https://www.kumu.live',
 *       linkedin_url:  'https://www.linkedin.com/company/kumu-ph',
 *     },
 *   ], { searchContext: 'SaaS Founders in Manila' });
 *
 *   const csvPath = await exportToCSV(getAllLeads());
 *   console.log('Exported to', csvPath);
 */

// Re-export the public surface area so consumers can import from one place.
export { runPipeline, PipelineOptions, PipelineResult } from './pipeline';
export { exportToCSV }                                   from './exporter';
export { getAllLeads, upsertLead, getLeadById, clearAllLeads, countLeads } from './store';
export { researchLead, ResearchResult }                  from './researcher';
export { generateHooks }                                 from './personalizer';
export { LeadScraper, ScrapeResult }                     from './scraper';
export { Lead, LeadInput, LeadSchema, LeadInputSchema }  from './schema';
