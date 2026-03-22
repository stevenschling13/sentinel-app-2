/**
 * Tool definitions for Claude agent function calling (v2).
 * Simplified to core trading tools only — no GitHub ops.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AgentRole } from './types.js';

const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'get_market_data',
    description: 'Fetch current market data (prices, volume, indicators) for given tickers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tickers: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of ticker symbols (e.g., ["AAPL", "MSFT"])',
        },
        timeframe: {
          type: 'string',
          enum: ['1m', '5m', '15m', '1h', '1d', '1w'],
          description: 'Data timeframe (default: 1d)',
        },
      },
      required: ['tickers'],
    },
  },
  {
    name: 'get_market_sentiment',
    description: 'Analyze overall market sentiment based on breadth, volatility, and sector performance.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'run_strategy_scan',
    description: 'Run trading strategies against current market data and return generated signals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        strategies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Strategy names to run. Empty = run all.',
        },
        tickers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tickers to scan. Empty = scan watchlist.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_strategy_info',
    description: 'Get details about available trading strategies including parameters and families.',
    input_schema: {
      type: 'object' as const,
      properties: {
        family: { type: 'string', description: 'Filter by strategy family' },
      },
      required: [],
    },
  },
  {
    name: 'assess_portfolio_risk',
    description: 'Run comprehensive risk assessment on current portfolio.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'calculate_position_size',
    description: 'Calculate optimal position size for a proposed trade using risk-adjusted sizing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string' },
        price: { type: 'number' },
        method: {
          type: 'string',
          enum: ['fixed_fraction', 'volatility_target', 'kelly_criterion'],
        },
      },
      required: ['ticker', 'price'],
    },
  },
  {
    name: 'check_risk_limits',
    description: 'Check if a proposed trade passes all risk limits.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string' },
        shares: { type: 'number' },
        price: { type: 'number' },
        side: { type: 'string', enum: ['buy', 'sell'] },
      },
      required: ['ticker', 'shares', 'price', 'side'],
    },
  },
  {
    name: 'analyze_ticker',
    description: 'Perform deep analysis on a specific ticker: technical setup, trend, support/resistance.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string' },
        depth: { type: 'string', enum: ['quick', 'standard', 'deep'] },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'create_alert',
    description: 'Create a trading alert shown on the dashboard.',
    input_schema: {
      type: 'object' as const,
      properties: {
        severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
        title: { type: 'string' },
        message: { type: 'string' },
        ticker: { type: 'string', description: 'Related ticker (optional)' },
      },
      required: ['severity', 'title', 'message'],
    },
  },
];

const AGENT_TOOLS: Record<AgentRole, string[]> = {
  market_sentinel: ['get_market_data', 'get_market_sentiment', 'create_alert'],
  strategy_analyst: [
    'run_strategy_scan', 'get_strategy_info', 'get_market_data',
    'analyze_ticker', 'create_alert',
  ],
  risk_monitor: [
    'assess_portfolio_risk', 'check_risk_limits',
    'calculate_position_size', 'create_alert',
  ],
};

export function getToolsForAgent(role: AgentRole): Anthropic.Tool[] {
  const allowed = AGENT_TOOLS[role] ?? [];
  return TOOL_DEFINITIONS.filter((t) => allowed.includes(t.name));
}
