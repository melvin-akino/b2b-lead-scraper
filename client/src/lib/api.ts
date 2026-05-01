/**
 * client/src/lib/api.ts
 *
 * Typed wrappers around all Express API endpoints.
 * The scrape() function returns an AsyncGenerator that yields
 * ProgressEvents as they arrive over the SSE stream.
 */

export interface Lead {
  id: string;
  company_name: string;
  prospect_name: string;
  role: string;
  website_url: string;
  linkedin_url?: string;
  raw_scraped_content?: string;
  analysis_summary?: string;
  pain_points?: string[];
  business_focus?: string;
  generated_hooks?: string[];
  scraped_at?: string;
  analyzed_at?: string;
}

export interface LeadInput {
  company_name: string;
  prospect_name: string;
  role: string;
  website_url: string;
  linkedin_url?: string;
}

export interface ProgressEvent {
  type: 'info' | 'success' | 'error' | 'step_start' | 'step_done' | 'lead_start' | 'lead_done' | 'complete';
  message: string;
  leadIndex?: number;
  leadName?: string;
  data?: unknown;
}

export interface Settings {
  apiKey: string;
  apiKeySet: boolean;
  headless: boolean;
}

const BASE = '/api';

// ── Leads ────────────────────────────────────────────────────────────────────

export async function fetchLeads(): Promise<Lead[]> {
  const res = await fetch(`${BASE}/leads`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteLead(id: string): Promise<void> {
  await fetch(`${BASE}/leads/${id}`, { method: 'DELETE' });
}

export async function clearLeads(): Promise<void> {
  await fetch(`${BASE}/leads`, { method: 'DELETE' });
}

export function exportLeadsUrl(): string {
  return `${BASE}/leads/export`;
}

/**
 * Streams SSE progress events from the scrape pipeline.
 * Usage:
 *   for await (const event of scrape({ inputs, context })) { ... }
 */
export async function* scrape(payload: {
  inputs: LeadInput[];
  context?: string;
}): AsyncGenerator<ProgressEvent> {
  const response = await fetch(`${BASE}/leads/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error ?? 'Scrape request failed');
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6)) as ProgressEvent;
        } catch { /* skip malformed */ }
      }
    }
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function fetchSettings(): Promise<Settings> {
  const res = await fetch(`${BASE}/settings`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveSettings(data: { apiKey?: string; headless?: boolean }): Promise<void> {
  const res = await fetch(`${BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function testApiKey(): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await fetch(`${BASE}/settings/test`, { method: 'POST' });
  return res.json();
}
