/**
 * store.ts
 *
 * A lightweight JSON flat-file data store for leads.
 *
 * All leads are persisted to data/leads.json. The store supports:
 *   - Upserting a lead by ID (insert or update in place)
 *   - Reading all leads
 *   - Finding a lead by ID
 *   - Clearing all leads (useful for fresh runs)
 *
 * Designed for Phase 1 simplicity. To scale up, swap the implementation
 * for a Prisma + SQLite/PostgreSQL backend without changing the public API.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Lead } from './schema';

const DATA_DIR = path.resolve(__dirname, '../data');
const STORE_PATH = path.join(DATA_DIR, 'leads.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Lead[] {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) return [];
  const raw = fs.readFileSync(STORE_PATH, 'utf-8').trim();
  if (!raw) return [];
  return JSON.parse(raw) as Lead[];
}

function writeStore(leads: Lead[]): void {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(leads, null, 2), 'utf-8');
}

/**
 * Insert a new lead or update an existing one (matched by id).
 */
export function upsertLead(lead: Lead): void {
  const leads = readStore();
  const idx = leads.findIndex((l) => l.id === lead.id);
  if (idx === -1) {
    leads.push(lead);
  } else {
    leads[idx] = { ...leads[idx], ...lead };
  }
  writeStore(leads);
}

/**
 * Return all stored leads.
 */
export function getAllLeads(): Lead[] {
  return readStore();
}

/**
 * Find a single lead by its ID. Returns undefined if not found.
 */
export function getLeadById(id: string): Lead | undefined {
  return readStore().find((l) => l.id === id);
}

/**
 * Remove all leads from the store. Useful for starting a fresh campaign.
 */
export function clearAllLeads(): void {
  writeStore([]);
}

/**
 * Returns the total number of stored leads.
 */
export function countLeads(): number {
  return readStore().length;
}
