import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/app-store';

let postgresChangesCallback: ((payload: { new: unknown }) => void) | null = null;
let subscribeStatusCallback: ((status: string) => void) | null = null;
const mockUnsubscribe = vi.fn();

const mockChannel = {
  on: vi
    .fn()
    .mockImplementation(
      (_event: string, _opts: unknown, cb: (payload: { new: unknown }) => void) => {
        postgresChangesCallback = cb;
        return mockChannel;
      },
    ),
  subscribe: vi.fn().mockImplementation((cb: (status: string) => void) => {
    subscribeStatusCallback = cb;
    return mockChannel;
  }),
  unsubscribe: mockUnsubscribe,
};

const mockSupabase = {
  channel: vi.fn().mockReturnValue(mockChannel),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

import { useRealtimeSignals } from '@/hooks/use-realtime-signals';

describe('useRealtimeSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postgresChangesCallback = null;
    subscribeStatusCallback = null;
    useAppStore.setState({ realtimeSignals: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes to the realtime-agent-recommendations channel', async () => {
    renderHook(() => useRealtimeSignals());

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith('realtime-agent-recommendations');
    });
  });

  it('sets up postgres_changes listener with pending filter', async () => {
    renderHook(() => useRealtimeSignals());

    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_recommendations',
          filter: 'status=eq.pending',
        },
        expect.any(Function),
      );
    });
  });

  it('returns isSubscribed=true when SUBSCRIBED', async () => {
    const { result } = renderHook(() => useRealtimeSignals());

    await waitFor(() => {
      expect(subscribeStatusCallback).not.toBeNull();
    });

    subscribeStatusCallback!('SUBSCRIBED');

    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(true);
    });
  });

  it('adds incoming signal to app store', async () => {
    renderHook(() => useRealtimeSignals());

    await waitFor(() => {
      expect(postgresChangesCallback).not.toBeNull();
    });

    const signalPayload = {
      id: 'signal-1',
      agent_role: 'momentum',
      ticker: 'NVDA',
      side: 'buy' as const,
      quantity: 100,
      order_type: 'limit',
      limit_price: 500,
      reason: 'Breakout detected',
      strategy_name: 'momentum-v2',
      signal_strength: 0.9,
      status: 'pending',
      created_at: '2024-01-01T00:00:00Z',
    };

    postgresChangesCallback!({ new: signalPayload });

    expect(useAppStore.getState().realtimeSignals).toContainEqual(signalPayload);
  });

  it('returns signals from the store', () => {
    const signal = {
      id: 'existing-1',
      agent_role: 'test',
      ticker: 'AAPL',
      side: 'sell' as const,
      quantity: 50,
      order_type: 'market',
      limit_price: null,
      reason: null,
      strategy_name: null,
      signal_strength: null,
      status: 'pending',
      created_at: '',
    };
    useAppStore.setState({ realtimeSignals: [signal] });

    const { result } = renderHook(() => useRealtimeSignals());
    expect(result.current.signals).toContainEqual(signal);
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useRealtimeSignals());

    await waitFor(() => {
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('handles subscribe failure gracefully', async () => {
    mockSupabase.channel.mockImplementationOnce(() => {
      throw new Error('Not configured');
    });

    const { result } = renderHook(() => useRealtimeSignals());

    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(false);
    });
  });
});
