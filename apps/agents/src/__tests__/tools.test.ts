import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../engine-client.js', () => {
  const EngineClient = function (this: any) {};
  return { EngineClient };
});

vi.mock('../recommendations-store.js', () => ({
  createRecommendation: vi.fn(),
  createAlert: vi.fn(),
}));

import {
  TickersSchema,
  StrategyScanSchema,
  StrategyInfoSchema,
  PositionSizeSchema,
  RiskCheckSchema,
  AnalyzeTickerSchema,
  SubmitOrderSchema,
  CreateAlertSchema,
  NewsSentimentSchema,
  EarningsCheckSchema,
} from '../tool-executor.js';
import { getToolsForAgent } from '../tools.js';
import type { AgentRole } from '../types.js';

describe('Tool Zod schemas', () => {
  describe('TickersSchema', () => {
    it('accepts valid input', () => {
      const result = TickersSchema.parse({ tickers: ['AAPL', 'MSFT'], timeframe: '1h' });
      expect(result.tickers).toEqual(['AAPL', 'MSFT']);
      expect(result.timeframe).toBe('1h');
    });

    it('applies defaults for optional fields', () => {
      const result = TickersSchema.parse({});
      expect(result.tickers).toEqual([]);
      expect(result.timeframe).toBe('1d');
    });

    it('rejects ticker strings exceeding max length', () => {
      expect(() => TickersSchema.parse({ tickers: ['TOOLONGSTRING'] })).toThrow();
    });
  });

  describe('StrategyScanSchema', () => {
    it('accepts valid input', () => {
      const result = StrategyScanSchema.parse({
        tickers: ['AAPL'],
        strategies: ['momentum'],
      });
      expect(result.tickers).toEqual(['AAPL']);
      expect(result.strategies).toEqual(['momentum']);
    });

    it('applies defaults', () => {
      const result = StrategyScanSchema.parse({});
      expect(result.tickers).toEqual([]);
      expect(result.strategies).toEqual([]);
    });
  });

  describe('StrategyInfoSchema', () => {
    it('accepts family filter', () => {
      const result = StrategyInfoSchema.parse({ family: 'momentum' });
      expect(result.family).toBe('momentum');
    });

    it('accepts empty object', () => {
      const result = StrategyInfoSchema.parse({});
      expect(result.family).toBeUndefined();
    });
  });

  describe('PositionSizeSchema', () => {
    it('accepts valid input', () => {
      const result = PositionSizeSchema.parse({ ticker: 'AAPL', price: 150 });
      expect(result.ticker).toBe('AAPL');
      expect(result.price).toBe(150);
      expect(result.method).toBe('fixed_fraction');
    });

    it('rejects non-positive price', () => {
      expect(() => PositionSizeSchema.parse({ ticker: 'AAPL', price: 0 })).toThrow();
      expect(() => PositionSizeSchema.parse({ ticker: 'AAPL', price: -10 })).toThrow();
    });

    it('rejects empty ticker', () => {
      expect(() => PositionSizeSchema.parse({ ticker: '', price: 100 })).toThrow();
    });
  });

  describe('RiskCheckSchema', () => {
    it('accepts valid input', () => {
      const result = RiskCheckSchema.parse({
        ticker: 'AAPL',
        shares: 10,
        price: 150,
        side: 'buy',
      });
      expect(result.side).toBe('buy');
    });

    it('rejects invalid side', () => {
      expect(() =>
        RiskCheckSchema.parse({ ticker: 'AAPL', shares: 10, price: 150, side: 'hold' }),
      ).toThrow();
    });

    it('rejects non-integer shares', () => {
      expect(() =>
        RiskCheckSchema.parse({ ticker: 'AAPL', shares: 10.5, price: 150, side: 'buy' }),
      ).toThrow();
    });

    it('rejects non-positive shares', () => {
      expect(() =>
        RiskCheckSchema.parse({ ticker: 'AAPL', shares: 0, price: 150, side: 'buy' }),
      ).toThrow();
    });
  });

  describe('AnalyzeTickerSchema', () => {
    it('accepts valid input with depth', () => {
      const result = AnalyzeTickerSchema.parse({ ticker: 'NVDA', depth: 'deep' });
      expect(result.depth).toBe('deep');
    });

    it('defaults depth to standard', () => {
      const result = AnalyzeTickerSchema.parse({ ticker: 'NVDA' });
      expect(result.depth).toBe('standard');
    });

    it('rejects invalid depth', () => {
      expect(() => AnalyzeTickerSchema.parse({ ticker: 'NVDA', depth: 'ultra' })).toThrow();
    });
  });

  describe('SubmitOrderSchema', () => {
    it('accepts valid market order', () => {
      const result = SubmitOrderSchema.parse({
        ticker: 'AAPL',
        shares: 10,
        side: 'buy',
      });
      expect(result.order_type).toBe('market');
      expect(result.limit_price).toBeUndefined();
    });

    it('accepts limit order with price', () => {
      const result = SubmitOrderSchema.parse({
        ticker: 'AAPL',
        shares: 10,
        side: 'sell',
        order_type: 'limit',
        limit_price: 155,
      });
      expect(result.order_type).toBe('limit');
      expect(result.limit_price).toBe(155);
    });

    it('rejects non-positive limit_price', () => {
      expect(() =>
        SubmitOrderSchema.parse({
          ticker: 'AAPL',
          shares: 10,
          side: 'buy',
          order_type: 'limit',
          limit_price: 0,
        }),
      ).toThrow();
    });
  });

  describe('CreateAlertSchema', () => {
    it('accepts valid alert', () => {
      const result = CreateAlertSchema.parse({
        severity: 'critical',
        title: 'Drawdown Alert',
        message: 'Portfolio drawdown exceeds 10%',
        ticker: 'SPY',
      });
      expect(result.severity).toBe('critical');
      expect(result.ticker).toBe('SPY');
    });

    it('rejects invalid severity', () => {
      expect(() =>
        CreateAlertSchema.parse({ severity: 'high', title: 'Test', message: 'Test' }),
      ).toThrow();
    });

    it('rejects empty title', () => {
      expect(() =>
        CreateAlertSchema.parse({ severity: 'info', title: '', message: 'Test' }),
      ).toThrow();
    });

    it('rejects empty message', () => {
      expect(() =>
        CreateAlertSchema.parse({ severity: 'info', title: 'Test', message: '' }),
      ).toThrow();
    });
  });

  describe('NewsSentimentSchema', () => {
    it('accepts tickers and limit', () => {
      const result = NewsSentimentSchema.parse({ tickers: ['AAPL'], limit: 5 });
      expect(result.limit).toBe(5);
    });

    it('applies defaults', () => {
      const result = NewsSentimentSchema.parse({});
      expect(result.tickers).toEqual([]);
      expect(result.limit).toBe(10);
    });
  });

  describe('EarningsCheckSchema', () => {
    it('accepts valid input', () => {
      const result = EarningsCheckSchema.parse({ tickers: ['AAPL', 'MSFT'], days_ahead: 7 });
      expect(result.days_ahead).toBe(7);
    });

    it('defaults days_ahead to 14', () => {
      const result = EarningsCheckSchema.parse({ tickers: ['AAPL'] });
      expect(result.days_ahead).toBe(14);
    });

    it('rejects empty tickers array', () => {
      expect(() => EarningsCheckSchema.parse({ tickers: [] })).toThrow();
    });
  });
});

