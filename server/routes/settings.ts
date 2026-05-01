/**
 * server/routes/settings.ts
 *
 * GET  /api/settings        — return current settings (API key masked)
 * POST /api/settings        — save new settings
 * POST /api/settings/test   — test the configured API key against Claude
 */

import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { loadSettings, saveSettings } from '../settings';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const s = loadSettings();
  res.json({
    apiKey: s.apiKey ? `sk-ant-...${s.apiKey.slice(-6)}` : '',
    apiKeySet: Boolean(s.apiKey),
    headless: s.headless,
  });
});

router.post('/', (req: Request, res: Response) => {
  const { apiKey, headless } = req.body as { apiKey?: string; headless?: boolean };
  const updated = saveSettings({
    ...(apiKey !== undefined && { apiKey }),
    ...(headless !== undefined && { headless }),
  });
  res.json({ success: true, apiKeySet: Boolean(updated.apiKey), headless: updated.headless });
});

router.post('/test', async (_req: Request, res: Response) => {
  const { apiKey } = loadSettings();
  if (!apiKey) {
    return res.status(400).json({ success: false, error: 'No API key configured.' });
  }
  try {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'hi' }],
    });
    res.json({ success: true, message: 'API key is valid.' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ success: false, error: msg });
  }
});

export default router;
