import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from '../orchestrator.js';
import type { AgentConfig } from '../types.js';

// Mock the Agent class
vi.mock('../agent.js', () => {
  const Agent = function (this: any, config: any) {
    this.config = config;
    this.run = vi.fn().mockResolvedValue({
      role: config.role,
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: 100,
      data: 'test result',
    });
  };
  return { Agent };
});

// Mock the ToolExecutor
vi.mock('../tool-executor.js', () => {
  const ToolExecutor = function (this: any) {};
  return { ToolExecutor };
});

// Mock the EngineClient
vi.mock('../engine-client.js', () => {
  const EngineClient = function (this: any) {};
  return { EngineClient };
});

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch so the orchestrator's engine health pre-flight check succeeds
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    orchestrator = new Orchestrator({ apiKey: 'test-key' });
  });

  it('initializes with default agents', () => {
    const state = orchestrator.currentState;
    expect(state.agents.market_sentinel).toBe('idle');
    expect(state.agents.news_analyst).toBe('idle');
    expect(state.agents.strategy_analyst).toBe('idle');
    expect(state.agents.risk_monitor).toBe('idle');
    expect(state.agents.execution_planner).toBe('idle');
    expect(state.agents.portfolio_manager).toBe('idle');
    expect(state.cycleCount).toBe(0);
    expect(state.halted).toBe(false);
  });

  it('runs a full cycle sequentially', async () => {
    const results = await orchestrator.runCycle();
    expect(results).toHaveLength(6);
    expect(results[0].role).toBe('market_sentinel');
    expect(results[1].role).toBe('news_analyst');
    expect(results[2].role).toBe('strategy_analyst');
    expect(results[3].role).toBe('risk_monitor');
    expect(results[4].role).toBe('execution_planner');
    expect(results[5].role).toBe('portfolio_manager');
    expect(orchestrator.currentState.cycleCount).toBe(1);
  });

  it('skips cycle when halted', async () => {
    orchestrator.halt('test halt');
    const results = await orchestrator.runCycle();
    expect(results).toHaveLength(0);
    expect(orchestrator.currentState.halted).toBe(true);
  });

  it('resumes after halt', () => {
    orchestrator.halt('test');
    expect(orchestrator.currentState.halted).toBe(true);
    orchestrator.resume();
    expect(orchestrator.currentState.halted).toBe(false);
  });

  it('returns agent info', () => {
    const info = orchestrator.getAgentInfo();
    expect(info).toHaveLength(6);
    expect(info[0].role).toBe('market_sentinel');
    expect(info[0].enabled).toBe(true);
  });

  it('handles missing agent gracefully', async () => {
    const result = await orchestrator.runAgent('market_sentinel' as any, 'test');
    expect(result.success).toBe(true);
  });

  it('starts and stops interval', () => {
    vi.useFakeTimers();
    orchestrator.start(60000);
    orchestrator.stop();
    vi.useRealTimers();
  });

  it('increments cycle count on each run', async () => {
    await orchestrator.runCycle();
    await orchestrator.runCycle();
    expect(orchestrator.currentState.cycleCount).toBe(2);
  });
});
