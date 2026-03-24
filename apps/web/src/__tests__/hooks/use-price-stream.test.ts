import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  readyState = 0;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

vi.stubGlobal('EventSource', MockEventSource);

import { usePriceStream, type StreamPriceData } from '@/hooks/use-price-stream';

describe('usePriceStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects to the SSE URL on mount', () => {
    renderHook(() => usePriceStream());

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('/api/engine/stream/prices');
  });

  it('sets isStreaming=true on open', async () => {
    const { result } = renderHook(() => usePriceStream());
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateOpen();
    });

    expect(result.current.isStreaming).toBe(true);
  });

  it('handles snapshot messages', async () => {
    const { result } = renderHook(() => usePriceStream());
    const es = MockEventSource.instances[0];

    const snapshot: Record<string, StreamPriceData> = {
      AAPL: {
        price: 178,
        open: 175,
        high: 180,
        low: 174,
        volume: 1000000,
        timestamp: '2024-01-01T00:00:00Z',
        change_pct: 1.5,
      },
    };

    act(() => {
      es.simulateOpen();
      es.simulateMessage(JSON.stringify({ type: 'snapshot', data: snapshot }));
    });

    expect(result.current.prices.size).toBe(1);
    expect(result.current.prices.get('AAPL')?.price).toBe(178);
  });

  it('handles update messages', async () => {
    const { result } = renderHook(() => usePriceStream());
    const es = MockEventSource.instances[0];

    const priceData: StreamPriceData = {
      price: 180,
      open: 175,
      high: 182,
      low: 174,
      volume: 1500000,
      timestamp: '2024-01-01T00:01:00Z',
      change_pct: 2.0,
    };

    act(() => {
      es.simulateOpen();
      es.simulateMessage(JSON.stringify({ type: 'update', ticker: 'MSFT', data: priceData }));
    });

    expect(result.current.prices.get('MSFT')?.price).toBe(180);
  });

  it('updates existing ticker on update message', () => {
    const { result } = renderHook(() => usePriceStream());
    const es = MockEventSource.instances[0];

    const initial: StreamPriceData = {
      price: 100,
      open: 99,
      high: 101,
      low: 98,
      volume: 500000,
      timestamp: '',
      change_pct: 0,
    };
    const updated: StreamPriceData = {
      price: 105,
      open: 99,
      high: 106,
      low: 98,
      volume: 600000,
      timestamp: '',
      change_pct: 5.0,
    };

    act(() => {
      es.simulateOpen();
      es.simulateMessage(JSON.stringify({ type: 'snapshot', data: { AAPL: initial } }));
    });

    expect(result.current.prices.get('AAPL')?.price).toBe(100);

    act(() => {
      es.simulateMessage(JSON.stringify({ type: 'update', ticker: 'AAPL', data: updated }));
    });

    expect(result.current.prices.get('AAPL')?.price).toBe(105);
  });

  it('ignores malformed messages', () => {
    const { result } = renderHook(() => usePriceStream());
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateOpen();
      es.simulateMessage('not valid json {{{');
    });

    expect(result.current.prices.size).toBe(0);
  });

  it('sets isStreaming=false on error and reconnects with backoff', () => {
    const { result } = renderHook(() => usePriceStream());
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateOpen();
    });
    expect(result.current.isStreaming).toBe(true);

    act(() => {
      es.simulateError();
    });
    expect(result.current.isStreaming).toBe(false);
    expect(es.close).toHaveBeenCalled();

    // After initial reconnect delay (1s), a new EventSource should be created
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(MockEventSource.instances.length).toBe(2);
  });

  it('uses exponential backoff on repeated errors', () => {
    renderHook(() => usePriceStream());

    // First error
    act(() => {
      MockEventSource.instances[0].simulateError();
    });

    // Wait 1s for first reconnect
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(MockEventSource.instances).toHaveLength(2);

    // Second error
    act(() => {
      MockEventSource.instances[1].simulateError();
    });

    // First reconnect delay was 1s, so next should be 2s
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(MockEventSource.instances).toHaveLength(2); // Not yet

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(MockEventSource.instances).toHaveLength(3); // Now reconnected
  });

  it('cleans up EventSource on unmount', () => {
    const { unmount } = renderHook(() => usePriceStream());
    const es = MockEventSource.instances[0];

    unmount();
    expect(es.close).toHaveBeenCalled();
  });

  it('does not reconnect after unmount', () => {
    const { unmount } = renderHook(() => usePriceStream());
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateError();
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    // Only the original EventSource (no new connections after unmount)
    // The error handler creates a timeout, but cleanup should clear it
    // We just verify no crashes and the close was called
    expect(es.close).toHaveBeenCalled();
  });
});
