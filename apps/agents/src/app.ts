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
app.get('/health', async (_req, res) => {
  const missing = getMissingAgentEnvVars();

  // Quick engine connectivity check
  let engineStatus = 'unknown';
  try {
    const engineUrl = process.env.ENGINE_URL ?? 'http://localhost:8000';
    const engineRes = await fetch(`${engineUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    engineStatus = engineRes.ok ? 'ok' : 'degraded';
  } catch {
    engineStatus = 'unreachable';
  }

  res.json({
    status: missing.length === 0 ? 'ok' : 'degraded',
    service: 'sentinel-agents',
    engine: engineStatus,
    orchestrator: {
      halted: orchestrator.currentState.halted,
      cycleCount: orchestrator.currentState.cycleCount,
    },
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

// ── Recommendation approval ─────────────────────────────────
app.post('/recommendations/:id/approve', async (req, res) => {
  try {
    const { atomicApprove } = await import('./recommendations-store.js');
    const rec = await atomicApprove(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found or already reviewed' });

    // If auto-execute is on, trigger execution immediately
    if (process.env.AUTO_EXECUTE === 'true') {
      const { ExecutionPipeline } = await import('./execution-pipeline.js');
      const pipeline = new ExecutionPipeline();
      pipeline.executeRecommendation(rec.id).catch((err) => {
        logger.error('execution.auto.failed', { id: rec.id, error: String(err) });
      });
    }

    res.json({ recommendation: rec });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('route.approve.error', { error: message });
    res.status(500).json({ error: message });
  }
});

app.post('/recommendations/:id/reject', async (req, res) => {
  try {
    const { rejectRecommendation } = await import('./recommendations-store.js');
    const rec = await rejectRecommendation(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found or already reviewed' });
    res.json({ recommendation: rec });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('route.reject.error', { error: message });
    res.status(500).json({ error: message });
  }
});

app.post('/recommendations/:id/execute', async (req, res) => {
  try {
    const { ExecutionPipeline } = await import('./execution-pipeline.js');
    const pipeline = new ExecutionPipeline();
    const result = await pipeline.executeRecommendation(req.params.id);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('route.execute.error', { error: message });
    res.status(500).json({ error: message });
  }
});

// ── Execution config ────────────────────────────────────────
app.get('/execution/config', async (_req, res) => {
  try {
    const { ExecutionPipeline } = await import('./execution-pipeline.js');
    const pipeline = new ExecutionPipeline();
    res.json(pipeline.currentConfig);
  } catch {
    res.json({
      autoExecute: process.env.AUTO_EXECUTE === 'true',
      maxOrdersPerCycle: Number(process.env.MAX_ORDERS_PER_CYCLE) || 3,
      maxOrderValue: Number(process.env.MAX_ORDER_VALUE) || 5000,
      tradingMode: process.env.TRADING_MODE || 'paper',
    });
  }
});
