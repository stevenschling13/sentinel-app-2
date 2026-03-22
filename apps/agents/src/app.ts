import express, { type Express } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { getMissingAgentEnvVars } from './env.js';
import { Orchestrator } from './orchestrator.js';
import { listAlerts } from './recommendations-store.js';
import { listRecommendations } from './recommendations-store.js';
import { logger } from './logger.js';

export const app: Express = express();
export const orchestrator = new Orchestrator();

app.use(cors({ origin: process.env.WEB_URL || 'http://localhost:3000' }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1_000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

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
  try {
    const agents = orchestrator.getAgentInfo();
    res.json({ agents });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('route.agents.error', { error: message });
    res.status(500).json({ error: message });
  }
});

// ── Recent alerts from agents ───────────────────────────────
app.get('/alerts', async (_req, res) => {
  try {
    const alerts = await listAlerts(50);
    res.json({ alerts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('route.alerts.error', { error: message });
    res.json({ alerts: [] });
  }
});

// ── Trigger a manual agent cycle ────────────────────────────
app.post('/cycle', (_req, res) => {
  try {
    const { cycleCount } = orchestrator.currentState;
    orchestrator.runCycle().catch((err) => {
      logger.error('route.cycle.background', { error: String(err) });
    });
    res.json({ status: 'triggered', cycleCount: cycleCount + 1 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('route.cycle.error', { error: message });
    res.status(500).json({ error: message });
  }
});

// ── Poll cycle progress ─────────────────────────────────────
app.get('/cycle/status', (_req, res) => {
  try {
    res.json(orchestrator.currentState);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('route.cycle-status.error', { error: message });
    res.status(500).json({ error: message });
  }
});

// ── Halt orchestrator ───────────────────────────────────────
app.post('/halt', (req, res) => {
  try {
    const reason = req.body?.reason ?? 'Manual halt';
    orchestrator.halt(reason);
    res.json({ halted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('route.halt.error', { error: message });
    res.status(500).json({ error: message });
  }
});

// ── Resume orchestrator ─────────────────────────────────────
app.post('/resume', (_req, res) => {
  try {
    orchestrator.resume();
    res.json({ halted: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('route.resume.error', { error: message });
    res.status(500).json({ error: message });
  }
});

// ── Recommendations ─────────────────────────────────────────
app.get('/recommendations', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const recommendations = await listRecommendations(status);
    res.json({ recommendations });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('route.recommendations.error', { error: message });
    res.json({ recommendations: [] });
  }
});
