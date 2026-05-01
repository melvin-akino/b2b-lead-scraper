/**
 * pipeline.ts
 *
 * The central orchestrator. Given one or more LeadInput objects, it runs the
 * full enrichment pipeline for each:
 *
 *   1. Scrape  — visits website (and optionally LinkedIn) via Playwright
 *   2. Research — sends raw content to Claude to extract focus + pain points
 *   3. Personalize — sends research to Claude to generate 3 icebreaker hooks
 *   4. Store   — persists the enriched Lead to data/leads.json
 *
 * The pipeline processes leads sequentially by default (safer for stealth).
 * A random inter-lead delay is added to mimic human browsing cadence.
 *
 * An optional `onProgress` callback lets callers (e.g. the Express server)
 * receive structured events for real-time UI streaming without altering the
 * CLI behavior — chalk/ora output continues in parallel.
 */

import { nanoid } from 'nanoid';
import chalk from 'chalk';
import ora from 'ora';

import { LeadScraper } from './scraper';
import { researchLead } from './researcher';
import { generateHooks } from './personalizer';
import { upsertLead } from './store';
import { Lead, LeadInput } from './schema';

const INTER_LEAD_DELAY_MS = { min: 3000, max: 7000 };

function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ProgressEventType =
  | 'info'
  | 'success'
  | 'error'
  | 'step_start'
  | 'step_done'
  | 'lead_start'
  | 'lead_done'
  | 'complete';

export interface ProgressEvent {
  type: ProgressEventType;
  message: string;
  leadIndex?: number;
  leadName?: string;
  data?: unknown;
}

export interface PipelineOptions {
  /** If true, skip scraping and re-use existing raw_scraped_content from the store. */
  skipScrape?: boolean;
  /** Extra context string passed to the researcher (e.g. the original search query). */
  searchContext?: string;
  /** Optional callback for structured real-time progress events (used by the web server). */
  onProgress?: (event: ProgressEvent) => void;
}

export interface PipelineResult {
  lead: Lead;
  status: 'success' | 'error';
  error?: string;
}

/**
 * Runs the full Scrape → Research → Personalize → Store pipeline for a batch of leads.
 *
 * @param inputs   Array of lead inputs (name, company, URL etc.).
 * @param options  Pipeline options.
 * @returns        Array of results, one per input, in the same order.
 */
export async function runPipeline(
  inputs: LeadInput[],
  options: PipelineOptions = {}
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = [];
  const scraper = new LeadScraper();
  const emit = (event: ProgressEvent) => options.onProgress?.(event);

  if (!options.skipScrape) {
    await scraper.init();
  }

  try {
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const label = `${input.prospect_name} @ ${input.company_name}`;
      const meta = { leadIndex: i, leadName: input.prospect_name };

      console.log(chalk.cyan(`\n[${i + 1}/${inputs.length}] Processing: ${label}`));
      emit({ type: 'lead_start', message: `[${i + 1}/${inputs.length}] Processing: ${label}`, ...meta });

      const lead: Lead = {
        id: nanoid(),
        ...input,
        scraped_at: undefined,
        analyzed_at: undefined,
      };

      // ── Step 1: Scrape ────────────────────────────────────────────────────
      if (!options.skipScrape) {
        const scrapeSpinner = ora('  Scraping website...').start();
        emit({ type: 'step_start', message: 'Scraping website...', ...meta });
        try {
          const scraped = await scraper.scrapeAll(input.website_url, input.linkedin_url);
          lead.raw_scraped_content = scraped.text;
          lead.scraped_at = new Date().toISOString();
          scrapeSpinner.succeed(chalk.green('  Scraped successfully'));
          emit({ type: 'step_done', message: 'Website scraped successfully', ...meta });
        } catch (err) {
          scrapeSpinner.fail(chalk.red('  Scrape failed'));
          const msg = err instanceof Error ? err.message : String(err);
          emit({ type: 'error', message: `Scrape failed: ${msg}`, ...meta });
          results.push({ lead, status: 'error', error: `Scrape error: ${msg}` });
          continue;
        }
      }

      if (!lead.raw_scraped_content) {
        emit({ type: 'error', message: 'No scraped content available.', ...meta });
        results.push({ lead, status: 'error', error: 'No scraped content available.' });
        continue;
      }

      // ── Step 2: Research ─────────────────────────────────────────────────
      const researchSpinner = ora('  Analyzing with Claude...').start();
      emit({ type: 'step_start', message: 'Analyzing content with Claude...', ...meta });
      try {
        const research = await researchLead(lead.raw_scraped_content, options.searchContext);
        lead.business_focus = research.business_focus;
        lead.pain_points = research.pain_points;
        lead.analysis_summary = research.analysis_summary;
        researchSpinner.succeed(chalk.green('  Research complete'));
        emit({ type: 'step_done', message: 'Research complete — pain points extracted', ...meta });
      } catch (err) {
        researchSpinner.fail(chalk.red('  Research failed'));
        const msg = err instanceof Error ? err.message : String(err);
        emit({ type: 'error', message: `Research failed: ${msg}`, ...meta });
        results.push({ lead, status: 'error', error: `Research error: ${msg}` });
        continue;
      }

      // ── Step 3: Personalize ───────────────────────────────────────────────
      const hooksSpinner = ora('  Generating icebreaker hooks...').start();
      emit({ type: 'step_start', message: 'Generating 3 icebreaker hooks...', ...meta });
      try {
        const hooks = await generateHooks(
          input.prospect_name,
          input.role,
          input.company_name,
          {
            business_focus: lead.business_focus!,
            pain_points: lead.pain_points!,
            analysis_summary: lead.analysis_summary!,
          }
        );
        lead.generated_hooks = hooks;
        lead.analyzed_at = new Date().toISOString();
        hooksSpinner.succeed(chalk.green('  Hooks generated'));
        emit({ type: 'step_done', message: 'Icebreaker hooks generated', ...meta });
      } catch (err) {
        hooksSpinner.fail(chalk.red('  Hook generation failed'));
        const msg = err instanceof Error ? err.message : String(err);
        emit({ type: 'error', message: `Hook generation failed: ${msg}`, ...meta });
        results.push({ lead, status: 'error', error: `Personalizer error: ${msg}` });
        continue;
      }

      // ── Step 4: Store ─────────────────────────────────────────────────────
      upsertLead(lead);
      console.log(chalk.green(`  ✓ Lead saved: ${lead.id}`));
      emit({ type: 'lead_done', message: `Lead saved: ${lead.id}`, ...meta, data: lead });

      results.push({ lead, status: 'success' });

      // Human-like delay between leads (skip after last one)
      if (i < inputs.length - 1) {
        emit({ type: 'info', message: 'Waiting before next lead (stealth delay)...', ...meta });
        await randomDelay(INTER_LEAD_DELAY_MS.min, INTER_LEAD_DELAY_MS.max);
      }
    }
  } finally {
    if (!options.skipScrape) {
      await scraper.close();
    }
  }

  emit({ type: 'complete', message: `Pipeline complete. ${results.filter(r => r.status === 'success').length}/${inputs.length} leads enriched.`, data: results });
  return results;
}
