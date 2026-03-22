import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolExecutor } from '../tool-executor.js';

const mockEngine = {
  getQuotes: vi.fn().mockResolvedValue([
    {
      ticker: 'SPY',
      close: 450,
      change_pct: 0.5,
      volume: 1000000,
      open: 448,
      high: 451,
      low: 447,
      vwap: 449,
      timestamp: '2024-01-01',
    },
    {
      ticker: 'QQQ',
      close: 380,
      change_pct: -0.2,
      volume: 500000,
      open: 381,
      high: 382,
      low: 379,
      vwap: 380,
      timestamp: '2024-01-01',
    },
    {
      ticker: 'IWM',
      close: 200,
      change_pct: 0.1,
      volume: 300000,
      open: 199,
      high: 201,
      low: 198,
      vwap: 200,
      timestamp: '2024-01-01',
    },
  ]),
  ingestData: vi.fn().mockResolvedValue({ inserted: 5 }),
  getStrategies: vi.fn().mockResolvedValue({ strategies: [{ name: 'test', family: 'momentum' }] }),
  scanStrategies: vi
    .fn()
    .mockResolvedValue({ signals: [], tickers_scanned: 1, strategies_run: 3, errors: [] }),
  getAccount: vi.fn().mockResolvedValue({ equity: 100000, cash: 50000, initial_capital: 100000 }),
  getPositions: vi.fn().mockResolvedValue([]),
  assessRisk: vi
    .fn()
    .mockResolvedValue({
      equity: 100000,
      drawdown: 0.02,
      daily_pnl: 500,
      halted: false,
      alerts: [],
      concentrations: {},
    }),
  calculatePositionSize: vi.fn().mockResolvedValue({ shares: 100, value: 5000 }),
  preTradeCheck: vi.fn().mockResolvedValue({ allowed: true, reason: 'OK', adjusted_shares: 100 }),
};

vi.mock('../recommendations-store.js', () => ({
  createRecommendation: vi.fn().mockResolvedValue({ id: '1' }),
  createAlert: vi
    .fn()
    .mockResolvedValue({ id: '1', severity: 'info', title: 'Test', message: 'Test alert' }),
}));

describe('ToolExecutor', () => {
  let executor: ToolExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new ToolExecutor(mockEngine as any);
  });

  it('executes getMarketSentiment', async () => {
    const result = await executor.getMarketSentiment();
    expect(result.overall).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.drivers).toHaveLength(3);
  });

  it('executes getMarketData', async () => {
    const result = await executor.getMarketData({ tickers: ['SPY'], timeframe: '1d' });
    expect(result.tickers).toEqual(['SPY']);
  });

  it('executes runStrategyScan', async () => {
    const result = await executor.runStrategyScan({ tickers: ['AAPL'], strategies: [] });
    expect(result.total_signals).toBe(0);
  });

  it('executes getStrategyInfo', async () => {
    const result = await executor.getStrategyInfo({});
    expect(result.strategies).toBeDefined();
  });

  it('executes assessPortfolioRisk', async () => {
    const result = await executor.assessPortfolioRisk();
    expect(result.equity).toBe(100000);
    expect(result.halted).toBe(false);
  });

  it('executes calculatePositionSize', async () => {
    const result = await executor.calculatePositionSize({
      ticker: 'AAPL',
      price: 150,
      method: 'fixed_fraction',
    });
    expect(result.shares).toBe(100);
  });

  it('executes checkRiskLimits', async () => {
    const result = await executor.checkRiskLimits({
      ticker: 'AAPL',
      shares: 10,
      price: 150,
      side: 'buy',
    });
    expect(result.passed).toBe(true);
  });

  it('executes analyzeTicker', async () => {
    const result = await executor.analyzeTicker({ ticker: 'aapl', depth: 'standard' });
    expect(result.ticker).toBe('AAPL');
  });

  it('executes createAlert', async () => {
    const result = await executor.createAlert({
      severity: 'info',
      title: 'Test',
      message: 'Test alert',
    });
    expect(result.id).toBe('1');
  });

  it('handles execution errors gracefully', async () => {
    mockEngine.getQuotes.mockRejectedValueOnce(new Error('Network failure'));
    await expect(executor.getMarketSentiment()).rejects.toThrow('Network failure');
  });
});
