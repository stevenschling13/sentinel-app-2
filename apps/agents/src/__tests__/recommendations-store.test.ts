import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build a chainable mock for Supabase query builder
function createChainableMock(resolveValue: { data: any; error: any }) {
  const chain: any = {};
  const methods = ['from', 'select', 'insert', 'update', 'eq', 'order', 'limit', 'single'];
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  // The terminal call returns the promise
  chain.single = vi.fn().mockResolvedValue(resolveValue);
  // For non-single calls, make the chain awaitable
  chain.then = (resolve: any, reject: any) => Promise.resolve(resolveValue).then(resolve, reject);
  chain.limit = vi.fn().mockImplementation(() => {
    const awaitable = { ...chain, then: chain.then };
    return awaitable;
  });
  return chain;
}

let mockChain: any;

vi.mock('../supabase-client.js', () => ({
  getSupabaseClient: vi.fn(() => mockChain),
}));

import {
  createRecommendation,
  listRecommendations,
  getRecommendation,
  atomicApprove,
  markFilled,
  markRiskBlocked,
  rejectRecommendation,
  createAlert,
  listAlerts,
} from '../recommendations-store.js';

describe('RecommendationsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createRecommendation()', () => {
    it('inserts a recommendation and returns it', async () => {
      const created = {
        id: 'rec-1',
        agent_role: 'strategy_analyst',
        ticker: 'AAPL',
        side: 'buy',
        quantity: 10,
        order_type: 'market',
        status: 'pending',
        created_at: '2024-01-01T00:00:00Z',
      };
      mockChain = createChainableMock({ data: created, error: null });

      const result = await createRecommendation({
        agent_role: 'strategy_analyst',
        ticker: 'AAPL',
        side: 'buy',
        quantity: 10,
        order_type: 'market',
      });

      expect(result).toEqual(created);
      expect(mockChain.from).toHaveBeenCalledWith('agent_recommendations');
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ ticker: 'AAPL', status: 'pending' }),
      );
    });

    it('throws on Supabase error', async () => {
      mockChain = createChainableMock({ data: null, error: { message: 'Insert failed' } });

      await expect(
        createRecommendation({
          agent_role: 'strategy_analyst',
          ticker: 'AAPL',
          side: 'buy',
          quantity: 10,
          order_type: 'market',
        }),
      ).rejects.toThrow('Insert failed');
    });
  });

  describe('listRecommendations()', () => {
    it('returns list of recommendations', async () => {
      const recs = [{ id: 'rec-1' }, { id: 'rec-2' }];
      mockChain = createChainableMock({ data: recs, error: null });

      const result = await listRecommendations();

      expect(result).toEqual(recs);
      expect(mockChain.from).toHaveBeenCalledWith('agent_recommendations');
    });

    it('filters by status when provided', async () => {
      mockChain = createChainableMock({ data: [], error: null });

      await listRecommendations('approved');

      expect(mockChain.eq).toHaveBeenCalledWith('status', 'approved');
    });

    it('does not filter when status is "all"', async () => {
      mockChain = createChainableMock({ data: [], error: null });

      await listRecommendations('all');

      // eq should not be called with status filter
      expect(mockChain.eq).not.toHaveBeenCalledWith('status', 'all');
    });

    it('returns empty array when data is null', async () => {
      mockChain = createChainableMock({ data: null, error: null });

      const result = await listRecommendations();

      expect(result).toEqual([]);
    });

    it('throws on Supabase error', async () => {
      mockChain = createChainableMock({ data: null, error: { message: 'Query failed' } });

      await expect(listRecommendations()).rejects.toThrow('Query failed');
    });
  });

  describe('getRecommendation()', () => {
    it('returns a single recommendation by id', async () => {
      const rec = { id: 'rec-1', ticker: 'AAPL' };
      mockChain = createChainableMock({ data: rec, error: null });

      const result = await getRecommendation('rec-1');

      expect(result).toEqual(rec);
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'rec-1');
    });

    it('returns null when not found (PGRST116)', async () => {
      mockChain = createChainableMock({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const result = await getRecommendation('nonexistent');

      expect(result).toBeNull();
    });

    it('throws on other Supabase errors', async () => {
      mockChain = createChainableMock({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' },
      });

      await expect(getRecommendation('rec-1')).rejects.toThrow('relation does not exist');
    });
  });

  describe('atomicApprove()', () => {
    it('approves a pending recommendation', async () => {
      const approved = { id: 'rec-1', status: 'approved' };
      mockChain = createChainableMock({ data: approved, error: null });

      const result = await atomicApprove('rec-1');

      expect(result).toEqual(approved);
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
      );
      // Should enforce pending status
      expect(mockChain.eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('returns null when recommendation not in pending state', async () => {
      mockChain = createChainableMock({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const result = await atomicApprove('rec-1');

      expect(result).toBeNull();
    });
  });

  describe('markFilled()', () => {
    it('marks recommendation as filled with order ID', async () => {
      mockChain = createChainableMock({ data: null, error: null });
      // markFilled doesn't call .single(), it just does update+eq
      // Override the terminal behavior for update chain
      mockChain.eq = vi.fn().mockResolvedValue({ error: null });

      await markFilled('rec-1', 'ord-123');

      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'filled', order_id: 'ord-123' }),
      );
    });

    it('throws on Supabase error', async () => {
      mockChain = createChainableMock({ data: null, error: null });
      mockChain.eq = vi.fn().mockResolvedValue({ error: { message: 'Update failed' } });

      await expect(markFilled('rec-1', 'ord-123')).rejects.toThrow('Update failed');
    });
  });

  describe('markRiskBlocked()', () => {
    it('marks recommendation as risk_blocked with reason', async () => {
      mockChain = createChainableMock({ data: null, error: null });
      mockChain.eq = vi.fn().mockResolvedValue({ error: null });

      await markRiskBlocked('rec-1', 'Exceeded concentration limit');

      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'risk_blocked',
          metadata: { block_reason: 'Exceeded concentration limit' },
        }),
      );
    });
  });

  describe('rejectRecommendation()', () => {
    it('rejects a pending recommendation', async () => {
      const rejected = { id: 'rec-1', status: 'rejected' };
      mockChain = createChainableMock({ data: rejected, error: null });

      const result = await rejectRecommendation('rec-1');

      expect(result).toEqual(rejected);
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'rejected' }),
      );
      expect(mockChain.eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('returns null when not in pending state', async () => {
      mockChain = createChainableMock({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const result = await rejectRecommendation('rec-1');

      expect(result).toBeNull();
    });
  });

  describe('createAlert()', () => {
    it('creates an alert and returns it', async () => {
      const alert = {
        id: 'alert-1',
        severity: 'critical',
        title: 'Drawdown Alert',
        message: 'Drawdown exceeds 10%',
        created_at: '2024-01-01T00:00:00Z',
        acknowledged: false,
      };
      mockChain = createChainableMock({ data: alert, error: null });

      const result = await createAlert({
        severity: 'critical',
        title: 'Drawdown Alert',
        message: 'Drawdown exceeds 10%',
      });

      expect(result).toEqual(alert);
      expect(mockChain.from).toHaveBeenCalledWith('agent_alerts');
    });

    it('throws on Supabase error', async () => {
      mockChain = createChainableMock({
        data: null,
        error: { message: 'Alert insert failed' },
      });

      await expect(
        createAlert({ severity: 'info', title: 'Test', message: 'Test' }),
      ).rejects.toThrow('Alert insert failed');
    });
  });

  describe('listAlerts()', () => {
    it('returns list of alerts', async () => {
      const alerts = [{ id: 'alert-1' }, { id: 'alert-2' }];
      mockChain = createChainableMock({ data: alerts, error: null });

      const result = await listAlerts();

      expect(result).toEqual(alerts);
      expect(mockChain.from).toHaveBeenCalledWith('agent_alerts');
    });

    it('returns empty array when data is null', async () => {
      mockChain = createChainableMock({ data: null, error: null });

      const result = await listAlerts();

      expect(result).toEqual([]);
    });

    it('throws on Supabase error', async () => {
      mockChain = createChainableMock({
        data: null,
        error: { message: 'Alerts query failed' },
      });

      await expect(listAlerts()).rejects.toThrow('Alerts query failed');
    });
  });
});
