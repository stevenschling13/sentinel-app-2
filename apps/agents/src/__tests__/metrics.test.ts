import { describe, it, expect, beforeEach } from 'vitest';
import { metrics } from '../metrics.js';

describe('MetricsCollector', () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe('inc() - counters', () => {
    it('increments a counter by 1 by default', () => {
      metrics.inc('requests');

      const snap = metrics.snapshot();
      expect(snap['counter.requests']).toBe(1);
    });

    it('increments a counter by custom amount', () => {
      metrics.inc('requests', 5);

      const snap = metrics.snapshot();
      expect(snap['counter.requests']).toBe(5);
    });

    it('accumulates multiple increments', () => {
      metrics.inc('requests');
      metrics.inc('requests');
      metrics.inc('requests', 3);

      const snap = metrics.snapshot();
      expect(snap['counter.requests']).toBe(5);
    });

    it('tracks multiple counters independently', () => {
      metrics.inc('requests', 10);
      metrics.inc('errors', 2);

      const snap = metrics.snapshot();
      expect(snap['counter.requests']).toBe(10);
      expect(snap['counter.errors']).toBe(2);
    });
  });

  describe('gauge() - gauges', () => {
    it('sets a gauge value', () => {
      metrics.gauge('cpu_usage', 0.75);

      const snap = metrics.snapshot();
      const entry = snap['gauge.cpu_usage'] as { value: number; updatedAt: string };
      expect(entry.value).toBe(0.75);
      expect(entry.updatedAt).toBeDefined();
    });

    it('overwrites previous gauge value', () => {
      metrics.gauge('cpu_usage', 0.5);
      metrics.gauge('cpu_usage', 0.9);

      const snap = metrics.snapshot();
      const entry = snap['gauge.cpu_usage'] as { value: number };
      expect(entry.value).toBe(0.9);
    });

    it('tracks multiple gauges independently', () => {
      metrics.gauge('cpu', 0.5);
      metrics.gauge('memory', 0.8);

      const snap = metrics.snapshot();
      expect((snap['gauge.cpu'] as any).value).toBe(0.5);
      expect((snap['gauge.memory'] as any).value).toBe(0.8);
    });

    it('records updatedAt timestamp', () => {
      metrics.gauge('test', 1);

      const snap = metrics.snapshot();
      const entry = snap['gauge.test'] as { updatedAt: string };
      const parsed = new Date(entry.updatedAt);
      expect(parsed.getTime()).toBeGreaterThan(0);
    });
  });

  describe('observe() - histograms', () => {
    it('records a single observation', () => {
      metrics.observe('request_duration', 100);

      const snap = metrics.snapshot();
      const hist = snap['histogram.request_duration'] as any;
      expect(hist.count).toBe(1);
      expect(hist.min).toBe(100);
      expect(hist.max).toBe(100);
      expect(hist.avg).toBe(100);
    });

    it('records multiple observations with correct stats', () => {
      metrics.observe('latency', 10);
      metrics.observe('latency', 20);
      metrics.observe('latency', 30);
      metrics.observe('latency', 40);
      metrics.observe('latency', 50);

      const snap = metrics.snapshot();
      const hist = snap['histogram.latency'] as any;
      expect(hist.count).toBe(5);
      expect(hist.min).toBe(10);
      expect(hist.max).toBe(50);
      expect(hist.avg).toBe(30);
    });

    it('computes percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        metrics.observe('values', i);
      }

      const snap = metrics.snapshot();
      const hist = snap['histogram.values'] as any;
      expect(hist.count).toBe(100);
      expect(hist.p50).toBe(51); // floor(100*0.5) = index 50 → value 51
      expect(hist.p95).toBe(96); // floor(100*0.95) = index 95 → value 96
      expect(hist.p99).toBe(100); // floor(100*0.99) = index 99 → value 100
    });

    it('keeps at most 1000 observations', () => {
      for (let i = 0; i < 1050; i++) {
        metrics.observe('big', i);
      }

      const snap = metrics.snapshot();
      const hist = snap['histogram.big'] as any;
      expect(hist.count).toBe(1000);
      // First 50 were shifted out, so min should be 50
      expect(hist.min).toBe(50);
    });

    it('does not include empty histograms in snapshot', () => {
      // Only observe on one
      metrics.observe('has_data', 1);

      const snap = metrics.snapshot();
      expect(snap['histogram.has_data']).toBeDefined();
    });
  });

  describe('snapshot()', () => {
    it('returns empty object when no metrics recorded', () => {
      const snap = metrics.snapshot();
      expect(Object.keys(snap)).toHaveLength(0);
    });

    it('includes all metric types in snapshot', () => {
      metrics.inc('counter1');
      metrics.gauge('gauge1', 42);
      metrics.observe('hist1', 100);

      const snap = metrics.snapshot();
      expect(snap['counter.counter1']).toBe(1);
      expect((snap['gauge.gauge1'] as any).value).toBe(42);
      expect((snap['histogram.hist1'] as any).count).toBe(1);
    });
  });

  describe('reset()', () => {
    it('clears all metrics', () => {
      metrics.inc('requests', 100);
      metrics.gauge('cpu', 0.99);
      metrics.observe('latency', 50);

      metrics.reset();

      const snap = metrics.snapshot();
      expect(Object.keys(snap)).toHaveLength(0);
    });
  });
});
