/**
 * Runtime configuration for the agents service (v2).
 * All tuneable values live here.
 */

/** Tickers that every agent cycle scans by default. */
export const WATCHLIST_TICKERS: readonly string[] = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'SPY',
];

/** Default interval between automated trading cycles (15 minutes). */
export const DEFAULT_CYCLE_INTERVAL_MS = 15 * 60 * 1_000;

/** Minimum milliseconds between Market Sentinel runs (5 min). */
export const MARKET_SENTINEL_COOLDOWN_MS = 5 * 60 * 1_000;

/** Minimum milliseconds between Strategy Analyst runs (15 min). */
export const STRATEGY_ANALYST_COOLDOWN_MS = 15 * 60 * 1_000;

/** Minimum milliseconds between Risk Monitor runs (1 min). */
export const RISK_MONITOR_COOLDOWN_MS = 60 * 1_000;

/** Default system prompts sent to each agent at the start of a trading cycle. */
export const DEFAULT_AGENT_PROMPTS: Readonly<Record<string, string>> = {
  market_sentinel: `Scan the current market conditions. Check prices for the watchlist tickers: ${WATCHLIST_TICKERS.join(', ')}. Report any significant movements, unusual volume, or market regime changes. Create alerts for anything noteworthy.`,
  strategy_analyst: 'Run all available trading strategies against the watchlist tickers. Identify the top signals by conviction. For each signal, explain the setup and expected risk-reward. Only recommend trades with clear edge.',
  risk_monitor: 'Assess the current portfolio risk. Check drawdown levels, position concentrations, and sector exposure. For any proposed trades from the strategy analyst, verify they pass all risk limits. Calculate appropriate position sizes.',
};
