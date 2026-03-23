/**
 * CycleContext — accumulates findings from each agent during a cycle.
 * Passed to each subsequent agent so they can see prior results.
 */

export interface AgentSummary {
  role: string;
  success: boolean;
  summary: string;
  durationMs: number;
  timestamp: string;
  /** Structured data extracted from agent output (signals, alerts, etc.) */
  highlights: Record<string, unknown>;
}

export class CycleContext {
  readonly cycleNumber: number;
  readonly startedAt: string;
  private summaries: AgentSummary[] = [];

  constructor(cycleNumber: number) {
    this.cycleNumber = cycleNumber;
    this.startedAt = new Date().toISOString();
  }

  /** Record an agent's result after it completes. */
  addResult(summary: AgentSummary): void {
    this.summaries.push(summary);
  }

  /** Get all summaries from agents that ran before the given role. */
  getPriorContext(currentRole: string): AgentSummary[] {
    return this.summaries.filter((s) => s.role !== currentRole);
  }

  /** Format prior context as a prompt section for injection into agent prompts. */
  formatForPrompt(currentRole: string): string {
    const prior = this.getPriorContext(currentRole);
    if (prior.length === 0) return '';

    const sections = prior.map((s) => {
      const status = s.success ? '✅' : '❌';
      return `### ${s.role} ${status}\n${s.summary}`;
    });

    return `\n\n---\n## Prior Agent Findings (Cycle #${this.cycleNumber})\nThe following agents have already run this cycle. Use their findings to inform your analysis.\n\n${sections.join('\n\n')}`;
  }

  /** Get a snapshot for event bus / logging. */
  toSnapshot(): {
    cycleNumber: number;
    startedAt: string;
    agentCount: number;
    summaries: AgentSummary[];
  } {
    return {
      cycleNumber: this.cycleNumber,
      startedAt: this.startedAt,
      agentCount: this.summaries.length,
      summaries: [...this.summaries],
    };
  }
}
