import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger and event-bus before imports
vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../event-bus.js', () => ({
  eventBus: { publish: vi.fn().mockResolvedValue(undefined) },
}));

const mockGetRecommendation = vi.fn();
const mockListRecommendations = vi.fn();
const mockMarkFilled = vi.fn().mockResolvedValue(undefined);
const mockMarkRiskBlocked = vi.fn().mockResolvedValue(undefined);

vi.mock('../recommendations-store.js', () => ({
  getRecommendation: (...args: any[]) => mockGetRecommendation(...args),
  listRecommendations: (...args: any[]) => mockListRecommendations(...args),
  markFilled: (...args: any[]) => mockMarkFilled(...args),
  markRiskBlocked: (...args: any[]) => mockMarkRiskBlocked(...args),
}));

import { ExecutionPipeline } from '../execution-pipeline.js';
import { eventBus } from '../event-bus.js';

function mockRec(overrides?: Record<string, unknown>) {
  return {
    id: 'rec-1',
    agent_role: 'strategy_analyst',
    ticker: 'AAPL',
    side: 'buy' as const,
    quantity: 10,
    order_type: 'market' as const,
    limit_price: undefined,
    status: 'approved',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMockEngine(overrides?: Record<string, any>) {
  return {
    getQuotes: vi.fn().mockResolvedValue([{ ticker: 'AAPL', close: 150 }]),
    getAccount: vi.fn().mockResolvedValue({
      cash: 50_000,
      equity: 100_000,
      positions_value: 50_000,
      initial_capital: 100_000,
    }),
    getPositions: vi.fn().mockResolvedValue([]),
    preTradeCheck: vi.fn().mockResolvedValue({
      allowed: true,
      action: 'allow',
      reason: 'OK',
      adjusted_shares: null,
    }),
    submitOrder: vi.fn().mockResolvedValue({
      order_id: 'ord-123',
      status: 'filled',
      filled_price: 150,
    }),
    ...overrides,
  };
}

describe('ExecutionPipeline', () => {
  let pipeline: ExecutionPipeline;
  let engine: ReturnType<typeof makeMockEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTO_EXECUTE = 'true';
    process.env.MAX_ORDERS_PER_CYCLE = '3';
    process.env.MAX_ORDER_VALUE = '5000';
    process.env.TRADING_MODE = 'paper';
    engine = makeMockEngine();
    pipeline = new ExecutionPipeline(engine as any);
  });

  describe('executeRecommendation()', () => {
    it('executes an approved recommendation successfully', async () => {
      mockGetRecommendation.mockResolvedValue(mockRec());

      const result = await pipeline.executeRecommendation('rec-1');

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('ord-123');
    });

    it('returns failure when recommendation not found', async () => {
      mockGetRecommendation.mockResolvedValue(null);

      const result = await pipeline.executeRecommendation('rec-missing');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Recommendation not found');
    });

    it('returns failure when recommendation status is not approved', async () => {
      mockGetRecommendation.mockResolvedValue(mockRec({ status: 'pending' }));

      const result = await pipeline.executeRecommendation('rec-1');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Invalid status: pending');
    });

    it('fetches current price when limit_price is not set', async () => {
      mockGetRecommendation.mockResolvedValue(mockRec({ limit_price: undefined }));

      await pipeline.executeRecommendation('rec-1');

      expect(engine.getQuotes).toHaveBeenCalledWith(['AAPL']);
    });

    it('uses limit_price when set instead of fetching quotes', async () => {
      mockGetRecommendation.mockResolvedValue(mockRec({ limit_price: 145 }));

      await pipeline.executeRecommendation('rec-1');

      expect(engine.getQuotes).not.toHaveBeenCalled();
    });

    it('rejects when order value exceeds maxOrderValue', async () => {
      // quantity=10, price=150 → orderValue=$1500 which is under $5000 default
      // Set larger quantity to exceed
      mockGetRecommendation.mockResolvedValue(mockRec({ quantity: 100, limit_price: 150 }));

      const result = await pipeline.executeRecommendation('rec-1');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('exceeds limit');
      expect(mockMarkRiskBlocked).toHaveBeenCalledWith('rec-1', expect.stringContaining('exceeds'));
    });

    it('blocks when risk check fails', async () => {
      mockGetRecommendation.mockResolvedValue(mockRec({ limit_price: 150, quantity: 5 }));
      engine.preTradeCheck.mockResolvedValue({
        allowed: false,
        action: 'block',
        reason: 'Position too concentrated',
        adjusted_shares: null,
      });

      const result = await pipeline.executeRecommendation('rec-1');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Risk check blocked');
      expect(result.reason).toContain('Position too concentrated');
      expect(mockMarkRiskBlocked).toHaveBeenCalled();
    });

    it('uses adjusted_shares from risk check when provided', async () => {
      mockGetRecommendation.mockResolvedValue(mockRec({ limit_price: 150, quantity: 10 }));
      engine.preTradeCheck.mockResolvedValue({
        allowed: true,
        action: 'allow',
        reason: 'OK',
        adjusted_shares: 5,
      });

      await pipeline.executeRecommendation('rec-1');

      expect(engine.submitOrder).toHaveBeenCalledWith(expect.objectContaining({ shares: 5 }));
    });

    it('calls markFilled after successful order submission', async () => {
      mockGetRecommendation.mockResolvedValue(mockRec({ limit_price: 150, quantity: 5 }));

      await pipeline.executeRecommendation('rec-1');

      expect(mockMarkFilled).toHaveBeenCalledWith('rec-1', 'ord-123');
    });

    it('publishes order.submitted event on success', async () => {
      mockGetRecommendation.mockResolvedValue(mockRec({ limit_price: 150, quantity: 5 }));

      await pipeline.executeRecommendation('rec-1');

      expect(eventBus.publish).toHaveBeenCalledWith('order.submitted', {
        ticker: 'AAPL',
        side: 'buy',
        quantity: 5,
      });
    });

    it('handles engine error during execution', async () => {
      mockGetRecommendation.mockResolvedValue(mockRec({ limit_price: 150, quantity: 5 }));
      engine.getAccount.mockRejectedValue(new Error('Connection refused'));

      const result = await pipeline.executeRecommendation('rec-1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Connection refused');
      expect(mockMarkRiskBlocked).toHaveBeenCalledWith(
        'rec-1',
        expect.stringContaining('Connection refused'),
      );
    });

    it('handles quote fetch failure gracefully (falls back to price=0)', async () => {
      mockGetRecommendation.mockResolvedValue(mockRec({ limit_price: undefined, quantity: 5 }));
      engine.getQuotes.mockRejectedValue(new Error('No quotes'));

      // price=0, orderValue=0, which is ≤ maxOrderValue so it proceeds
      const result = await pipeline.executeRecommendation('rec-1');

      // Still proceeds with risk check
      expect(engine.getAccount).toHaveBeenCalled();
    });
  });

  describe('processApprovedRecommendations()', () => {
    it('does nothing when no approved recommendations', async () => {
      mockListRecommendations.mockResolvedValue([]);

      await pipeline.processApprovedRecommendations();

      expect(mockGetRecommendation).not.toHaveBeenCalled();
    });

    it('processes up to maxOrdersPerCycle recommendations', async () => {
      const recs = [
        mockRec({ id: 'rec-1' }),
        mockRec({ id: 'rec-2' }),
        mockRec({ id: 'rec-3' }),
        mockRec({ id: 'rec-4' }),
      ];
      mockListRecommendations.mockResolvedValue(recs);
      mockGetRecommendation.mockImplementation(
        async (id: string) => recs.find((r) => r.id === id) ?? null,
      );

      await pipeline.processApprovedRecommendations();

      // maxOrdersPerCycle=3, so only 3 processed
      expect(mockGetRecommendation).toHaveBeenCalledTimes(3);
    });

    it('passes "approved" status filter to listRecommendations', async () => {
      mockListRecommendations.mockResolvedValue([]);

      await pipeline.processApprovedRecommendations();

      expect(mockListRecommendations).toHaveBeenCalledWith('approved');
    });
  });

  describe('currentConfig', () => {
    it('returns a copy of the config', () => {
      const config = pipeline.currentConfig;
      expect(config.autoExecute).toBe(true);
      expect(config.maxOrdersPerCycle).toBe(3);
      expect(config.maxOrderValue).toBe(5000);
      expect(config.tradingMode).toBe('paper');
    });
  });
});
