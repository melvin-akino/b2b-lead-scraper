/**
 * server/index.ts
 *
 * Express application entry point.
 *
 * - Loads persisted settings (API key, headless flag) into process.env on startup.
 * - Serves the compiled React frontend from client/dist/ in production.
 * - Mounts the /api routes for leads and settings management.
 * - Exposes a /api/health endpoint for Docker health checks.
 */

import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as dotenv from 'dotenv';

import { initSettings } from './settings';
import leadsRouter from './routes/leads';
import settingsRouter from './routes/settings';

dotenv.config();
initSettings(); // sync env from data/settings.json before anything else runs

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

// ── API routes ───────────────────────────────────────────────────────────────
app.use('/api/leads', leadsRouter);
app.use('/api/settings', settingsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Serve React frontend ─────────────────────────────────────────────────────
const clientDist = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDist));

// SPA fallback — all non-API routes serve index.html
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Lead Scraper UI  →  http://localhost:${PORT}`);
  console.log(`  API health       →  http://localhost:${PORT}/api/health\n`);
});
