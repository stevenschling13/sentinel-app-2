import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolExecutor } from '../tool-executor.js';

const mockEngine = {
  getQuotes: vi.fn().mockResolvedValue([
    { ticker: 'SPY', close: 450, change_pct: 0.5, volume: 1000000, open: 448, high: 451, low: 447, vwap: 449, timestamp: '2024-01-01' },
    { ticker: 'QQQ', close: 380, change_pct: -0.2, volume: 500000, open: 381, high: 382, low: 379, vwap: 380, timestamp: '2024-01-01' },
    { ticker: 'IWM', close: 200, change_pct: 0.1, volume: 300000, open: 199, high: 201, low: 198, vwap: 200, timestamp: '2024-01-01' },
  ]),
  ingestData: vi.fn().mockResolvedValue({ inserted: 5 }),
  getStrategies: vi.fn().mockResolvedValue({ strategies: [{ name: 'test', family: 'momentum' }] }),
  scanStrategies: vi.fn().mockResolvedValue({ signals: [], tickers_scanned: 1, strategies_run: 3, errors: [] }),
  getAccount: vi.fn().mockResolvedValue({ equity: 100000, cash: 50000, initial_capital: 100000 }),
  getPositions: vi.fn().mockResolvedValue([]),
  assessRisk: vi.fn().mockResolvedValue({ equity: 100000, drawdown: 0.02, daily_pnl: 500, halted: false, alerts: [], concentrations: {} }),
  calculatePositionSize: vi.fn().mockResolvedValue({ shares: 100, value: 5000 }),
  preTradeCheck: vi.fn().mockResolvedValue({ allowed: true, reason: 'OK', adjusted_shares: 100 }),
};

vi.mock('../recommendations-store.js', () => ({
  createRecommendation: vi.fn().mockResolvedValue({ id: '1' }),
  createAlert: vi.fn().mockResolvedValue({ id: '1', severity: 'info', title: 'Test', message: 'Test alert' }),
}));

describe('ToolExecutor', () => {
  let executor: ToolExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new ToolExecutor(mockEngine as any);
  });

  it('executes get_market_sentiment', async () => {
    const result = await executor.execute('get_market_sentiment', {});
    const parsed = JSON.parse(result);
    expect(parsed.overall).toBe('bullish');
    expect(parsed.confidence).toBeGreaterThan(0);
    expect(parsed.drivers).toHaveLength(3);
  });

  it('executes get_market_data', async () => {
    const result = await executor.execute('get_market_data', { tickers: ['SPY'] });
    const parsed = JSON.parse(result);
    expect(parsed.tickers).toEqual(['SPY']);
  });

  it('executes run_strategy_scan', async () => {
    const result = await executor.execute('run_strategy_scan', { tickers: ['AAPL'] });
    const parsed = JSON.parse(result);
    expect(parsed.total_signals).toBe(0);
  });

  it('executes get_strategy_info', async () => {
    const result = await executor.execute('get_strategy_info', {});
    const parsed = JSON.parse(result);
    expect(parsed.strategies).toBeDefined();
  });

  it('executes assess_portfolio_risk', async () => {
    const result = await executor.execute('assess_portfolio_risk', {});
    const parsed = JSON.parse(result);
    expect(parsed.equity).toBe(100000);
    expect(parsed.halted).toBe(false);
  });

  it('executes calculate_position_size', async () => {
    const result = await executor.execute('calculate_position_size', { ticker: 'AAPL', price: 150 });
    const parsed = JSON.parse(result);
    expect(parsed.shares).toBe(100);
  });

  it('executes check_risk_limits', async () => {
    const result = await executor.execute('check_risk_limits', { ticker: 'AAPL', shares: 10, price: 150, side: 'buy' });
    const parsed = JSON.parse(result);
    expect(parsed.passed).toBe(true);
  });

  it('executes analyze_ticker', async () => {
    const result = await executor.execute('analyze_ticker', { ticker: 'aapl' });
    const parsed = JSON.parse(result);
    expect(parsed.ticker).toBe('AAPL');
  });

  it('executes create_alert', async () => {
    const result = await executor.execute('create_alert', { severity: 'info', title: 'Test', message: 'Test alert' });
    const parsed = JSON.parse(result);
    expect(parsed.id).toBe('1');
  });

  it('returns error for unknown tool', async () => {
    const result = await executor.execute('unknown_tool', {});
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('Unknown tool');
  });

  it('handles execution errors gracefully', async () => {
    mockEngine.getQuotes.mockRejectedValueOnce(new Error('Network failure'));
    const result = await executor.execute('get_market_sentiment', {});
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('Network failure');
  });
});
