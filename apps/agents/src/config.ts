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

/** Minimum milliseconds between News Analyst runs (10 min). */
export const NEWS_ANALYST_COOLDOWN_MS = 10 * 60 * 1_000;

/** Minimum milliseconds between Execution Planner runs (5 min). */
export const EXECUTION_PLANNER_COOLDOWN_MS = 5 * 60 * 1_000;

/** Minimum milliseconds between Portfolio Manager runs (30 min). */
export const PORTFOLIO_MANAGER_COOLDOWN_MS = 30 * 60 * 1_000;

/** Default system prompts sent to each agent at the start of a trading cycle. */
export const DEFAULT_AGENT_PROMPTS: Readonly<Record<string, string>> = {
  market_sentinel: `Scan the current market conditions. Check prices for the watchlist tickers: ${WATCHLIST_TICKERS.join(', ')}. Report any significant movements, unusual volume, or market regime changes. Create alerts for anything noteworthy.`,
  strategy_analyst: 'Run all available trading strategies against the watchlist tickers. Identify the top signals by conviction. For each signal, explain the setup and expected risk-reward. Only recommend trades with clear edge.',
  risk_monitor: 'Assess the current portfolio risk. Check drawdown levels, position concentrations, and sector exposure. For any proposed trades from the strategy analyst, verify they pass all risk limits. Calculate appropriate position sizes.',
  news_analyst: 'Scan the latest financial news for watchlist tickers. Analyze headlines for sentiment. Identify potential catalysts — earnings surprises, M&A activity, regulatory changes, analyst upgrades/downgrades. Create alerts for significant news events.',
  execution_planner: 'Review pending trade recommendations. For each, determine optimal order type (market vs limit), timing considerations, and appropriate position sizing. Consider current spread, volume, and volatility. Generate execution plans for approved trades.',
  portfolio_manager: 'Analyze current portfolio composition. Check for concentration risks, sector imbalances, and correlation between positions. Generate rebalance proposals if needed. Monitor overall portfolio beta and exposure. Recommend hedging strategies if risk is elevated.',
};
