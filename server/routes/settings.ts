/**
 * server/routes/settings.ts
 *
 * GET  /api/settings         — return current settings (keys masked)
 * POST /api/settings         — save partial settings update
 * POST /api/settings/test    — test the active provider's key/connection
 * GET  /api/settings/models  — return provider model lists for the UI
 */

import { Router, Request, Response } from 'express';
import { loadSettings, saveSettings } from '../settings';
import { createProvider, PROVIDER_MODELS, ProviderName, DEFAULT_MODELS } from '../../src/ai-provider';

const router = Router();

const PROVIDERS: { value: ProviderName; label: string; free: boolean; requiresKey: boolean }[] = [
  { value: 'anthropic',   label: 'Anthropic (Claude)',  free: false, requiresKey: true },
  { value: 'groq',        label: 'Groq',                free: true,  requiresKey: true },
  { value: 'gemini',      label: 'Google Gemini',        free: true,  requiresKey: true },
  { value: 'ollama',      label: 'Ollama (Local)',        free: true,  requiresKey: false },
  { value: 'openrouter',  label: 'OpenRouter',           free: true,  requiresKey: true },
];

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', (_req: Request, res: Response) => {
  const s = loadSettings();

  // Mask API keys — show last 6 chars only
  const maskedKeys: Partial<Record<ProviderName, string>> = {};
  for (const [k, v] of Object.entries(s.providerKeys)) {
    maskedKeys[k as ProviderName] = v ? `••••${v.slice(-6)}` : '';
  }

  res.json({
    provider:       s.provider,
    providerKeys:   maskedKeys,
    providerModels: s.providerModels,
    ollamaUrl:      s.ollamaUrl,
    headless:       s.headless,
    providers:      PROVIDERS,
    defaultModels:  DEFAULT_MODELS,
  });
});

// ── POST / ────────────────────────────────────────────────────────────────────

router.post('/', (req: Request, res: Response) => {
  const { provider, providerKey, model, ollamaUrl, headless } = req.body as {
    provider?: ProviderName;
    providerKey?: string;  // key for the provider being saved
    model?: string;
    ollamaUrl?: string;
    headless?: boolean;
  };

  const current = loadSettings();
  const targetProvider = provider ?? current.provider;

  const updated = saveSettings({
    ...(provider   !== undefined && { provider }),
    ...(ollamaUrl  !== undefined && { ollamaUrl }),
    ...(headless   !== undefined && { headless }),
    ...(providerKey !== undefined && providerKey !== '' && {
      providerKeys: { [targetProvider]: providerKey },
    }),
    ...(model !== undefined && {
      providerModels: { [targetProvider]: model },
    }),
  });

  res.json({ success: true, provider: updated.provider, headless: updated.headless });
});

// ── POST /test ────────────────────────────────────────────────────────────────

router.post('/test', async (_req: Request, res: Response) => {
  const s = loadSettings();
  const key   = s.providerKeys[s.provider] ?? '';
  const model = s.providerModels[s.provider] ?? DEFAULT_MODELS[s.provider];

  // Ollama doesn't need a key — just a reachable URL
  if (s.provider !== 'ollama' && !key) {
    return res.status(400).json({ success: false, error: `No API key set for ${s.provider}.` });
  }

  try {
    const provider = createProvider({
      name:    s.provider,
      apiKey:  key,
      model,
      baseUrl: s.provider === 'ollama' ? s.ollamaUrl : undefined,
    });

    const result = await provider.complete(
      'You are a helpful assistant.',
      'Reply with exactly: {"ok":true}',
      20
    );

    // As long as we got a non-empty response, consider the connection good
    if (result.trim()) {
      res.json({ success: true, message: `Connected to ${s.provider} (${model}) successfully.` });
    } else {
      res.status(500).json({ success: false, error: 'Provider returned an empty response.' });
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /models ───────────────────────────────────────────────────────────────

router.get('/models', (_req: Request, res: Response) => {
  res.json(PROVIDER_MODELS);
});

export default router;
