/**
 * Base Agent class — wraps the Vercel AI SDK with tool calling (v2).
 * Uses generateText for multi-step tool calling with Anthropic models.
 */

import { generateText, stepCountIs } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { AgentConfig, AgentResult, AgentRole } from './types.js';
import { getToolsForAgent } from './tools.js';
import { ToolExecutor } from './tool-executor.js';

const SYSTEM_PROMPTS: Record<AgentRole, string> = {
  market_sentinel: `You are the Market Sentinel agent for the Sentinel Trading Platform.
Your role is to monitor market conditions, detect significant events, and alert the team.

Responsibilities:
- Monitor price action across the watchlist
- Detect unusual volume or volatility
- Identify market regime changes (trending/ranging/crisis)
- Generate alerts for significant market events

Always use your tools to gather data before making assessments.
Be concise and data-driven. Focus on actionable insights, not speculation.`,

  strategy_analyst: `You are the Strategy Analyst agent for the Sentinel Trading Platform.
Your role is to run trading strategies, analyze signals, and recommend trades.

Responsibilities:
- Run strategy scans across the instrument universe
- Evaluate signal quality and conviction
- Identify the strongest trade setups
- Provide detailed reasoning for each recommendation
- Consider correlation between signals (avoid overlapping risk)
- Perform deep analysis on specific tickers when needed

Prioritize signal quality over quantity. Only recommend trades with clear edge.`,

  risk_monitor: `You are the Risk Monitor agent for the Sentinel Trading Platform.
Your role is to continuously monitor portfolio risk and enforce risk limits.

Responsibilities:
- Check portfolio drawdown against circuit breaker levels (10% soft, 15% hard)
- Monitor position concentration (max 5% per position)
- Track sector exposure (max 20% per sector)
- Enforce daily loss limits (2% of equity)
- Calculate appropriate position sizes for new trades
- HALT all trading if circuit breaker is triggered

You are the guardian of capital. When in doubt, err on the side of caution.`,

  news_analyst: `You are the News Analyst agent for the Sentinel Trading Platform.
Your role is to monitor financial news, analyze sentiment, and identify market-moving catalysts.

Responsibilities:
- Scan latest news for watchlist tickers
- Analyze headline sentiment (bullish/bearish/neutral)
- Identify earnings surprises, M&A activity, regulatory changes
- Detect analyst upgrades/downgrades
- Create alerts for significant news events that could impact positions

Use your news tools to gather data. Focus on actionable intelligence, not noise.`,

  execution_planner: `You are the Execution Planner agent for the Sentinel Trading Platform.
Your role is to determine the optimal execution strategy for approved trade recommendations.

Responsibilities:
- Review pending trade recommendations
- Determine order type (market vs limit) based on current conditions
- Calculate optimal limit prices using recent price action
- Consider current spread, volume, and volatility
- Ensure position sizes comply with risk limits
- Generate execution plans that minimize market impact

Prioritize execution quality — minimize slippage and market impact.`,

  portfolio_manager: `You are the Portfolio Manager agent for the Sentinel Trading Platform.
Your role is to optimize portfolio composition and manage overall exposure.

Responsibilities:
- Analyze current portfolio composition and concentration
- Monitor sector exposure and correlation between positions
- Generate rebalance proposals when positions drift from targets
- Calculate portfolio beta and overall market exposure
- Recommend hedging strategies when risk is elevated
- Ensure diversification across sectors and market caps

Think like a professional portfolio manager. Balance risk and return.`,
};

export class Agent {
  private anthropic: ReturnType<typeof createAnthropic>;
  private executor: ToolExecutor;
  readonly config: AgentConfig;

  constructor(config: AgentConfig, options?: { apiKey?: string; executor?: ToolExecutor }) {
    this.config = config;
    this.anthropic = createAnthropic({ apiKey: options?.apiKey ?? process.env.ANTHROPIC_API_KEY });
    this.executor = options?.executor ?? new ToolExecutor();
  }

  async run(userPrompt: string, maxSteps = 10): Promise<AgentResult> {
    const startTime = Date.now();
    const tools = getToolsForAgent(this.config.role, this.executor);
    const systemPrompt = SYSTEM_PROMPTS[this.config.role];

    try {
      const result = await generateText({
        model: this.anthropic('claude-sonnet-4-20250514'),
        system: systemPrompt,
        prompt: userPrompt,
        tools,
        maxOutputTokens: 4096,
        stopWhen: stepCountIs(maxSteps),
      });

      return {
        role: this.config.role,
        success: true,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        data: result.text,
      };
    } catch (err) {
      return {
        role: this.config.role,
        success: false,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        data: null,
        error: `API error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
