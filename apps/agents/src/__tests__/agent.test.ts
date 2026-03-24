import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external dependencies before imports
vi.mock('ai', () => ({
  generateText: vi.fn(),
  stepCountIs: vi.fn().mockReturnValue('stop-condition'),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn().mockReturnValue(vi.fn().mockReturnValue('mock-model')),
}));

vi.mock('../tools.js', () => ({
  getToolsForAgent: vi.fn().mockReturnValue({ mock_tool: {} }),
}));

vi.mock('../tool-executor.js', () => {
  const ToolExecutor = function (this: any) {};
  return { ToolExecutor };
});

import { Agent } from '../agent.js';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { getToolsForAgent } from '../tools.js';
import type { AgentConfig } from '../types.js';

const mockGenerateText = vi.mocked(generateText);

function makeConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    role: 'market_sentinel',
    name: 'Market Sentinel',
    description: 'Monitors market conditions',
    enabled: true,
    cooldownMs: 300_000,
    ...overrides,
  };
}

describe('Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateText.mockResolvedValue({ text: 'AI response text' } as any);
  });

  it('initializes with provided config', () => {
    const config = makeConfig();
    const agent = new Agent(config, { apiKey: 'test-key' });

    expect(agent.config).toBe(config);
    expect(agent.config.role).toBe('market_sentinel');
    expect(agent.config.enabled).toBe(true);
  });

  it('creates Anthropic client with provided API key', () => {
    new Agent(makeConfig(), { apiKey: 'my-api-key' });

    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: 'my-api-key' });
  });

  it('falls back to env var when no API key provided', () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'env-api-key';

    new Agent(makeConfig());

    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: 'env-api-key' });
    process.env.ANTHROPIC_API_KEY = saved;
  });

  it('run() calls generateText with correct parameters', async () => {
    const config = makeConfig({ role: 'risk_monitor' });
    const agent = new Agent(config, { apiKey: 'test-key' });

    await agent.run('Check portfolio risk');

    expect(mockGenerateText).toHaveBeenCalledOnce();
    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs).toMatchObject({
      model: 'mock-model',
      prompt: 'Check portfolio risk',
      maxOutputTokens: 4096,
    });
    // System prompt should be for risk_monitor role
    expect(callArgs.system).toContain('Risk Monitor');
    expect(callArgs.system).toContain('guardian of capital');
  });

  it('run() returns success result with AI response', async () => {
    mockGenerateText.mockResolvedValue({ text: 'Market is bullish' } as any);
    const agent = new Agent(makeConfig(), { apiKey: 'test-key' });

    const result = await agent.run('Scan markets');

    expect(result.success).toBe(true);
    expect(result.role).toBe('market_sentinel');
    expect(result.data).toBe('Market is bullish');
    expect(result.timestamp).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it('run() returns error result when AI SDK throws', async () => {
    mockGenerateText.mockRejectedValue(new Error('Rate limit exceeded'));
    const agent = new Agent(makeConfig(), { apiKey: 'test-key' });

    const result = await agent.run('Scan markets');

    expect(result.success).toBe(false);
    expect(result.role).toBe('market_sentinel');
    expect(result.data).toBeNull();
    expect(result.error).toBe('API error: Rate limit exceeded');
  });

  it('run() handles non-Error throws gracefully', async () => {
    mockGenerateText.mockRejectedValue('string error');
    const agent = new Agent(makeConfig(), { apiKey: 'test-key' });

    const result = await agent.run('Scan markets');

    expect(result.success).toBe(false);
    expect(result.error).toBe('API error: string error');
  });

  it('run() uses role-specific system prompt for each agent role', async () => {
    const roles = [
      { role: 'market_sentinel' as const, keyword: 'Market Sentinel' },
      { role: 'strategy_analyst' as const, keyword: 'Strategy Analyst' },
      { role: 'risk_monitor' as const, keyword: 'Risk Monitor' },
      { role: 'news_analyst' as const, keyword: 'News Analyst' },
      { role: 'execution_planner' as const, keyword: 'Execution Planner' },
      { role: 'portfolio_manager' as const, keyword: 'Portfolio Manager' },
    ];

    for (const { role, keyword } of roles) {
      mockGenerateText.mockClear();
      const agent = new Agent(makeConfig({ role }), { apiKey: 'test-key' });
      await agent.run('test');

      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.system).toContain(keyword);
    }
  });

  it('run() passes agent tools from getToolsForAgent', async () => {
    const agent = new Agent(makeConfig(), { apiKey: 'test-key' });

    await agent.run('test');

    expect(getToolsForAgent).toHaveBeenCalledWith('market_sentinel', expect.anything());
    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.tools).toEqual({ mock_tool: {} });
  });

  it('run() respects custom maxSteps parameter', async () => {
    const agent = new Agent(makeConfig(), { apiKey: 'test-key' });

    await agent.run('test', 5);

    expect(mockGenerateText).toHaveBeenCalledOnce();
    // stepCountIs should have been called with 5
    const { stepCountIs } = await import('ai');
    expect(stepCountIs).toHaveBeenCalledWith(5);
  });

  it('run() records duration in result', async () => {
    mockGenerateText.mockImplementation(async () => {
      // Simulate some processing time
      return { text: 'done' } as any;
    });
    const agent = new Agent(makeConfig(), { apiKey: 'test-key' });

    const result = await agent.run('test');

    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
