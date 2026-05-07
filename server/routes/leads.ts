/**
 * server/routes/leads.ts
 *
 * POST   /api/leads/scrape      Run pipeline; streams Server-Sent Events back
 * GET    /api/leads             Return all stored leads
 * DELETE /api/leads             Clear all leads
 * DELETE /api/leads/:id         Delete one lead by ID
 * GET    /api/leads/export      Download enriched leads as CSV
 */

import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

import { runPipeline } from '../../src/pipeline';
import { getAllLeads, clearAllLeads, upsertLead } from '../../src/store';
import { exportToCSV } from '../../src/exporter';
import { LeadInputSchema } from '../../src/schema';
import { loadSettings, getActiveProviderConfig } from '../settings';

const router = Router();

// ── POST /scrape — full pipeline with SSE progress stream ────────────────────

router.post('/scrape', async (req: Request, res: Response) => {
  const settings = loadSettings();
  const providerConfig = getActiveProviderConfig();

  // Ollama doesn't need a key; all others do
  if (providerConfig.name !== 'ollama' && !providerConfig.apiKey) {
    return res.status(400).json({ error: `No API key set for ${settings.provider}. Go to Settings first.` });
  }

  const rawInputs: unknown[] = Array.isArray(req.body.inputs) ? req.body.inputs : [req.body.input].filter(Boolean);
  const context: string | undefined = req.body.context;

  const inputs = rawInputs.map((item, i) => {
    const parsed = LeadInputSchema.safeParse(item);
    if (!parsed.success) throw new Error(`Invalid lead at index ${i}: ${JSON.stringify(parsed.error.format())}`);
    return parsed.data;
  });

  // Switch to SSE mode
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    (res as unknown as { flush?: () => void }).flush?.();
  };

  try {
    await runPipeline(inputs, {
      searchContext: context,
      providerConfig,
      onProgress: (event) => send(event),
    });
  } catch (err) {
    send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }

  res.end();
});

// ── GET / — list all leads ───────────────────────────────────────────────────

router.get('/', (_req: Request, res: Response) => {
  res.json(getAllLeads());
});

// ── DELETE / — clear all leads ───────────────────────────────────────────────

router.delete('/', (_req: Request, res: Response) => {
  clearAllLeads();
  res.json({ success: true });
});

// ── DELETE /:id — delete one lead ────────────────────────────────────────────

router.delete('/:id', (req: Request, res: Response) => {
  const leads = getAllLeads().filter((l) => l.id !== req.params.id);
  // Re-write store manually (store doesn't expose deleteById, add here)
  const dataPath = path.resolve(__dirname, '../../data/leads.json');
  fs.writeFileSync(dataPath, JSON.stringify(leads, null, 2), 'utf-8');
  res.json({ success: true });
});

// ── GET /export — CSV download ───────────────────────────────────────────────

router.get('/export', async (_req: Request, res: Response) => {
  const leads = getAllLeads();
  if (!leads.length) return res.status(404).json({ error: 'No leads to export.' });
  const csvPath = await exportToCSV(leads);
  res.download(csvPath, path.basename(csvPath));
});

export default router;
