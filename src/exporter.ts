/**
 * exporter.ts
 *
 * Exports an array of enriched Lead objects to a CSV file.
 *
 * Output path: output/leads_<ISO-timestamp>.csv
 * The output/ directory is created automatically if it does not exist.
 *
 * Each CSV row contains all structured fields. The three generated hooks are
 * exported as separate columns (hook_1, hook_2, hook_3) for easy pasting into
 * a sequencer (e.g. Apollo, Instantly, Lemlist).
 */

import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import { Lead } from './schema';

const OUTPUT_DIR = path.resolve(
  process.env.OUTPUT_DIR ?? path.resolve(__dirname, '../output')
);

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function buildOutputPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(OUTPUT_DIR, `leads_${timestamp}.csv`);
}

/**
 * Writes an array of leads to a timestamped CSV file.
 *
 * @param leads   Array of enriched Lead objects to export.
 * @returns       Absolute path of the written CSV file.
 */
export async function exportToCSV(leads: Lead[]): Promise<string> {
  if (leads.length === 0) throw new Error('No leads to export.');

  ensureOutputDir();
  const outputPath = buildOutputPath();

  const writer = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'id',                   title: 'ID' },
      { id: 'company_name',         title: 'Company' },
      { id: 'prospect_name',        title: 'Prospect Name' },
      { id: 'role',                 title: 'Role' },
      { id: 'website_url',          title: 'Website' },
      { id: 'linkedin_url',         title: 'LinkedIn' },
      { id: 'business_focus',       title: 'Business Focus' },
      { id: 'pain_points',          title: 'Pain Points (pipe-separated)' },
      { id: 'analysis_summary',     title: 'Analysis Summary' },
      { id: 'hook_1',               title: 'Hook 1 (Pain-Point Led)' },
      { id: 'hook_2',               title: 'Hook 2 (Aspiration Led)' },
      { id: 'hook_3',               title: 'Hook 3 (Proof/Curiosity Led)' },
      { id: 'scraped_at',           title: 'Scraped At' },
      { id: 'analyzed_at',          title: 'Analyzed At' },
    ],
  });

  // Flatten array fields for CSV compatibility
  const rows = leads.map((lead) => ({
    ...lead,
    linkedin_url:   lead.linkedin_url ?? '',
    pain_points:    (lead.pain_points ?? []).join(' | '),
    hook_1:         lead.generated_hooks?.[0] ?? '',
    hook_2:         lead.generated_hooks?.[1] ?? '',
    hook_3:         lead.generated_hooks?.[2] ?? '',
    scraped_at:     lead.scraped_at ?? '',
    analyzed_at:    lead.analyzed_at ?? '',
  }));

  await writer.writeRecords(rows);
  return outputPath;
}
