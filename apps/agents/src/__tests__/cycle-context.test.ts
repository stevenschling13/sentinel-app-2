import { describe, it, expect, beforeEach } from 'vitest';
import { CycleContext, type AgentSummary } from '../cycle-context.js';

function makeSummary(overrides?: Partial<AgentSummary>): AgentSummary {
  return {
    role: 'market_sentinel',
    success: true,
    summary: 'Market conditions are bullish',
    durationMs: 150,
    timestamp: '2024-01-01T00:00:00.000Z',
    highlights: {},
    ...overrides,
  };
}

describe('CycleContext', () => {
  let ctx: CycleContext;

  beforeEach(() => {
    ctx = new CycleContext(1);
  });

  it('creates with correct cycle number', () => {
    expect(ctx.cycleNumber).toBe(1);
  });

  it('records startedAt timestamp on creation', () => {
    expect(ctx.startedAt).toBeDefined();
    // Should be a valid ISO string
    expect(() => new Date(ctx.startedAt)).not.toThrow();
  });

  it('supports different cycle numbers', () => {
    const ctx42 = new CycleContext(42);
    expect(ctx42.cycleNumber).toBe(42);
  });

  describe('addResult()', () => {
    it('adds a single result', () => {
      ctx.addResult(makeSummary());

      const snapshot = ctx.toSnapshot();
      expect(snapshot.agentCount).toBe(1);
      expect(snapshot.summaries).toHaveLength(1);
    });

    it('adds multiple results in order', () => {
      ctx.addResult(makeSummary({ role: 'market_sentinel' }));
      ctx.addResult(makeSummary({ role: 'strategy_analyst' }));
      ctx.addResult(makeSummary({ role: 'risk_monitor' }));

      const snapshot = ctx.toSnapshot();
      expect(snapshot.agentCount).toBe(3);
      expect(snapshot.summaries[0].role).toBe('market_sentinel');
      expect(snapshot.summaries[1].role).toBe('strategy_analyst');
      expect(snapshot.summaries[2].role).toBe('risk_monitor');
    });

    it('preserves summary data including highlights', () => {
      const summary = makeSummary({
        highlights: { signals: ['AAPL long', 'TSLA short'] },
      });
      ctx.addResult(summary);

      const snap = ctx.toSnapshot();
      expect(snap.summaries[0].highlights).toEqual({
        signals: ['AAPL long', 'TSLA short'],
      });
    });
  });

  describe('getPriorContext()', () => {
    it('returns empty array when no summaries exist', () => {
      expect(ctx.getPriorContext('market_sentinel')).toEqual([]);
    });

    it('returns all summaries except for the given role', () => {
      ctx.addResult(makeSummary({ role: 'market_sentinel' }));
      ctx.addResult(makeSummary({ role: 'strategy_analyst' }));
      ctx.addResult(makeSummary({ role: 'risk_monitor' }));

      const prior = ctx.getPriorContext('strategy_analyst');
      expect(prior).toHaveLength(2);
      expect(prior.map((s) => s.role)).toEqual(['market_sentinel', 'risk_monitor']);
    });

    it('returns all summaries when role not present', () => {
      ctx.addResult(makeSummary({ role: 'market_sentinel' }));
      ctx.addResult(makeSummary({ role: 'strategy_analyst' }));

      const prior = ctx.getPriorContext('risk_monitor');
      expect(prior).toHaveLength(2);
    });
  });

  describe('formatForPrompt()', () => {
    it('returns empty string when no prior context', () => {
      expect(ctx.formatForPrompt('market_sentinel')).toBe('');
    });

    it('formats prior context with success status emoji', () => {
      ctx.addResult(makeSummary({ role: 'market_sentinel', success: true, summary: 'All clear' }));

      const formatted = ctx.formatForPrompt('strategy_analyst');
      expect(formatted).toContain('Prior Agent Findings');
      expect(formatted).toContain('Cycle #1');
      expect(formatted).toContain('market_sentinel ✅');
      expect(formatted).toContain('All clear');
    });

    it('formats failed agents with error emoji', () => {
      ctx.addResult(makeSummary({ role: 'market_sentinel', success: false, summary: 'API error' }));

      const formatted = ctx.formatForPrompt('strategy_analyst');
      expect(formatted).toContain('market_sentinel ❌');
      expect(formatted).toContain('API error');
    });

    it('formats multiple agents with sections', () => {
      ctx.addResult(makeSummary({ role: 'market_sentinel', summary: 'Bullish market' }));
      ctx.addResult(makeSummary({ role: 'news_analyst', summary: 'Positive sentiment' }));

      const formatted = ctx.formatForPrompt('strategy_analyst');
      expect(formatted).toContain('### market_sentinel');
      expect(formatted).toContain('### news_analyst');
      expect(formatted).toContain('Bullish market');
      expect(formatted).toContain('Positive sentiment');
    });

    it('excludes the current role from the prompt', () => {
      ctx.addResult(makeSummary({ role: 'market_sentinel' }));
      ctx.addResult(makeSummary({ role: 'strategy_analyst' }));

      const formatted = ctx.formatForPrompt('market_sentinel');
      expect(formatted).not.toContain('### market_sentinel');
      expect(formatted).toContain('### strategy_analyst');
    });
  });

  describe('toSnapshot()', () => {
    it('returns correct structure with empty summaries', () => {
      const snap = ctx.toSnapshot();
      expect(snap).toEqual({
        cycleNumber: 1,
        startedAt: expect.any(String),
        agentCount: 0,
        summaries: [],
      });
    });

    it('returns correct agentCount after adding results', () => {
      ctx.addResult(makeSummary({ role: 'market_sentinel' }));
      ctx.addResult(makeSummary({ role: 'strategy_analyst' }));

      const snap = ctx.toSnapshot();
      expect(snap.agentCount).toBe(2);
      expect(snap.summaries).toHaveLength(2);
    });

    it('returns a copy of summaries (not the internal array)', () => {
      ctx.addResult(makeSummary());
      const snap1 = ctx.toSnapshot();
      ctx.addResult(makeSummary({ role: 'strategy_analyst' }));
      const snap2 = ctx.toSnapshot();

      // snap1 should not be mutated
      expect(snap1.summaries).toHaveLength(1);
      expect(snap2.summaries).toHaveLength(2);
    });

    it('preserves all summary fields in serialization', () => {
      const summary = makeSummary({
        role: 'risk_monitor',
        success: false,
        summary: 'Drawdown exceeded',
        durationMs: 999,
        highlights: { drawdown: 0.12 },
      });
      ctx.addResult(summary);

      const snap = ctx.toSnapshot();
      expect(snap.summaries[0]).toEqual(summary);
    });
  });
});
