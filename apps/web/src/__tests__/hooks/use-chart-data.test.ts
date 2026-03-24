import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/engine-fetch', () => ({
  engineUrl: (path: string) => `/api/engine${path}`,
  engineHeaders: () => ({}),
}));

import { useChartData, type Timeframe } from '@/hooks/use-chart-data';

describe('useChartData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches bars from engine API on mount', async () => {
    const mockBars = [
      { time: 1700000000, open: 178, high: 180, low: 176, close: 179, volume: 500000 },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ bars: mockBars }), { status: 200 }),
    );

    const { result } = renderHook(() => useChartData('AAPL', '1d'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/engine/api/v1/data/bars?ticker=AAPL&timeframe=1d'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.bars).toEqual(mockBars);
    expect(result.current.error).toBeNull();
  });

  it('extracts bars from response.bars field', async () => {
    const bars = [{ time: 1, open: 1, high: 2, low: 0, close: 1.5, volume: 100 }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ bars }), { status: 200 }),
    );

    const { result } = renderHook(() => useChartData('MSFT'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.bars).toEqual(bars);
  });

  it('falls back to response array when bars field is absent', async () => {
    const data = [{ time: 1, open: 1, high: 2, low: 0, close: 1.5, volume: 100 }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(data), { status: 200 }),
    );

    const { result } = renderHook(() => useChartData('GOOGL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.bars).toEqual(data);
  });

  it('falls back to simulated data on fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useChartData('AAPL', '1d'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.bars.length).toBeGreaterThan(0);
    // Simulated bars should have the expected shape
    expect(result.current.bars[0]).toHaveProperty('time');
    expect(result.current.bars[0]).toHaveProperty('open');
    expect(result.current.bars[0]).toHaveProperty('close');
  });

  it('falls back to simulated data on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));

    const { result } = renderHook(() => useChartData('TSLA', '5m'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('500');
    expect(result.current.bars.length).toBeGreaterThan(0);
  });

  it('simulated data is deterministic per ticker+timeframe', async () => {
    // Pin Date.now so the time-based bar calculation is identical across renders
    const now = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fail'));

    const { result: r1 } = renderHook(() => useChartData('AAPL', '1d'));
    await waitFor(() => expect(r1.current.loading).toBe(false));

    const { result: r2 } = renderHook(() => useChartData('AAPL', '1d'));
    await waitFor(() => expect(r2.current.loading).toBe(false));

    expect(r1.current.bars).toEqual(r2.current.bars);
  });

  it('different tickers produce different simulated bars', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fail'));

    const { result: r1 } = renderHook(() => useChartData('AAPL', '1d'));
    await waitFor(() => expect(r1.current.loading).toBe(false));

    const { result: r2 } = renderHook(() => useChartData('MSFT', '1d'));
    await waitFor(() => expect(r2.current.loading).toBe(false));

    expect(r1.current.bars[0].open).not.toBe(r2.current.bars[0].open);
  });

  it('starts in loading=true state', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    const { result } = renderHook(() => useChartData('SPY'));
    expect(result.current.loading).toBe(true);
  });

  it('refetch function triggers a new fetch', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const { result } = renderHook(() => useChartData('AAPL'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callCount = fetchSpy.mock.calls.length;
    await result.current.refetch();
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(callCount);
  });

  it('re-fetches when ticker changes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    const { result, rerender } = renderHook(
      ({ ticker, tf }: { ticker: string; tf: Timeframe }) => useChartData(ticker, tf),
      { initialProps: { ticker: 'AAPL', tf: '1d' as Timeframe } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ ticker: 'MSFT', tf: '1d' });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('ticker=MSFT'),
        expect.any(Object),
      );
    });
  });

  it('uses default timeframe of 1d', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    renderHook(() => useChartData('AAPL'));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('timeframe=1d'),
        expect.any(Object),
      );
    });
  });
});
