/**
 * Tool definitions for AI SDK function calling (v2).
 * Uses Vercel AI SDK `tool()` with Zod schemas from tool-executor.
 */

import { tool } from 'ai';
import type { AgentRole } from './types.js';
import type { ToolExecutor } from './tool-executor.js';
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
} from './tool-executor.js';
import { z } from 'zod';

function createAllTools(executor: ToolExecutor) {
  return {
    get_market_data: tool({
      description: 'Fetch current market data (prices, volume, indicators) for given tickers.',
      inputSchema: TickersSchema,
      execute: async (input) => executor.getMarketData(input),
    }),
    get_market_sentiment: tool({
      description:
        'Analyze overall market sentiment based on breadth, volatility, and sector performance.',
      inputSchema: z.object({}),
      execute: async () => executor.getMarketSentiment(),
    }),
    run_strategy_scan: tool({
      description:
        'Run trading strategies against current market data and return generated signals.',
      inputSchema: StrategyScanSchema,
      execute: async (input) => executor.runStrategyScan(input),
    }),
    get_strategy_info: tool({
      description:
        'Get details about available trading strategies including parameters and families.',
      inputSchema: StrategyInfoSchema,
      execute: async (input) => executor.getStrategyInfo(input),
    }),
    assess_portfolio_risk: tool({
      description: 'Run comprehensive risk assessment on current portfolio.',
      inputSchema: z.object({}),
      execute: async () => executor.assessPortfolioRisk(),
    }),
    calculate_position_size: tool({
      description:
        'Calculate optimal position size for a proposed trade using risk-adjusted sizing.',
      inputSchema: PositionSizeSchema,
      execute: async (input) => executor.calculatePositionSize(input),
    }),
    check_risk_limits: tool({
      description: 'Check if a proposed trade passes all risk limits.',
      inputSchema: RiskCheckSchema,
      execute: async (input) => executor.checkRiskLimits(input),
    }),
    analyze_ticker: tool({
      description:
        'Perform deep analysis on a specific ticker: technical setup, trend, support/resistance.',
      inputSchema: AnalyzeTickerSchema,
      execute: async (input) => executor.analyzeTicker(input),
    }),
    submit_order: tool({
      description:
        'Submit a trade order (buy or sell) for a given ticker and quantity via the execution engine.',
      inputSchema: SubmitOrderSchema,
      execute: async (input) => executor.submitOrder(input),
    }),
    create_alert: tool({
      description: 'Create a trading alert shown on the dashboard.',
      inputSchema: CreateAlertSchema,
      execute: async (input) => executor.createAlert(input),
    }),
    get_news_sentiment: tool({
      description: 'Get latest financial news and sentiment analysis for tickers.',
      inputSchema: NewsSentimentSchema,
      execute: async (input) => executor.getNewsSentiment(input),
    }),
    check_earnings_calendar: tool({
      description: 'Check upcoming earnings dates. Avoid opening positions 2 days before earnings.',
      inputSchema: EarningsCheckSchema,
      execute: async (input) => executor.checkEarnings(input),
    }),
  };
}

const AGENT_TOOLS: Record<AgentRole, string[]> = {
  market_sentinel: [
    'get_market_data',
    'get_market_sentiment',
    'get_news_sentiment',
    'create_alert',
  ],
  strategy_analyst: [
    'run_strategy_scan',
    'get_strategy_info',
    'get_market_data',
    'analyze_ticker',
    'get_news_sentiment',
    'check_earnings_calendar',
    'submit_order',
    'create_alert',
  ],
  risk_monitor: [
    'assess_portfolio_risk',
    'check_risk_limits',
    'calculate_position_size',
    'check_earnings_calendar',
    'create_alert',
  ],
  news_analyst: [
    'get_news_sentiment',
    'get_market_data',
    'get_market_sentiment',
    'check_earnings_calendar',
    'create_alert',
  ],
  execution_planner: [
    'get_market_data',
    'calculate_position_size',
    'check_risk_limits',
    'check_earnings_calendar',
    'submit_order',
    'create_alert',
  ],
  portfolio_manager: [
    'assess_portfolio_risk',
    'get_market_data',
    'get_strategy_info',
    'calculate_position_size',
    'check_risk_limits',
    'create_alert',
  ],
};

type ToolSet = ReturnType<typeof createAllTools>;

export function getToolsForAgent(role: AgentRole, executor: ToolExecutor): Partial<ToolSet> {
  const allowed = AGENT_TOOLS[role] ?? [];
  const allTools = createAllTools(executor);
  return Object.fromEntries(
    Object.entries(allTools).filter(([name]) => allowed.includes(name)),
  ) as Partial<ToolSet>;
}