describe('getToolsForAgent()', () => {
  const mockExecutor = {} as any;

  it('returns tools for market_sentinel role', () => {
    const tools = getToolsForAgent('market_sentinel', mockExecutor);
    const names = Object.keys(tools);
    expect(names).toContain('get_market_data');
    expect(names).toContain('get_market_sentiment');
    expect(names).toContain('get_news_sentiment');
    expect(names).toContain('create_alert');
    expect(names).not.toContain('submit_order');
  });

  it('returns tools for strategy_analyst role', () => {
    const tools = getToolsForAgent('strategy_analyst', mockExecutor);
    const names = Object.keys(tools);
    expect(names).toContain('run_strategy_scan');
    expect(names).toContain('get_strategy_info');
    expect(names).toContain('analyze_ticker');
    expect(names).toContain('submit_order');
  });

  it('returns tools for risk_monitor role', () => {
    const tools = getToolsForAgent('risk_monitor', mockExecutor);
    const names = Object.keys(tools);
    expect(names).toContain('assess_portfolio_risk');
    expect(names).toContain('check_risk_limits');
    expect(names).toContain('calculate_position_size');
    expect(names).not.toContain('run_strategy_scan');
  });

  it('returns tools for news_analyst role', () => {
    const tools = getToolsForAgent('news_analyst', mockExecutor);
    const names = Object.keys(tools);
    expect(names).toContain('get_news_sentiment');
    expect(names).toContain('get_market_data');
    expect(names).toContain('create_alert');
  });

  it('returns tools for execution_planner role', () => {
    const tools = getToolsForAgent('execution_planner', mockExecutor);
    const names = Object.keys(tools);
    expect(names).toContain('submit_order');
    expect(names).toContain('calculate_position_size');
    expect(names).toContain('check_risk_limits');
  });

  it('returns tools for portfolio_manager role', () => {
    const tools = getToolsForAgent('portfolio_manager', mockExecutor);
    const names = Object.keys(tools);
    expect(names).toContain('assess_portfolio_risk');
    expect(names).toContain('get_market_data');
    expect(names).toContain('calculate_position_size');
    expect(names).not.toContain('submit_order');
  });

  it('returns empty object for unknown role', () => {
    const tools = getToolsForAgent('unknown_role' as AgentRole, mockExecutor);
    expect(Object.keys(tools)).toHaveLength(0);
  });

  it('all returned tools have execute functions', () => {
    const roles: AgentRole[] = [
      'market_sentinel',
      'strategy_analyst',
      'risk_monitor',
      'news_analyst',
      'execution_planner',
      'portfolio_manager',
    ];

    for (const role of roles) {
      const tools = getToolsForAgent(role, mockExecutor);
      for (const [name, tool] of Object.entries(tools)) {
        expect(tool, `${role}/${name} should have execute`).toHaveProperty('execute');
      }
    }
  });
});
