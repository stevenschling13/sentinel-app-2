/**
 * Type definitions for the Sentinel Agent Orchestrator (v2).
 * Six specialized trading agents working in sequence.
 */

/** Identifier for the six specialized trading agents. */
export type AgentRole =
  | 'market_sentinel'
  | 'strategy_analyst'
  | 'risk_monitor'
  | 'news_analyst'
  | 'execution_planner'
  | 'portfolio_manager';

/** Runtime status of an agent. */
export type AgentStatus = 'idle' | 'running' | 'error';

/** Configuration for an individual agent instance. */
export interface AgentConfig {
  /** Which trading role this agent fulfills. */
  role: AgentRole;
  /** Human-readable name shown in UI. */
  name: string;
  /** Brief description of what this agent does. */
  description: string;
  /** Whether the agent participates in trading cycles. */
  enabled: boolean;
  /** Minimum milliseconds between consecutive runs. */
  cooldownMs: number;
}

/** Result of a single agent execution. */
export interface AgentResult {
  /** Which agent produced this result. */
  role: AgentRole;
  /** Whether the agent completed without errors. */
  success: boolean;
  /** ISO 8601 timestamp of completion. */
  timestamp: string;
  /** Execution time in milliseconds. */
  durationMs: number;
  /** Agent output payload (typically the final text response). */
  data: unknown;
  /** Error message if `success` is false. */
  error?: string;
}

/** Snapshot of current market sentiment derived from index ETFs. */
export interface MarketSentiment {
  /** Overall market direction. */
  overall: 'bullish' | 'bearish' | 'neutral';
  /** Confidence score between 0 and 1. */
  confidence: number;
  /** Human-readable descriptions of the main market drivers. */
  drivers: string[];
  /** Per-sector sentiment breakdown. */
  sectors: Record<string, 'bullish' | 'bearish' | 'neutral'>;
}

/** Portfolio-level risk assessment returned by the risk monitor. */
export interface RiskAssessment {
  /** Current portfolio equity in dollars. */
  equity: number;
  /** Current drawdown from peak equity (0–1). */
  drawdown: number;
  /** Today's profit/loss in dollars. */
  dailyPnl: number;
  /** Whether trading is halted due to risk breaches. */
  halted: boolean;
  /** Active risk alerts. */
  alerts: RiskAlert[];
  /** Position concentration by ticker as a fraction of equity. */
  concentrations: Record<string, number>;
}

/** A single risk alert raised during portfolio assessment. */
export interface RiskAlert {
  /** Alert severity level. */
  severity: 'info' | 'warning' | 'critical';
  /** Name of the risk rule that fired. */
  rule: string;
  /** Human-readable description of the risk condition. */
  message: string;
  /** Recommended remediation action. */
  action: string;
}

/** Orchestrator runtime state exposed via the status API. */
export interface OrchestratorState {
  /** Current status of each agent. */
  agents: Record<AgentRole, AgentStatus>;
  /** ISO 8601 timestamp of each agent's last completed run. */
  lastRun: Record<AgentRole, string | null>;
  /** Total number of completed trading cycles. */
  cycleCount: number;
  /** Whether the orchestrator is halted due to risk limits. */
  halted: boolean;
  /** ISO 8601 timestamp of the most recent cycle completion. */
  lastCycleAt: string | null;
}
