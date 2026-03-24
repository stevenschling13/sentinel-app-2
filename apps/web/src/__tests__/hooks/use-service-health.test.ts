import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '@/stores/app-store';
import { useServiceHealth } from '@/hooks/use-service-health';

describe('useServiceHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    useAppStore.setState({
      engineOnline: null,
      agentsOnline: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('probes health immediately on mount', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

    renderHook(() => useServiceHealth());
    await vi.advanceTimersByTimeAsync(0);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/engine/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/agents/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('sets engineOnline=true and agentsOnline=true when both are ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

    renderHook(() => useServiceHealth());
    await vi.advanceTimersByTimeAsync(0);

    expect(useAppStore.getState().engineOnline).toBe(true);
    expect(useAppStore.getState().agentsOnline).toBe(true);
  });

  it('sets engineOnline=false when engine fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('engine')) throw new Error('Network error');
      return new Response('{}', { status: 200 });
    });

    renderHook(() => useServiceHealth());
    await vi.advanceTimersByTimeAsync(0);

    expect(useAppStore.getState().engineOnline).toBe(false);
    expect(useAppStore.getState().agentsOnline).toBe(true);
  });

  it('sets agentsOnline=false when agents return non-ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('agents')) {
        return new Response('{}', { status: 500 });
      }
      return new Response('{}', { status: 200 });
    });

    renderHook(() => useServiceHealth());
    await vi.advanceTimersByTimeAsync(0);

    expect(useAppStore.getState().engineOnline).toBe(true);
    expect(useAppStore.getState().agentsOnline).toBe(false);
  });

  it('sets agentsOnline=null when 503 with not_configured on localhost', async () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
      writable: true,
      configurable: true,
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('agents')) {
        return new Response(JSON.stringify({ code: 'not_configured' }), { status: 503 });
      }
      return new Response('{}', { status: 200 });
    });

    renderHook(() => useServiceHealth());
    await vi.advanceTimersByTimeAsync(0);

    expect(useAppStore.getState().agentsOnline).toBeNull();
  });

  it('polls at 15 second intervals', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    renderHook(() => useServiceHealth());
    await vi.advanceTimersByTimeAsync(0);

    const initialCalls = fetchSpy.mock.calls.length;

    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it('clears interval on unmount', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

    const { unmount } = renderHook(() => useServiceHealth());
    await vi.advanceTimersByTimeAsync(0);

    const callsBefore = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    unmount();

    await vi.advanceTimersByTimeAsync(30_000);
    const callsAfter = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBe(callsBefore);
  });

  it('handles both services failing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));

    renderHook(() => useServiceHealth());
    await vi.advanceTimersByTimeAsync(0);

    expect(useAppStore.getState().engineOnline).toBe(false);
    expect(useAppStore.getState().agentsOnline).toBe(false);
  });
});
