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

export interface PipelineOptions {
  /** If true, skip scraping and re-use existing raw_scraped_content from the store. */
  skipScrape?: boolean;
  /** Extra context string passed to the researcher (e.g. the original search query). */
  searchContext?: string;
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

  if (!options.skipScrape) {
    await scraper.init();
  }

  try {
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const label = `${input.prospect_name} @ ${input.company_name}`;

      console.log(chalk.cyan(`\n[${i + 1}/${inputs.length}] Processing: ${label}`));

      const lead: Lead = {
        id: nanoid(),
        ...input,
        scraped_at: undefined,
        analyzed_at: undefined,
      };

      // ── Step 1: Scrape ────────────────────────────────────────────────────
      if (!options.skipScrape) {
        const scrapeSpinner = ora('  Scraping website...').start();
        try {
          const scraped = await scraper.scrapeAll(input.website_url, input.linkedin_url);
          lead.raw_scraped_content = scraped.text;
          lead.scraped_at = new Date().toISOString();
          scrapeSpinner.succeed(chalk.green('  Scraped successfully'));
        } catch (err) {
          scrapeSpinner.fail(chalk.red('  Scrape failed'));
          const msg = err instanceof Error ? err.message : String(err);
          results.push({ lead, status: 'error', error: `Scrape error: ${msg}` });
          continue;
        }
      }

      if (!lead.raw_scraped_content) {
        results.push({ lead, status: 'error', error: 'No scraped content available.' });
        continue;
      }

      // ── Step 2: Research ─────────────────────────────────────────────────
      const researchSpinner = ora('  Analyzing with Claude...').start();
      try {
        const research = await researchLead(lead.raw_scraped_content, options.searchContext);
        lead.business_focus = research.business_focus;
        lead.pain_points = research.pain_points;
        lead.analysis_summary = research.analysis_summary;
        researchSpinner.succeed(chalk.green('  Research complete'));
      } catch (err) {
        researchSpinner.fail(chalk.red('  Research failed'));
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ lead, status: 'error', error: `Research error: ${msg}` });
        continue;
      }

      // ── Step 3: Personalize ───────────────────────────────────────────────
      const hooksSpinner = ora('  Generating icebreaker hooks...').start();
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
      } catch (err) {
        hooksSpinner.fail(chalk.red('  Hook generation failed'));
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ lead, status: 'error', error: `Personalizer error: ${msg}` });
        continue;
      }

      // ── Step 4: Store ─────────────────────────────────────────────────────
      upsertLead(lead);
      console.log(chalk.green(`  ✓ Lead saved: ${lead.id}`));

      results.push({ lead, status: 'success' });

      // Human-like delay between leads (skip after last one)
      if (i < inputs.length - 1) {
        await randomDelay(INTER_LEAD_DELAY_MS.min, INTER_LEAD_DELAY_MS.max);
      }
    }
  } finally {
    if (!options.skipScrape) {
      await scraper.close();
    }
  }

  return results;
}
