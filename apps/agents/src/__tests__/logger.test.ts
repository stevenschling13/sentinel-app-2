import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../logger.js';

describe('Logger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  describe('info()', () => {
    it('writes JSON to stdout', () => {
      logger.info('test.event');

      expect(stdoutSpy).toHaveBeenCalledOnce();
      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output.trim());
      expect(parsed.level).toBe('info');
      expect(parsed.event).toBe('test.event');
    });

    it('includes timestamp', () => {
      logger.info('test.event');

      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output.trim());
      expect(parsed.ts).toBeDefined();
      expect(() => new Date(parsed.ts)).not.toThrow();
    });

    it('includes metadata fields', () => {
      logger.info('test.event', { userId: 'abc', count: 42 });

      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output.trim());
      expect(parsed.userId).toBe('abc');
      expect(parsed.count).toBe(42);
    });

    it('outputs one JSON line ending with newline', () => {
      logger.info('test.event');

      const output = stdoutSpy.mock.calls[0][0] as string;
      expect(output.endsWith('\n')).toBe(true);
      // Should be a single line
      expect(output.trim().split('\n')).toHaveLength(1);
    });
  });

  describe('debug()', () => {
    it('writes to stdout with debug level', () => {
      logger.debug('debug.event', { detail: 'verbose' });

      expect(stdoutSpy).toHaveBeenCalledOnce();
      const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
      expect(parsed.level).toBe('debug');
      expect(parsed.event).toBe('debug.event');
      expect(parsed.detail).toBe('verbose');
    });
  });

  describe('warn()', () => {
    it('writes to stderr with warn level', () => {
      logger.warn('warn.event', { risk: 'high' });

      expect(stderrSpy).toHaveBeenCalledOnce();
      expect(stdoutSpy).not.toHaveBeenCalled();
      const parsed = JSON.parse((stderrSpy.mock.calls[0][0] as string).trim());
      expect(parsed.level).toBe('warn');
      expect(parsed.event).toBe('warn.event');
      expect(parsed.risk).toBe('high');
    });
  });

  describe('error()', () => {
    it('writes to stderr with error level', () => {
      logger.error('error.event', { message: 'something broke' });

      expect(stderrSpy).toHaveBeenCalledOnce();
      expect(stdoutSpy).not.toHaveBeenCalled();
      const parsed = JSON.parse((stderrSpy.mock.calls[0][0] as string).trim());
      expect(parsed.level).toBe('error');
      expect(parsed.event).toBe('error.event');
      expect(parsed.message).toBe('something broke');
    });
  });

  describe('structured output', () => {
    it('produces valid JSON for all log levels', () => {
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      const stdoutCalls = stdoutSpy.mock.calls.map((c) => c[0] as string);
      const stderrCalls = stderrSpy.mock.calls.map((c) => c[0] as string);
      const allCalls = [...stdoutCalls, ...stderrCalls];

      for (const line of allCalls) {
        expect(() => JSON.parse(line.trim())).not.toThrow();
      }
    });

    it('handles no metadata gracefully', () => {
      logger.info('no.meta');

      const output = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output.trim());
      expect(parsed.level).toBe('info');
      expect(parsed.event).toBe('no.meta');
      expect(parsed.ts).toBeDefined();
    });
  });
});
