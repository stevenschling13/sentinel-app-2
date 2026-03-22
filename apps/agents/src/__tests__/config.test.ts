import { describe, it, expect } from 'vitest';
import {
  WATCHLIST_TICKERS,
  DEFAULT_CYCLE_INTERVAL_MS,
  MARKET_SENTINEL_COOLDOWN_MS,
  STRATEGY_ANALYST_COOLDOWN_MS,
  RISK_MONITOR_COOLDOWN_MS,
  DEFAULT_AGENT_PROMPTS,
} from '../config.js';

describe('config', () => {
  it('exports a non-empty WATCHLIST_TICKERS array', () => {
    expect(Array.isArray(WATCHLIST_TICKERS)).toBe(true);
    expect(WATCHLIST_TICKERS.length).toBeGreaterThan(0);
  });

  it('WATCHLIST_TICKERS contains expected tickers', () => {
    expect(WATCHLIST_TICKERS).toContain('AAPL');
    expect(WATCHLIST_TICKERS).toContain('SPY');
  });

  it('DEFAULT_CYCLE_INTERVAL_MS is a positive number', () => {
    expect(DEFAULT_CYCLE_INTERVAL_MS).toBeGreaterThan(0);
    // 15 minutes in ms
    expect(DEFAULT_CYCLE_INTERVAL_MS).toBe(15 * 60 * 1_000);
  });

  it('agent cooldowns are positive numbers', () => {
    expect(MARKET_SENTINEL_COOLDOWN_MS).toBeGreaterThan(0);
    expect(STRATEGY_ANALYST_COOLDOWN_MS).toBeGreaterThan(0);
    expect(RISK_MONITOR_COOLDOWN_MS).toBeGreaterThan(0);
  });

  it('cooldowns are ordered: risk < sentinel < analyst', () => {
    expect(RISK_MONITOR_COOLDOWN_MS).toBeLessThan(MARKET_SENTINEL_COOLDOWN_MS);
    expect(MARKET_SENTINEL_COOLDOWN_MS).toBeLessThan(STRATEGY_ANALYST_COOLDOWN_MS);
  });

  it('DEFAULT_AGENT_PROMPTS has entries for all three agents', () => {
    expect(DEFAULT_AGENT_PROMPTS).toHaveProperty('market_sentinel');
    expect(DEFAULT_AGENT_PROMPTS).toHaveProperty('strategy_analyst');
    expect(DEFAULT_AGENT_PROMPTS).toHaveProperty('risk_monitor');
  });

  it('agent prompts are non-empty strings', () => {
    for (const key of ['market_sentinel', 'strategy_analyst', 'risk_monitor']) {
      const prompt = DEFAULT_AGENT_PROMPTS[key];
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    }
  });
});
