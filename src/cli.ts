#!/usr/bin/env ts-node
/**
 * cli.ts
 *
 * Command-line interface for the lead generation pipeline.
 *
 * ── Commands ──────────────────────────────────────────────────────────────
 *
 *   scrape    Run the full pipeline for one lead or a batch from a JSON file.
 *   export    Export all stored leads (or a subset) to CSV.
 *   list      Print a summary table of all stored leads.
 *   clear     Wipe the leads store.
 *
 * ── Examples ──────────────────────────────────────────────────────────────
 *
 *   # Single lead
 *   npx ts-node src/cli.ts scrape \
 *     --name "Maria Santos" \
 *     --role "CEO" \
 *     --company "Kumu" \
 *     --website "https://www.kumu.live" \
 *     --linkedin "https://www.linkedin.com/company/kumu-ph"
 *
 *   # Batch from JSON file
 *   npx ts-node src/cli.ts scrape --file leads-input.json --context "SaaS Founders in Manila"
 *
 *   # Export stored leads to CSV
 *   npx ts-node src/cli.ts export
 *
 *   # List stored leads
 *   npx ts-node src/cli.ts list
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

import { runPipeline } from './pipeline';
import { exportToCSV } from './exporter';
import { getAllLeads, clearAllLeads, countLeads } from './store';
import { LeadInput, LeadInputSchema } from './schema';

const program = new Command();

program
  .name('leads')
  .description('High-Precision Lead Scraper & Researcher powered by Playwright + Claude AI')
  .version('1.0.0');

// ── scrape ─────────────────────────────────────────────────────────────────

program
  .command('scrape')
  .description('Run the full pipeline: Scrape → Research → Personalize → Store')
  .option('-n, --name <name>',        'Prospect full name')
  .option('-r, --role <role>',        'Prospect role / title')
  .option('-c, --company <company>',  'Company name')
  .option('-w, --website <url>',      'Company website URL')
  .option('-l, --linkedin <url>',     'LinkedIn URL (company or person page, optional)')
  .option('-f, --file <path>',        'Path to a JSON file containing an array of lead inputs')
  .option('-q, --context <query>',    'Search context to guide AI analysis (e.g. "SaaS founders in Manila")')
  .option('--no-export',              'Skip auto-exporting to CSV after the run')
  .action(async (opts) => {
    let inputs: LeadInput[] = [];

    if (opts.file) {
      // ── Batch mode ────────────────────────────────────────────────────
      const filePath = path.resolve(opts.file);
      if (!fs.existsSync(filePath)) {
        console.error(chalk.red(`File not found: ${filePath}`));
        process.exit(1);
      }
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown[];
      inputs = raw.map((item, i) => {
        const parsed = LeadInputSchema.safeParse(item);
        if (!parsed.success) {
          console.error(chalk.red(`Invalid lead at index ${i}:`), parsed.error.format());
          process.exit(1);
        }
        return parsed.data;
      });
      console.log(chalk.cyan(`Loaded ${inputs.length} leads from ${opts.file}`));
    } else {
      // ── Single lead mode ──────────────────────────────────────────────
      const parsed = LeadInputSchema.safeParse({
        prospect_name: opts.name,
        role:          opts.role,
        company_name:  opts.company,
        website_url:   opts.website,
        linkedin_url:  opts.linkedin,
      });
      if (!parsed.success) {
        console.error(chalk.red('Missing or invalid fields:'), parsed.error.format());
        console.error(chalk.yellow('Required: --name, --role, --company, --website'));
        process.exit(1);
      }
      inputs = [parsed.data];
    }

    console.log(chalk.bold.cyan('\n═══════════════════════════════════════'));
    console.log(chalk.bold.cyan('  Lead Generation Pipeline Starting'));
    console.log(chalk.bold.cyan('═══════════════════════════════════════\n'));

    const results = await runPipeline(inputs, { searchContext: opts.context });

    const succeeded = results.filter((r) => r.status === 'success');
    const failed    = results.filter((r) => r.status === 'error');

    console.log(chalk.bold('\n── Pipeline Complete ──────────────────'));
    console.log(chalk.green(`  ✓ Succeeded: ${succeeded.length}`));
    if (failed.length > 0) {
      console.log(chalk.red(`  ✗ Failed:    ${failed.length}`));
      failed.forEach((r) => console.log(chalk.red(`    • ${r.lead.prospect_name}: ${r.error}`)));
    }

    if (opts.export !== false && succeeded.length > 0) {
      const csvPath = await exportToCSV(succeeded.map((r) => r.lead));
      console.log(chalk.bold.green(`\n  CSV exported → ${csvPath}`));
    }

    console.log(chalk.bold('───────────────────────────────────────\n'));
  });

// ── export ─────────────────────────────────────────────────────────────────

program
  .command('export')
  .description('Export all stored leads to a timestamped CSV file')
  .action(async () => {
    const leads = getAllLeads();
    if (leads.length === 0) {
      console.log(chalk.yellow('No leads in store. Run `scrape` first.'));
      return;
    }
    const csvPath = await exportToCSV(leads);
    console.log(chalk.green(`✓ Exported ${leads.length} leads → ${csvPath}`));
  });

// ── list ───────────────────────────────────────────────────────────────────

program
  .command('list')
  .description('Print a summary of all stored leads')
  .action(() => {
    const leads = getAllLeads();
    if (leads.length === 0) {
      console.log(chalk.yellow('No leads stored yet.'));
      return;
    }
    console.log(chalk.bold(`\nStored leads (${leads.length}):\n`));
    leads.forEach((lead, i) => {
      console.log(`${chalk.cyan(String(i + 1).padStart(3))}. ${chalk.bold(lead.prospect_name)} — ${lead.role} @ ${lead.company_name}`);
      console.log(`     ${chalk.dim(lead.website_url)}`);
      if (lead.analysis_summary) {
        console.log(`     ${chalk.italic(lead.analysis_summary.slice(0, 100))}…`);
      }
      console.log();
    });
  });

// ── clear ──────────────────────────────────────────────────────────────────

program
  .command('clear')
  .description('Delete all leads from the store')
  .action(() => {
    const count = countLeads();
    clearAllLeads();
    console.log(chalk.yellow(`Cleared ${count} leads from store.`));
  });

program.parse(process.argv);
