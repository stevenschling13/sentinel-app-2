/**
 * Type definitions for the Sentinel Agent Orchestrator (v2).
 * Simplified to 3 core trading agents.
 */

export type AgentRole = 'market_sentinel' | 'strategy_analyst' | 'risk_monitor';

export type AgentStatus = 'idle' | 'running' | 'error';

export interface AgentConfig {
  role: AgentRole;
  name: string;
  description: string;
  enabled: boolean;
  cooldownMs: number;
}

export interface AgentResult {
  role: AgentRole;
  success: boolean;
  timestamp: string;
  durationMs: number;
  data: unknown;
  error?: string;
}

export interface MarketSentiment {
  overall: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  drivers: string[];
  sectors: Record<string, 'bullish' | 'bearish' | 'neutral'>;
}

export interface RiskAssessment {
  equity: number;
  drawdown: number;
  dailyPnl: number;
  halted: boolean;
  alerts: RiskAlert[];
  concentrations: Record<string, number>;
}

export interface RiskAlert {
  severity: 'info' | 'warning' | 'critical';
  rule: string;
  message: string;
  action: string;
}

export interface OrchestratorState {
  agents: Record<AgentRole, AgentStatus>;
  lastRun: Record<AgentRole, string | null>;
  cycleCount: number;
  halted: boolean;
  lastCycleAt: string | null;
}
