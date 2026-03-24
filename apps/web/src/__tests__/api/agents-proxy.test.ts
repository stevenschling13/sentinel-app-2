import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/service-proxy', () => ({
  proxyRequest: vi.fn(),
}));

import { proxyRequest } from '@/lib/server/service-proxy';
import { GET, POST, PUT, DELETE } from '@/app/api/agents/[...path]/route';

const mockedProxy = vi.mocked(proxyRequest);

describe('/api/agents/[...path] proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedProxy.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
  });

  function makeRequest(method: string, path: string) {
    return new NextRequest(`http://localhost:3000/api/agents/${path}`, { method });
  }

  function makeParams(path: string[]) {
    return { params: Promise.resolve({ path }) };
  }

  it('forwards GET request to proxyRequest with agents URL', async () => {
    await GET(makeRequest('GET', 'health'), makeParams(['health']));

    expect(mockedProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      'http://localhost:3001',
      'sentinel-dev-key',
      ['health'],
    );
  });

  it('forwards POST request', async () => {
    await POST(
      makeRequest('POST', 'api/v1/agents/run'),
      makeParams(['api', 'v1', 'agents', 'run']),
    );

    expect(mockedProxy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('localhost:3001'),
      expect.any(String),
      ['api', 'v1', 'agents', 'run'],
    );
  });

  it('forwards PUT request', async () => {
    await PUT(makeRequest('PUT', 'config'), makeParams(['config']));
    expect(mockedProxy).toHaveBeenCalled();
  });

  it('forwards DELETE request', async () => {
    await DELETE(makeRequest('DELETE', 'agents/1'), makeParams(['agents', '1']));
    expect(mockedProxy).toHaveBeenCalled();
  });

  it('returns the proxied response', async () => {
    mockedProxy.mockResolvedValue(new Response(JSON.stringify({ agents: [] }), { status: 200 }));

    const response = await GET(makeRequest('GET', 'agents'), makeParams(['agents']));
    const body = await response.json();
    expect(body).toEqual({ agents: [] });
  });

  it('returns error when proxy fails', async () => {
    mockedProxy.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Service unavailable' }), { status: 502 }),
    );

    const response = await GET(makeRequest('GET', 'health'), makeParams(['health']));
    expect(response.status).toBe(502);
  });

  it('uses AGENTS_URL default (localhost:3001)', async () => {
    await GET(makeRequest('GET', 'health'), makeParams(['health']));

    const [, upstreamUrl, apiKey] = mockedProxy.mock.calls[0];
    expect(upstreamUrl).toBe('http://localhost:3001');
    expect(apiKey).toBe('sentinel-dev-key');
  });

  it('handles multi-segment paths', async () => {
    await GET(
      makeRequest('GET', 'api/v1/agents/status'),
      makeParams(['api', 'v1', 'agents', 'status']),
    );

    expect(mockedProxy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(String),
      ['api', 'v1', 'agents', 'status'],
    );
  });
});
