import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/server before importing the module under test
vi.mock('next/server', () => {
  class MockNextResponse {
    body: string;
    status: number;
    headers: Map<string, string>;

    constructor(body: string, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }

    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(JSON.stringify(data), {
        status: init?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  return { NextResponse: MockNextResponse };
});

import { proxyRequest } from '@/lib/server/service-proxy';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('proxyRequest', () => {
  it('forwards request to upstream and returns response', async () => {
    const payload = { data: 'hello' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const request = new Request('http://localhost:3000/api/engine/v1/health', {
      method: 'GET',
    });

    const res = await proxyRequest(request, 'http://engine:8000', 'test-key', [
      'api',
      'v1',
      'health',
    ]);

    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledOnce();

    // Verify the upstream URL was constructed correctly
    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(fetchCall[0]).toBe('http://engine:8000/api/v1/health');
  });

  it('returns 502 on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const request = new Request('http://localhost:3000/api/engine/v1/health', {
      method: 'GET',
    });

    const res = await proxyRequest(request, 'http://engine:8000', 'test-key', [
      'api',
      'v1',
      'health',
    ]);

    expect(res.status).toBe(502);
  });

  it('uses a timeout via AbortSignal', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const request = new Request('http://localhost:3000/api/engine/v1/health', {
      method: 'GET',
    });

    await proxyRequest(request, 'http://engine:8000', 'test-key', ['api', 'v1', 'health']);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const init = fetchCall[1] as RequestInit;
    expect(init.signal).toBeDefined();
  });
});
