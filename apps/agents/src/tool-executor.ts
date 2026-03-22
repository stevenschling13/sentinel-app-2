/**
 * Tool execution layer — all tools wired to live engine API and Supabase.
 * Simplified v2: no GitHub ops, no order submission (manual execution only).
 *
 * Public methods are called directly by AI SDK tool `execute` callbacks.
 * Zod schemas are exported for use as AI SDK tool `inputSchema` definitions.
 */

import { z } from 'zod';
import { EngineClient } from './engine-client.js';
import {
  createRecommendation,
  createAlert as dbCreateAlert,
  type RecommendationCreate,
  type AlertCreate,
} from './recommendations-store.js';
import type { MarketSentiment, RiskAssessment } from './types.js';
import { WATCHLIST_TICKERS } from './config.js';

// ── Zod schemas for tool input validation ───────────────────

export const TickersSchema = z.object({
  tickers: z.array(z.string().min(1).max(10)).optional().default([]),
  timeframe: z.string().optional().default('1d'),
});

export const StrategyScanSchema = z.object({
  tickers: z.array(z.string()).optional().default([]),
  strategies: z.array(z.string()).optional().default([]),
});

export const StrategyInfoSchema = z.object({
  family: z.string().optional(),
});

export const PositionSizeSchema = z.object({
  ticker: z.string().min(1).max(10),
  price: z.number().positive(),
  method: z.string().optional().default('fixed_fraction'),
});

export const RiskCheckSchema = z.object({
  ticker: z.string().min(1).max(10),
  shares: z.number().int().positive(),
  price: z.number().positive(),
  side: z.enum(['buy', 'sell']),
});

export const AnalyzeTickerSchema = z.object({
  ticker: z.string().min(1).max(10),
  depth: z.enum(['quick', 'standard', 'deep']).optional().default('standard'),
});

export const CreateAlertSchema = z.object({
  severity: z.enum(['info', 'warning', 'critical']),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  ticker: z.string().optional(),
});

export class ToolExecutor {
  private engine: EngineClient;

  constructor(engine?: EngineClient) {
    this.engine = engine ?? new EngineClient();
  }

  async getMarketData(input: z.infer<typeof TickersSchema>) {
    const { tickers, timeframe } = input;

    try {
      await this.engine.ingestData(tickers, timeframe);
    } catch {
      /* best-effort */
    }

    const quotes = await this.engine.getQuotes(tickers);
    const prices = Object.fromEntries(
      quotes.map((q) => [q.ticker, { price: q.close, change_pct: q.change_pct, volume: q.volume }]),
    );
    return {
      tickers,
      timeframe,
      prices,
      message: `Live prices for ${quotes.length}/${tickers.length} tickers`,
    };
  }

  async getMarketSentiment(): Promise<MarketSentiment> {
    const quotes = await this.engine.getQuotes(['SPY', 'QQQ', 'IWM']);
    const spy = quotes.find((q) => q.ticker === 'SPY');
    const spyChange = spy?.change_pct ?? 0;

    let overall: 'bullish' | 'bearish' | 'neutral';
    if (spyChange > 0.3) overall = 'bullish';
    else if (spyChange < -0.3) overall = 'bearish';
    else overall = 'neutral';

    return {
      overall,
      confidence: Math.min(0.9, Math.abs(spyChange) / 2 + 0.5),
      drivers: quotes.map(
        (q) =>
          `${q.ticker}: ${q.change_pct >= 0 ? '+' : ''}${q.change_pct.toFixed(2)}% ($${q.close.toFixed(2)})`,
      ),
      sectors: {
        technology: overall,
        healthcare: 'neutral',
        financials: 'neutral',
        energy: 'neutral',
      },
    };
  }

  async runStrategyScan(input: z.infer<typeof StrategyScanSchema>) {
    const { tickers, strategies } = input;
    const scanTickers = tickers.length > 0 ? tickers : [...WATCHLIST_TICKERS];

    const result = await this.engine.scanStrategies({
      tickers: scanTickers,
      days: 90,
      min_strength: 0.3,
    });
    const signals =
      strategies.length > 0
        ? result.signals.filter((s) => strategies.includes(s.strategy_name))
        : result.signals;

    return {
      signals,
      total_signals: signals.length,
      tickers_scanned: result.tickers_scanned,
      strategies_run: result.strategies_run,
      errors: result.errors,
    };
  }

