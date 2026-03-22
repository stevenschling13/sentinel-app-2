/**
 * Base Agent class — wraps the Claude API with tool calling (v2).
 * Simplified: no WAT workflow loading, hardcoded system prompts.
 */

import Anthropic from '@anthropic-ai/sdk';
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
};

export class Agent {
  private client: Anthropic;
  private executor: ToolExecutor;
  readonly config: AgentConfig;

  constructor(
    config: AgentConfig,
    options?: { apiKey?: string; executor?: ToolExecutor },
  ) {
    this.config = config;
    this.client = new Anthropic({ apiKey: options?.apiKey ?? process.env.ANTHROPIC_API_KEY });
    this.executor = options?.executor ?? new ToolExecutor();
  }

  async run(userPrompt: string, maxTurns = 10): Promise<AgentResult> {
    const startTime = Date.now();
    const tools = getToolsForAgent(this.config.role);
    const systemPrompt = SYSTEM_PROMPTS[this.config.role];
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];

    let lastTextResponse = '';

    for (let turn = 0; turn < maxTurns; turn++) {
      let response: Anthropic.Message;
      try {
        response = await this.client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          tools,
          messages,
        });
      } catch (err) {
        return {
          role: this.config.role, success: false,
          timestamp: new Date().toISOString(), durationMs: Date.now() - startTime,
          data: null, error: `API error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      for (const block of response.content) {
        if (block.type === 'text') lastTextResponse = block.text;
      }

      if (response.stop_reason === 'end_turn') break;

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      if (toolUseBlocks.length === 0) break;

      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolBlock of toolUseBlocks) {
        const result = await this.executor.execute(
          toolBlock.name, toolBlock.input as Record<string, unknown>,
        );
        toolResults.push({ type: 'tool_result', tool_use_id: toolBlock.id, content: result });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    return {
      role: this.config.role, success: true,
      timestamp: new Date().toISOString(), durationMs: Date.now() - startTime,
      data: lastTextResponse,
    };
  }
}
