/**
 * Agent Orchestrator (v2) — coordinates 3 core trading agents.
 *
 * Trading cycle (sequential):
 * 1. Market Sentinel → assess market conditions
 * 2. Strategy Analyst → generate signals
 * 3. Risk Monitor → check portfolio risk
 */

import { Agent } from './agent.js';
import { ToolExecutor } from './tool-executor.js';
import { EngineClient } from './engine-client.js';
import type { AgentConfig, AgentResult, AgentRole, OrchestratorState } from './types.js';
import {
  DEFAULT_AGENT_PROMPTS,
  DEFAULT_CYCLE_INTERVAL_MS,
  MARKET_SENTINEL_COOLDOWN_MS,
  STRATEGY_ANALYST_COOLDOWN_MS,
  RISK_MONITOR_COOLDOWN_MS,
} from './config.js';
import { logger } from './logger.js';
import { eventBus } from './event-bus.js';

const DEFAULT_CONFIGS: AgentConfig[] = [
  {
    role: 'market_sentinel',
    name: 'Market Sentinel',
    description: 'Monitors market conditions and detects significant events',
    enabled: true,
    cooldownMs: MARKET_SENTINEL_COOLDOWN_MS,
  },
  {
    role: 'strategy_analyst',
    name: 'Strategy Analyst',
    description: 'Runs trading strategies and recommends trades',
    enabled: true,
    cooldownMs: STRATEGY_ANALYST_COOLDOWN_MS,
  },
  {
    role: 'risk_monitor',
    name: 'Risk Monitor',
    description: 'Monitors portfolio risk and enforces limits',
    enabled: true,
    cooldownMs: RISK_MONITOR_COOLDOWN_MS,
  },
];

const CYCLE_SEQUENCE: AgentRole[] = ['market_sentinel', 'strategy_analyst', 'risk_monitor'];

export class Orchestrator {
  private agents: Map<AgentRole, Agent> = new Map();
  private state: OrchestratorState;
  private cycleInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options?: {
    apiKey?: string;
    engineUrl?: string;
    configs?: AgentConfig[];
    executor?: ToolExecutor;
  }) {
    const executor = options?.executor ?? new ToolExecutor(new EngineClient(options?.engineUrl));
    const configs = options?.configs ?? DEFAULT_CONFIGS;

    for (const config of configs) {
      const agent = new Agent(config, {
        apiKey: options?.apiKey,
        executor,
      });
      this.agents.set(config.role, agent);
    }

    this.state = {
      agents: Object.fromEntries(configs.map((c) => [c.role, 'idle'] as const)) as Record<
        AgentRole,
        'idle'
      >,
      lastRun: Object.fromEntries(configs.map((c) => [c.role, null] as const)) as Record<
        AgentRole,
        null
      >,
      cycleCount: 0,
      halted: false,
      lastCycleAt: null,
    };
  }

  get currentState(): OrchestratorState {
    return { ...this.state };
  }

  async runCycle(): Promise<AgentResult[]> {
    if (this.state.halted) {
      logger.warn('orchestrator.cycle.skipped', { reason: 'halted' });
      return [];
    }

    // Pre-flight check: is the engine reachable?
    const engineHealthy = await this.checkEngineHealth();
    if (!engineHealthy) {
      logger.warn('orchestrator.cycle.skipped', { reason: 'engine_unreachable' });
      eventBus
        .publish('cycle.skipped', {
          reason: 'engine_unreachable',
          timestamp: new Date().toISOString(),
        })
        .catch(() => {});
      return [];
    }

    this.state.cycleCount++;
    const results: AgentResult[] = [];
    logger.info('orchestrator.cycle.start', { cycleCount: this.state.cycleCount });
    eventBus
      .publish('cycle.started', {
        cycleCount: this.state.cycleCount,
        timestamp: new Date().toISOString(),
      })
      .catch(() => {});

    for (const role of CYCLE_SEQUENCE) {
      const result = await this.runAgent(
        role,
        DEFAULT_AGENT_PROMPTS[role] ?? `Execute ${role} workflow.`,
      );
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    this.state.lastCycleAt = new Date().toISOString();
    logger.info('orchestrator.cycle.complete', {
      cycleCount: this.state.cycleCount,
      successCount,
    });
    eventBus
      .publish('cycle.completed', {
        cycleCount: this.state.cycleCount,
        successCount,
        totalCount: results.length,
        timestamp: new Date().toISOString(),
      })
      .catch(() => {});
    return results;
  }

  async runAgent(role: AgentRole, prompt: string): Promise<AgentResult> {
    const agent = this.agents.get(role);
    if (!agent) {
      return {
        role,
        success: false,
        timestamp: new Date().toISOString(),
        durationMs: 0,
        data: null,
        error: `Agent '${role}' not found`,
      };
    }

    logger.info('agent.start', { role });
    this.state.agents[role] = 'running';
    eventBus
      .publish('agent.started', { role, timestamp: new Date().toISOString() })
      .catch(() => {});

    const result = await agent.run(prompt);

    this.state.agents[role] = result.success ? 'idle' : 'error';
    this.state.lastRun[role] = result.timestamp;

    if (result.success) {
      logger.info('agent.complete', { role, durationMs: result.durationMs });
    } else {
      logger.error('agent.failed', { role, error: result.error });
    }
    eventBus
      .publish('agent.completed', {
        role,
        success: result.success,
        durationMs: result.durationMs,
        timestamp: result.timestamp,
      })
      .catch(() => {});

    return result;
  }

  start(intervalMs = DEFAULT_CYCLE_INTERVAL_MS): void {
    if (this.cycleInterval) return;
    logger.info('orchestrator.start', { intervalMs });
    this.runCycle().catch(console.error);
    this.cycleInterval = setInterval(() => {
      this.runCycle().catch(console.error);
    }, intervalMs);
  }

  stop(): void {
    if (this.cycleInterval) {
      clearInterval(this.cycleInterval);
      this.cycleInterval = null;
      logger.info('orchestrator.stop');
    }
  }

  halt(reason: string): void {
    this.state.halted = true;
    this.stop();
    logger.error('orchestrator.halt', { reason });
    eventBus
      .publish('risk.alert', { severity: 'critical', rule: 'halt', message: reason })
      .catch(() => {});
  }

  resume(): void {
    this.state.halted = false;
    logger.info('orchestrator.resume');
  }

  private async checkEngineHealth(): Promise<boolean> {
    try {
      const url = process.env.ENGINE_URL ?? 'http://localhost:8000';
      const res = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  getAgentInfo() {
    return Array.from(this.agents.values()).map((agent) => ({
      role: agent.config.role,
      name: agent.config.name,
      description: agent.config.description,
      status: this.state.agents[agent.config.role],
      lastRun: this.state.lastRun[agent.config.role],
      enabled: agent.config.enabled,
    }));
  }
}
