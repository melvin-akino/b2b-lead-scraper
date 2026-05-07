/**
 * server/settings.ts
 *
 * Manages persistent app configuration stored in data/settings.json.
 *
 * Stores:
 *   - provider          — active AI provider name
 *   - providerKeys      — API key per provider (keyed by provider name)
 *   - providerModels    — selected model per provider
 *   - ollamaUrl         — base URL for Ollama (default: http://localhost:11434)
 *   - headless          — whether Playwright runs headlessly
 *
 * On server start, settings are loaded and ANTHROPIC_API_KEY is injected into
 * process.env so any legacy code that reads env vars still works.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProviderName, ProviderConfig, DEFAULT_MODELS } from '../src/ai-provider';

const SETTINGS_PATH = path.resolve(__dirname, '../data/settings.json');

export interface AppSettings {
  provider: ProviderName;
  providerKeys: Partial<Record<ProviderName, string>>;
  providerModels: Partial<Record<ProviderName, string>>;
  ollamaUrl: string;
  headless: boolean;
}

const defaults: AppSettings = {
  provider: 'anthropic',
  providerKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY ?? '',
  },
  providerModels: {},
  ollamaUrl: 'http://localhost:11434',
  headless: true,
};

function ensureDataDir(): void {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadSettings(): AppSettings {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_PATH)) return { ...defaults };
  try {
    const saved = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) as Partial<AppSettings>;
    return {
      ...defaults,
      ...saved,
      providerKeys: { ...defaults.providerKeys, ...(saved.providerKeys ?? {}) },
      providerModels: { ...defaults.providerModels, ...(saved.providerModels ?? {}) },
    };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  ensureDataDir();
  const current = loadSettings();

  // Deep-merge providerKeys and providerModels instead of overwriting
  const updated: AppSettings = {
    ...current,
    ...partial,
    providerKeys: {
      ...current.providerKeys,
      ...(partial.providerKeys ?? {}),
    },
    providerModels: {
      ...current.providerModels,
      ...(partial.providerModels ?? {}),
    },
  };

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), 'utf-8');

  // Keep process.env in sync for legacy code
  const anthropicKey = updated.providerKeys.anthropic;
  if (anthropicKey) process.env.ANTHROPIC_API_KEY = anthropicKey;
  process.env.SCRAPE_HEADLESS = String(updated.headless);

  return updated;
}

/** Returns a ProviderConfig suitable for passing to createProvider(). */
export function getActiveProviderConfig(): ProviderConfig {
  const s = loadSettings();
  return {
    name: s.provider,
    apiKey: s.providerKeys[s.provider] ?? '',
    model: s.providerModels[s.provider] ?? DEFAULT_MODELS[s.provider],
    baseUrl: s.provider === 'ollama' ? s.ollamaUrl : undefined,
  };
}

/** Called once at server startup to sync env from persisted settings. */
export function initSettings(): void {
  const s = loadSettings();
  const anthropicKey = s.providerKeys.anthropic;
  if (anthropicKey) process.env.ANTHROPIC_API_KEY = anthropicKey;
  process.env.SCRAPE_HEADLESS = String(s.headless);
}
