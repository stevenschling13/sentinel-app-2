import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPublish } = vi.hoisted(() => ({
  mockPublish: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@upstash/redis', () => {
  class MockRedis {
    publish = mockPublish;
    constructor() {}
  }
  return { Redis: MockRedis };
});

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { EventBus } from '../event-bus.js';
import { Redis } from '@upstash/redis';

describe('EventBus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates Redis client when url and token provided', () => {
      const bus = new EventBus('https://redis.test', 'test-token');

      // Verify the bus can publish (redis was created)
      expect(bus).toBeDefined();
    });

    it('sets redis to null when url is missing', () => {
      const bus = new EventBus(undefined, 'test-token');

      // publish should be a no-op
      expect(
        bus.publish('cycle.started', { cycleCount: 1, timestamp: '' }),
      ).resolves.toBeUndefined();
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('sets redis to null when token is missing', () => {
      const bus = new EventBus('https://redis.test', undefined);

      expect(
        bus.publish('cycle.started', { cycleCount: 1, timestamp: '' }),
      ).resolves.toBeUndefined();
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('sets redis to null when both are missing', () => {
      const bus = new EventBus();

      expect(
        bus.publish('cycle.started', { cycleCount: 1, timestamp: '' }),
      ).resolves.toBeUndefined();
      expect(mockPublish).not.toHaveBeenCalled();
    });
  });

  describe('publish()', () => {
    it('publishes JSON-serialized data to Redis channel', async () => {
      const bus = new EventBus('https://redis.test', 'test-token');

      const data = { cycleCount: 5, timestamp: '2024-01-01T00:00:00Z' };
      await bus.publish('cycle.started', data);

      expect(mockPublish).toHaveBeenCalledWith('cycle.started', JSON.stringify(data));
    });

    it('publishes different event types correctly', async () => {
      const bus = new EventBus('https://redis.test', 'test-token');

      await bus.publish('agent.completed', {
        role: 'market_sentinel',
        success: true,
        durationMs: 150,
        timestamp: '2024-01-01T00:00:00Z',
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'agent.completed',
        expect.stringContaining('market_sentinel'),
      );
    });

    it('publishes signal.generated events', async () => {
      const bus = new EventBus('https://redis.test', 'test-token');

      await bus.publish('signal.generated', {
        ticker: 'AAPL',
        direction: 'long',
        strength: 0.85,
        strategy: 'momentum',
      });

      expect(mockPublish).toHaveBeenCalledOnce();
      const payload = JSON.parse(mockPublish.mock.calls[0][1]);
      expect(payload.ticker).toBe('AAPL');
      expect(payload.strength).toBe(0.85);
    });

    it('is a no-op when Redis is not configured', async () => {
      const bus = new EventBus();

      await bus.publish('cycle.started', { cycleCount: 1, timestamp: '' });

      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('serializes complex event payloads', async () => {
      const bus = new EventBus('https://redis.test', 'test-token');

      await bus.publish('context.updated', {
        cycleNumber: 3,
        startedAt: '2024-01-01T00:00:00Z',
        agentCount: 2,
        summaries: [
          {
            role: 'market_sentinel',
            success: true,
            summary: 'Bullish',
            durationMs: 100,
            timestamp: '2024-01-01T00:00:00Z',
            highlights: { key: 'value' },
          },
        ],
      });

      expect(mockPublish).toHaveBeenCalledOnce();
      const payload = JSON.parse(mockPublish.mock.calls[0][1]);
      expect(payload.cycleNumber).toBe(3);
      expect(payload.summaries).toHaveLength(1);
    });
  });

  describe('subscribe()', () => {
    it('is a no-op placeholder (does not throw)', async () => {
      const bus = new EventBus('https://redis.test', 'test-token');
      const handler = vi.fn();

      await expect(bus.subscribe('test.channel', handler)).resolves.toBeUndefined();
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
