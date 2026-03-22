/**
 * Tool execution layer — all tools wired to live engine API and Supabase.
 * Simplified v2: no GitHub ops, no order submission (manual execution only).
 */

import { EngineClient } from './engine-client.js';
import {
  createRecommendation,
  createAlert as dbCreateAlert,
  type RecommendationCreate,
  type AlertCreate,
} from './recommendations-store.js';
import type { MarketSentiment, RiskAssessment } from './types.js';
import { WATCHLIST_TICKERS } from './config.js';

export class ToolExecutor {
  private engine: EngineClient;

  constructor(engine?: EngineClient) {
    this.engine = engine ?? new EngineClient();
  }

  async execute(toolName: string, input: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.dispatch(toolName, input);
      return JSON.stringify(result, null, 2);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: message });
    }
  }

  private async dispatch(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'get_market_data': return this.getMarketData(input);
      case 'get_market_sentiment': return this.getMarketSentiment();
      case 'run_strategy_scan': return this.runStrategyScan(input);
      case 'get_strategy_info': return this.getStrategyInfo(input);
      case 'assess_portfolio_risk': return this.assessPortfolioRisk();
      case 'calculate_position_size': return this.calculatePositionSize(input);
      case 'check_risk_limits': return this.checkRiskLimits(input);
      case 'analyze_ticker': return this.analyzeTicker(input);
      case 'create_alert': return this.createAlert(input);
      default: throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async getMarketData(input: Record<string, unknown>) {
    const tickers = (input.tickers as string[]) ?? [];
    const timeframe = (input.timeframe as string) ?? '1d';

    try { await this.engine.ingestData(tickers, timeframe); } catch { /* best-effort */ }

    const quotes = await this.engine.getQuotes(tickers);
    const prices = Object.fromEntries(
      quotes.map((q) => [q.ticker, { price: q.close, change_pct: q.change_pct, volume: q.volume }]),
    );
    return { tickers, timeframe, prices, message: `Live prices for ${quotes.length}/${tickers.length} tickers` };
  }

  private async getMarketSentiment(): Promise<MarketSentiment> {
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
      drivers: quotes.map((q) => `${q.ticker}: ${q.change_pct >= 0 ? '+' : ''}${q.change_pct.toFixed(2)}% ($${q.close.toFixed(2)})`),
      sectors: { technology: overall, healthcare: 'neutral', financials: 'neutral', energy: 'neutral' },
    };
  }

  private async runStrategyScan(input: Record<string, unknown>) {
    const tickers = (input.tickers as string[] | undefined) ?? [];
    const strategies = (input.strategies as string[] | undefined) ?? [];
    const scanTickers = tickers.length > 0 ? tickers : [...WATCHLIST_TICKERS];

    const result = await this.engine.scanStrategies({ tickers: scanTickers, days: 90, min_strength: 0.3 });
    const signals = strategies.length > 0
      ? result.signals.filter((s) => strategies.includes(s.strategy_name))
      : result.signals;

    return { signals, total_signals: signals.length, tickers_scanned: result.tickers_scanned, strategies_run: result.strategies_run, errors: result.errors };
  }

  private async getStrategyInfo(input: Record<string, unknown>) {
    const strategies = await this.engine.getStrategies();
    const family = input.family as string | undefined;
    if (family) return { family, strategies: strategies.strategies.filter((s) => s.family === family) };
    return strategies;
  }

  private async assessPortfolioRisk(): Promise<RiskAssessment> {
    const [acct, positions] = await Promise.all([this.engine.getAccount(), this.engine.getPositions()]);
    const positionsMap: Record<string, number> = {};
    for (const p of positions) positionsMap[p.instrument_id] = p.market_value ?? p.quantity * (p.avg_price ?? 0);

    const result = await this.engine.assessRisk({
      equity: acct.equity, cash: acct.cash,
      peak_equity: acct.initial_capital ?? acct.equity,
      daily_starting_equity: acct.initial_capital ?? acct.equity,
      positions: positionsMap, position_sectors: {},
    });

    return {
      equity: result.equity, drawdown: result.drawdown, dailyPnl: result.daily_pnl,
      halted: result.halted,
      alerts: result.alerts.map((a) => ({ severity: a.severity as 'info' | 'warning' | 'critical', rule: a.rule, message: a.message, action: a.action })),
      concentrations: result.concentrations,
    };
  }

  private async calculatePositionSize(input: Record<string, unknown>) {
    const acct = await this.engine.getAccount();
    return this.engine.calculatePositionSize({
      ticker: input.ticker as string,
      price: input.price as number,
      equity: acct.equity,
      method: (input.method as string) ?? 'fixed_fraction',
    });
  }

  private async checkRiskLimits(input: Record<string, unknown>) {
    const [acct, positions] = await Promise.all([this.engine.getAccount(), this.engine.getPositions()]);
    const positionsMap: Record<string, number> = {};
    for (const p of positions) positionsMap[p.instrument_id] = p.market_value ?? p.quantity * (p.avg_price ?? 0);

    const result = await this.engine.preTradeCheck({
      ticker: input.ticker as string, shares: input.shares as number,
      price: input.price as number, side: input.side as 'buy' | 'sell',
      equity: acct.equity, cash: acct.cash,
      peak_equity: acct.initial_capital ?? acct.equity,
      daily_starting_equity: acct.initial_capital ?? acct.equity,
      positions: positionsMap, position_sectors: {},
    });

    return { ticker: input.ticker, shares: input.shares, price: input.price, side: input.side, passed: result.allowed, reason: result.reason, adjusted_shares: result.adjusted_shares };
  }

  private async analyzeTicker(input: Record<string, unknown>) {
    const ticker = (input.ticker as string).toUpperCase();
    const result = await this.engine.scanStrategies({ tickers: [ticker], days: 90, min_strength: 0.0 });
    const signals = result.signals;
    const longSignals = signals.filter((s) => s.direction === 'long');
    const shortSignals = signals.filter((s) => s.direction === 'short');
    const avgStrength = signals.length > 0 ? signals.reduce((sum, s) => sum + s.strength, 0) / signals.length : 0;

    return {
      ticker,
      depth: input.depth ?? 'standard',
      signals,
      summary: {
        total_signals: signals.length, long_signals: longSignals.length, short_signals: shortSignals.length,
        avg_strength: Math.round(avgStrength * 100) / 100,
        trend_bias: longSignals.length > shortSignals.length ? 'bullish' : shortSignals.length > longSignals.length ? 'bearish' : 'neutral',
        strongest_signal: [...signals].sort((a, b) => b.strength - a.strength)[0] ?? null,
        errors: result.errors,
      },
    };
  }

  private async createAlert(input: Record<string, unknown>) {
    const alertData: AlertCreate = {
      severity: input.severity as 'info' | 'warning' | 'critical',
      title: input.title as string,
      message: input.message as string,
    };
    const ticker = input.ticker as string | undefined;
    if (ticker) alertData.ticker = ticker;
    return dbCreateAlert(alertData);
  }
}
