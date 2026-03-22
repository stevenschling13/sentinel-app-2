/**
 * Structured JSON logger for the agents service.
 * Outputs one JSON object per line for log aggregators.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function emit(level: LogLevel, event: string, meta?: Record<string, unknown>): void {
  const entry = { level, event, ts: new Date().toISOString(), ...meta };
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  debug: (event: string, meta?: Record<string, unknown>) => emit('debug', event, meta),
  info: (event: string, meta?: Record<string, unknown>) => emit('info', event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => emit('warn', event, meta),
  error: (event: string, meta?: Record<string, unknown>) => emit('error', event, meta),
};
