import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EngineClient } from '../engine-client.js';

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers(),
    redirected: false,
    statusText: 'OK',
    type: 'basic',
    url: '',
    clone: () => jsonResponse(body, status) as Response,
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

describe('EngineClient', () => {
  let client: EngineClient;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetch.mockReset();
    client = new EngineClient('http://engine.test', 'test-api-key');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns parsed JSON on successful request', async () => {
    const data = { status: 'ok', engine: 'sentinel', version: '1.0' };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    const result = await client.getHealth();

    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('throws on non-OK response for non-retryable status', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'not found' }, 404));

    await expect(client.getHealth()).rejects.toThrow('Engine API error 404');
  });

  it('retries on 500 errors then succeeds', async () => {
    const successData = { status: 'ok', engine: 'sentinel', version: '1.0' };
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: 'internal' }, 500))
      .mockResolvedValueOnce(jsonResponse(successData));

    const result = await client.getHealth();

    expect(result).toEqual(successData);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries on persistent 500', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'internal' }, 500));

    await expect(client.getHealth()).rejects.toThrow('Engine API error 500');
    expect(mockFetch.mock.calls.length).toBe(4); // 1 initial + 3 retries
  });

  it('includes Authorization header with Bearer token', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: 'ok' }));

    await client.getHealth();

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-api-key');
  });

  it('uses correct base URL for requests', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: 'ok' }));

    await client.getHealth();

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('http://engine.test/health');
  });

  it('builds correct URL for getStrategies', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ strategies: [], families: [], total: 0 }));

    await client.getStrategies();

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe('http://engine.test/api/v1/strategies/');
  });

  it('sends POST body for assessRisk', async () => {
    const riskState = {
      equity: 100_000,
      cash: 50_000,
      peak_equity: 110_000,
      daily_starting_equity: 99_000,
      positions: { AAPL: 10_000 },
      position_sectors: { AAPL: 'technology' },
    };
    mockFetch.mockResolvedValueOnce(jsonResponse({ equity: 100_000, drawdown: 0.05 }));

    await client.assessRisk(riskState);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual(riskState);
  });

  it('retries on network TypeError then succeeds', async () => {
    const successData = { status: 'ok', engine: 'sentinel', version: '1.0' };
    mockFetch
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse(successData));

    const result = await client.getHealth();

    expect(result).toEqual(successData);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