  async getStrategyInfo(input: z.infer<typeof StrategyInfoSchema>) {
    const strategies = await this.engine.getStrategies();
    const { family } = input;
    if (family)
      return { family, strategies: strategies.strategies.filter((s) => s.family === family) };
    return strategies;
  }

  async assessPortfolioRisk(): Promise<RiskAssessment> {
    const [acct, positions] = await Promise.all([
      this.engine.getAccount(),
      this.engine.getPositions(),
    ]);
    const positionsMap: Record<string, number> = {};
    for (const p of positions)
      positionsMap[p.instrument_id] = p.market_value ?? p.quantity * (p.avg_price ?? 0);

    const result = await this.engine.assessRisk({
      equity: acct.equity,
      cash: acct.cash,
      peak_equity: acct.initial_capital ?? acct.equity,
      daily_starting_equity: acct.initial_capital ?? acct.equity,
      positions: positionsMap,
      position_sectors: {},
    });

    return {
      equity: result.equity,
      drawdown: result.drawdown,
      dailyPnl: result.daily_pnl,
      halted: result.halted,
      alerts: result.alerts.map((a) => ({
        severity: a.severity as 'info' | 'warning' | 'critical',
        rule: a.rule,
        message: a.message,
        action: a.action,
      })),
      concentrations: result.concentrations,
    };
  }

  async calculatePositionSize(input: z.infer<typeof PositionSizeSchema>) {
    const { ticker, price, method } = input;
    const acct = await this.engine.getAccount();
    return this.engine.calculatePositionSize({
      ticker,
      price,
      equity: acct.equity,
      method,
    });
  }

  async checkRiskLimits(input: z.infer<typeof RiskCheckSchema>) {
    const { ticker, shares, price, side } = input;
    const [acct, positions] = await Promise.all([
      this.engine.getAccount(),
      this.engine.getPositions(),
    ]);
    const positionsMap: Record<string, number> = {};
    for (const p of positions)
      positionsMap[p.instrument_id] = p.market_value ?? p.quantity * (p.avg_price ?? 0);

    const result = await this.engine.preTradeCheck({
      ticker,
      shares,
      price,
      side,
      equity: acct.equity,
      cash: acct.cash,
      peak_equity: acct.initial_capital ?? acct.equity,
      daily_starting_equity: acct.initial_capital ?? acct.equity,
      positions: positionsMap,
      position_sectors: {},
    });

    return {
      ticker,
      shares,
      price,
      side,
      passed: result.allowed,
      reason: result.reason,
      adjusted_shares: result.adjusted_shares,
    };
  }

  async analyzeTicker(input: z.infer<typeof AnalyzeTickerSchema>) {
    const ticker = input.ticker.toUpperCase();
    const { depth } = input;
    const result = await this.engine.scanStrategies({
      tickers: [ticker],
      days: 90,
      min_strength: 0.0,
    });
    const signals = result.signals;
    const longSignals = signals.filter((s) => s.direction === 'long');
    const shortSignals = signals.filter((s) => s.direction === 'short');
    const avgStrength =
      signals.length > 0 ? signals.reduce((sum, s) => sum + s.strength, 0) / signals.length : 0;

    return {
      ticker,
      depth,
      signals,
      summary: {
        total_signals: signals.length,
        long_signals: longSignals.length,
        short_signals: shortSignals.length,
        avg_strength: Math.round(avgStrength * 100) / 100,
        trend_bias:
          longSignals.length > shortSignals.length
            ? 'bullish'
            : shortSignals.length > longSignals.length
              ? 'bearish'
              : 'neutral',
        strongest_signal: [...signals].sort((a, b) => b.strength - a.strength)[0] ?? null,
        errors: result.errors,
      },
    };
  }

  async createAlert(input: z.infer<typeof CreateAlertSchema>) {
    const { severity, title, message, ticker } = input;
    const alertData: AlertCreate = { severity, title, message };
    if (ticker) alertData.ticker = ticker;
    return dbCreateAlert(alertData);
  }
}
