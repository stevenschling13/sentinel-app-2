import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/service-proxy', () => ({
  proxyRequest: vi.fn(),
}));

import { proxyRequest } from '@/lib/server/service-proxy';
import { GET, POST, PUT, DELETE } from '@/app/api/engine/[...path]/route';

const mockedProxy = vi.mocked(proxyRequest);

describe('/api/engine/[...path] proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedProxy.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
  });

  function makeRequest(method: string, path: string) {
    return new NextRequest(`http://localhost:3000/api/engine/${path}`, { method });
  }

  function makeParams(path: string[]) {
    return { params: Promise.resolve({ path }) };
  }

  it('forwards GET request to proxyRequest', async () => {
    await GET(makeRequest('GET', 'health'), makeParams(['health']));

    expect(mockedProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.stringContaining('localhost:8000'),
      expect.any(String),
      ['health'],
    );
  });

  it('forwards POST request to proxyRequest', async () => {
    await POST(makeRequest('POST', 'api/v1/orders'), makeParams(['api', 'v1', 'orders']));

    expect(mockedProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.any(String),
      expect.any(String),
      ['api', 'v1', 'orders'],
    );
  });

  it('forwards PUT request to proxyRequest', async () => {
    await PUT(makeRequest('PUT', 'api/v1/config'), makeParams(['api', 'v1', 'config']));
    expect(mockedProxy).toHaveBeenCalled();
  });

  it('forwards DELETE request to proxyRequest', async () => {
    await DELETE(
      makeRequest('DELETE', 'api/v1/orders/1'),
      makeParams(['api', 'v1', 'orders', '1']),
    );
    expect(mockedProxy).toHaveBeenCalled();
  });

  it('passes the correct upstream URL from env default', async () => {
    await GET(makeRequest('GET', 'health'), makeParams(['health']));

    expect(mockedProxy).toHaveBeenCalledWith(
      expect.anything(),
      'http://localhost:8000',
      'sentinel-dev-key',
      expect.any(Array),
    );
  });

  it('returns the proxied response', async () => {
    mockedProxy.mockResolvedValue(new Response(JSON.stringify({ data: 'test' }), { status: 200 }));

    const response = await GET(makeRequest('GET', 'test'), makeParams(['test']));
    const body = await response.json();
    expect(body).toEqual({ data: 'test' });
  });

  it('returns error response from proxy', async () => {
    mockedProxy.mockResolvedValue(
      new Response(JSON.stringify({ error: 'unavailable' }), { status: 502 }),
    );

    const response = await GET(makeRequest('GET', 'fail'), makeParams(['fail']));
    expect(response.status).toBe(502);
  });

  it('handles multi-segment paths', async () => {
    await GET(makeRequest('GET', 'api/v1/data/bars'), makeParams(['api', 'v1', 'data', 'bars']));

    expect(mockedProxy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(String),
      ['api', 'v1', 'data', 'bars'],
    );
  });
});
