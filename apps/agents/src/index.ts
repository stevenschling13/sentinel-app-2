import 'dotenv/config';
import { app, orchestrator } from './app.js';
import { getMissingAgentEnvVars } from './env.js';

const PORT = parseInt(process.env.AGENTS_PORT || process.env.PORT || '3001', 10);

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const missing = getMissingAgentEnvVars();
  console.log(`Sentinel Agents listening on port ${PORT}`);
  if (missing.length > 0) {
    console.warn(`⚠ Missing env vars: ${missing.join(', ')} — agents will run in degraded mode`);
  }

  if (process.env.AUTO_CYCLE === 'true') {
    orchestrator.start();
    console.log('Auto-cycle enabled — orchestrator started');
  }
});

// ── Graceful shutdown ───────────────────────────────────────
function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down…`);
  orchestrator.stop();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
