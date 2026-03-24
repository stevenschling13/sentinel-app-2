import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAppStore } from '@/stores/app-store';

// Track the subscription callback and subscribe status callback
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

// Import after mocking
import { useRealtimeAlerts } from '@/hooks/use-realtime-alerts';

describe('useRealtimeAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postgresChangesCallback = null;
    subscribeStatusCallback = null;
    useAppStore.setState({ realtimeAlerts: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes to the realtime-agent-alerts channel', async () => {
    renderHook(() => useRealtimeAlerts());

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith('realtime-agent-alerts');
    });
  });

  it('sets up postgres_changes listener on agent_alerts table', async () => {
    renderHook(() => useRealtimeAlerts());

    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_alerts' },
        expect.any(Function),
      );
    });
  });

  it('returns isSubscribed=true when status is SUBSCRIBED', async () => {
    const { result } = renderHook(() => useRealtimeAlerts());

    await waitFor(() => {
      expect(subscribeStatusCallback).not.toBeNull();
    });

    // Simulate subscription status
    subscribeStatusCallback!('SUBSCRIBED');

    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(true);
    });
  });

  it('returns isSubscribed=false for non-SUBSCRIBED status', async () => {
    const { result } = renderHook(() => useRealtimeAlerts());

    await waitFor(() => {
      expect(subscribeStatusCallback).not.toBeNull();
    });

    subscribeStatusCallback!('CLOSED');

    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(false);
    });
  });

  it('adds incoming alert to app store', async () => {
    renderHook(() => useRealtimeAlerts());

    await waitFor(() => {
      expect(postgresChangesCallback).not.toBeNull();
    });

    const alertPayload = {
      id: 'alert-1',
      severity: 'warning' as const,
      title: 'High Volatility',
      message: 'AAPL vol spike',
      ticker: 'AAPL',
      acknowledged: false,
      created_at: '2024-01-01T00:00:00Z',
    };

    postgresChangesCallback!({ new: alertPayload });

    expect(useAppStore.getState().realtimeAlerts).toContainEqual(alertPayload);
  });

  it('returns alerts from the store', async () => {
    const alert = {
      id: 'pre-existing',
      severity: 'info' as const,
      title: 'Test',
      message: 'msg',
      ticker: null,
      acknowledged: false,
      created_at: '',
    };
    useAppStore.setState({ realtimeAlerts: [alert] });

    const { result } = renderHook(() => useRealtimeAlerts());
    expect(result.current.alerts).toContainEqual(alert);
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useRealtimeAlerts());

    await waitFor(() => {
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('handles createClient failure gracefully', async () => {
    // Override mock to throw
    const originalMock = vi.mocked(mockSupabase.channel);
    mockSupabase.channel.mockImplementationOnce(() => {
      throw new Error('Supabase not configured');
    });

    const { result } = renderHook(() => useRealtimeAlerts());

    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(false);
    });

    // Restore
    mockSupabase.channel = originalMock;
  });
});
