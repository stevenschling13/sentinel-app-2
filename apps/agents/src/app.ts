import express, { type Express } from 'express';
import cors from 'cors';
import { getMissingAgentEnvVars } from './env.js';

export const app: Express = express();

app.use(cors({ origin: process.env.WEB_URL || 'http://localhost:3000' }));
app.use(express.json());

// ── Health ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const missing = getMissingAgentEnvVars();
  res.json({
    status: missing.length === 0 ? 'ok' : 'degraded',
    service: 'sentinel-agents',
    missing: missing.length > 0 ? missing : undefined,
  });
});

// ── Agent status ────────────────────────────────────────────
app.get('/agents', (_req, res) => {
  res.json({
    agents: [
      { name: 'Market Sentinel', status: 'idle' },
      { name: 'Strategy Analyst', status: 'idle' },
      { name: 'Risk Monitor', status: 'idle' },
    ],
  });
});

// ── Recent alerts from agents ───────────────────────────────
app.get('/alerts', (_req, res) => {
  res.json({ alerts: [] });
});

// ── Trigger a manual agent cycle ────────────────────────────
app.post('/cycle', async (_req, res) => {
  // Placeholder — orchestrator integration comes next
  res.json({ status: 'triggered', message: 'Agent cycle queued' });
});
