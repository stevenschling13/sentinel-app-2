/**
 * Lightweight in-memory metrics collector for observability.
 * Exposes counters and gauges via a /metrics endpoint.
 */

interface MetricEntry {
  value: number;
  updatedAt: string;
}

class MetricsCollector {
  private counters = new Map<string, number>();
  private gauges = new Map<string, MetricEntry>();
  private histograms = new Map<string, number[]>();

  /** Increment a counter by 1 (or n). */
  inc(name: string, n = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + n);
  }

  /** Set a gauge to a specific value. */
  gauge(name: string, value: number): void {
    this.gauges.set(name, { value, updatedAt: new Date().toISOString() });
  }

  /** Record a histogram observation (e.g., duration). */
  observe(name: string, value: number): void {
    const existing = this.histograms.get(name) ?? [];
    existing.push(value);
    // Keep last 1000 observations
    if (existing.length > 1000) existing.shift();
    this.histograms.set(name, existing);
  }

  /** Get a summary of all metrics. */
  snapshot(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [name, value] of this.counters) {
      result[`counter.${name}`] = value;
    }

    for (const [name, entry] of this.gauges) {
      result[`gauge.${name}`] = entry;
    }

    for (const [name, values] of this.histograms) {
      if (values.length === 0) continue;
      const sorted = [...values].sort((a, b) => a - b);
      result[`histogram.${name}`] = {
        count: values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      };
    }

    return result;
  }

  /** Reset all metrics. */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

export const metrics = new MetricsCollector();
