/**
 * Cross-service event bus using Upstash Redis REST-based pub/sub.
 * Publishes orchestrator events (cycle.started, cycle.completed, agent.result, etc.)
 * for consumption by the engine, dashboard, and other services.
 */

import { Redis } from '@upstash/redis';
import { logger } from './logger.js';

// ── Event payload types ─────────────────────────────────────

export interface CycleStartedEvent {
  cycleCount: number;
  timestamp: string;
}

export interface CycleSkippedEvent {
  reason: string;
  timestamp: string;
}

export interface CycleCompletedEvent {
  cycleCount: number;
  successCount: number;
  totalCount: number;
  timestamp: string;
}

export interface AgentStartedEvent {
  role: string;
  timestamp: string;
}

export interface AgentCompletedEvent {
  role: string;
  success: boolean;
  durationMs: number;
  timestamp: string;
}

export interface SignalGeneratedEvent {
  ticker: string;
  direction: string;
  strength: number;
  strategy: string;
}

export interface RiskAlertEvent {
  severity: string;
  rule: string;
  message: string;
}

export interface OrderSubmittedEvent {
  ticker: string;
  side: string;
  quantity: number;
}

export interface ContextUpdatedEvent {
  cycleNumber: number;
  startedAt: string;
  agentCount: number;
  summaries: Array<{
    role: string;
    success: boolean;
    summary: string;
    durationMs: number;
    timestamp: string;
    highlights: Record<string, unknown>;
  }>;
}

export type EventMap = {
  'cycle.started': CycleStartedEvent;
  'cycle.skipped': CycleSkippedEvent;
  'cycle.completed': CycleCompletedEvent;
  'agent.started': AgentStartedEvent;
  'agent.completed': AgentCompletedEvent;
  'signal.generated': SignalGeneratedEvent;
  'risk.alert': RiskAlertEvent;
  'order.submitted': OrderSubmittedEvent;
  'context.updated': ContextUpdatedEvent;
};

// ── EventBus class ──────────────────────────────────────────

export class EventBus {
  private redis: Redis | null;

  constructor(url?: string, token?: string) {
    if (url && token) {
      this.redis = new Redis({ url, token });
      logger.info('event-bus.connected', { url: url.replace(/\/\/.*@/, '//<redacted>@') });
    } else {
      this.redis = null;
      logger.warn('event-bus.disabled', {
        reason: 'UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set',
      });
    }
  }

  /** Publish a JSON payload to a Redis channel. No-op if Redis is not configured. */
  async publish<K extends keyof EventMap>(channel: K, data: EventMap[K]): Promise<void> {
    if (!this.redis) return;
    await this.redis.publish(channel, JSON.stringify(data));
  }

  /** Subscribe placeholder for future polling-based consumption. */
  async subscribe(channel: string, handler: (data: unknown) => void): Promise<void> {
    // Upstash REST API does not support persistent subscriptions.
    // This is a placeholder for future polling or webhook-based consumption.
    logger.info('event-bus.subscribe.noop', { channel });
    void handler;
  }
}

// ── Singleton ───────────────────────────────────────────────

export const eventBus = new EventBus(
  process.env.UPSTASH_REDIS_REST_URL,
  process.env.UPSTASH_REDIS_REST_TOKEN,
);
