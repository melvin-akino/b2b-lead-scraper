/**
 * server/settings.ts
 *
 * Manages persistent app configuration stored in data/settings.json.
 * On server start, settings are loaded and ANTHROPIC_API_KEY is injected
 * into process.env so the existing pipeline modules pick it up automatically.
 */

import * as fs from 'fs';
import * as path from 'path';

const SETTINGS_PATH = path.resolve(__dirname, '../data/settings.json');

export interface AppSettings {
  apiKey: string;
  headless: boolean;
}

const defaults: AppSettings = {
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
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
    return { ...defaults, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  ensureDataDir();
  const current = loadSettings();
  const updated = { ...current, ...partial };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  // Keep process.env in sync so the pipeline modules see the new key immediately
  if (updated.apiKey) process.env.ANTHROPIC_API_KEY = updated.apiKey;
  process.env.SCRAPE_HEADLESS = String(updated.headless);
  return updated;
}

/** Called once at server startup to sync env from persisted settings. */
export function initSettings(): void {
  const s = loadSettings();
  if (s.apiKey) process.env.ANTHROPIC_API_KEY = s.apiKey;
  process.env.SCRAPE_HEADLESS = String(s.headless);
}
