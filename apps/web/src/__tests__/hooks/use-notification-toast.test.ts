import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAppStore, type RealtimeAlertItem, type RealtimeSignalItem } from '@/stores/app-store';
import { useNotificationStore } from '@/stores/notification-store';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from 'sonner';
import { useNotificationToast } from '@/hooks/use-notification-toast';

describe('useNotificationToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ realtimeAlerts: [], realtimeSignals: [] });
    useNotificationStore.setState({ notifications: [] });
  });

  function makeAlert(overrides: Partial<RealtimeAlertItem> = {}): RealtimeAlertItem {
    return {
      id: `alert-${Date.now()}-${Math.random()}`,
      severity: 'info',
      title: 'Test Alert',
      message: 'Something happened',
      ticker: null,
      acknowledged: false,
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  function makeSignal(overrides: Partial<RealtimeSignalItem> = {}): RealtimeSignalItem {
    return {
      id: `signal-${Date.now()}-${Math.random()}`,
      agent_role: 'momentum',
      ticker: 'AAPL',
      side: 'buy',
      quantity: 100,
      order_type: 'market',
      limit_price: null,
      reason: null,
      strategy_name: null,
      signal_strength: null,
      status: 'pending',
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  it('shows info toast for info severity alert', async () => {
    const alert = makeAlert({ severity: 'info', title: 'Info Alert' });

    renderHook(() => useNotificationToast());

    useAppStore.setState({ realtimeAlerts: [alert] });

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        'Info Alert',
        expect.objectContaining({ duration: 4000 }),
      );
    });
  });

  it('shows warning toast for warning severity alert', async () => {
    const alert = makeAlert({ severity: 'warning', title: 'Warn Alert' });

    renderHook(() => useNotificationToast());
    useAppStore.setState({ realtimeAlerts: [alert] });

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        'Warn Alert',
        expect.objectContaining({ duration: 6000 }),
      );
    });
  });

  it('shows error toast for critical severity alert', async () => {
    const alert = makeAlert({ severity: 'critical', title: 'Critical Alert' });

    renderHook(() => useNotificationToast());
    useAppStore.setState({ realtimeAlerts: [alert] });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Critical Alert',
        expect.objectContaining({ duration: 8000 }),
      );
    });
  });

  it('includes ticker in toast description when present', async () => {
    const alert = makeAlert({ ticker: 'TSLA', message: 'Price surge' });

    renderHook(() => useNotificationToast());
    useAppStore.setState({ realtimeAlerts: [alert] });

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ description: '[TSLA] Price surge' }),
      );
    });
  });

  it('adds alert to notification store', async () => {
    const alert = makeAlert({ title: 'Store Alert' });

    renderHook(() => useNotificationToast());
    useAppStore.setState({ realtimeAlerts: [alert] });

    await waitFor(() => {
      const notifications = useNotificationStore.getState().notifications;
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Store Alert');
      expect(notifications[0].type).toBe('alert');
    });
  });

  it('does not duplicate toast for already-seen alert', async () => {
    const alert = makeAlert({ id: 'unique-1' });

    const { rerender } = renderHook(() => useNotificationToast());

    useAppStore.setState({ realtimeAlerts: [alert] });
    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledTimes(1);
    });

    // Re-render with same alerts — should not fire again
    vi.clearAllMocks();
    rerender();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('shows success toast for buy signal', async () => {
    const signal = makeSignal({ side: 'buy', ticker: 'NVDA' });

    renderHook(() => useNotificationToast());
    useAppStore.setState({ realtimeSignals: [signal] });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('BUY Signal: NVDA'),
        expect.any(Object),
      );
    });
  });

  it('shows error toast for sell signal', async () => {
    const signal = makeSignal({ side: 'sell', ticker: 'META' });

    renderHook(() => useNotificationToast());
    useAppStore.setState({ realtimeSignals: [signal] });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('SELL Signal: META'),
        expect.any(Object),
      );
    });
  });

  it('includes signal strength percentage in toast title', async () => {
    const signal = makeSignal({ signal_strength: 0.85, ticker: 'AAPL', side: 'buy' });

    renderHook(() => useNotificationToast());
    useAppStore.setState({ realtimeSignals: [signal] });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('85%'),
        expect.any(Object),
      );
    });
  });

  it('classifies signal with strength >= 0.8 as critical severity', async () => {
    const signal = makeSignal({ signal_strength: 0.9 });

    renderHook(() => useNotificationToast());
    useAppStore.setState({ realtimeSignals: [signal] });

    await waitFor(() => {
      const notifications = useNotificationStore.getState().notifications;
      expect(notifications[0].severity).toBe('critical');
    });
  });

  it('classifies signal with strength < 0.8 as info severity', async () => {
    const signal = makeSignal({ signal_strength: 0.5 });

    renderHook(() => useNotificationToast());
    useAppStore.setState({ realtimeSignals: [signal] });

    await waitFor(() => {
      const notifications = useNotificationStore.getState().notifications;
      expect(notifications[0].severity).toBe('info');
    });
  });

  it('uses reason as message when available', async () => {
    const signal = makeSignal({ reason: 'RSI oversold', ticker: 'SPY' });

    renderHook(() => useNotificationToast());
    useAppStore.setState({ realtimeSignals: [signal] });

    await waitFor(() => {
      const notifications = useNotificationStore.getState().notifications;
      expect(notifications[0].message).toBe('RSI oversold');
    });
  });

  it('generates message from signal data when reason is null', async () => {
    const signal = makeSignal({ reason: null, side: 'buy', quantity: 200, ticker: 'TSLA' });

    renderHook(() => useNotificationToast());
    useAppStore.setState({ realtimeSignals: [signal] });

    await waitFor(() => {
      const notifications = useNotificationStore.getState().notifications;
      expect(notifications[0].message).toBe('BUY 200 shares of TSLA');
    });
  });
});
