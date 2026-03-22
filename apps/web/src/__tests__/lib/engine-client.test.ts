import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EngineClient, getEngineClient } from '@/lib/engine-client';

describe('EngineClient', () => {
  let client: EngineClient;

  beforeEach(() => {
    client = new EngineClient('http://localhost:8000', 'test-key');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('constructs with base URL and API key', () => {
    expect(client.baseUrl).toBe('http://localhost:8000');
  });

  it('calls health endpoint', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
    const result = await client.getHealth();
    expect(result).toEqual({ status: 'ok' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/health',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-key' }) }),
    );
  });

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(client.getHealth()).rejects.toThrow('Engine error: 500');
  });

  it('fetches quotes with ticker params', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    await client.getQuotes(['AAPL', 'MSFT']);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/data/quotes?tickers=AAPL,MSFT',
      expect.anything(),
    );
  });

  it('fetches account data', async () => {
    const account = { cash: 100000, equity: 150000, positions_value: 50000, initial_capital: 100000 };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(account), { status: 200 }));
    const result = await client.getAccount();
    expect(result.equity).toBe(150000);
  });

  it('posts ingest data request', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ inserted: 5 }), { status: 200 }));
    await client.ingestData(['AAPL'], '1d');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/data/ingest',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fetches bars with params', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    await client.getBars('AAPL', '1h', 30);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/data/bars/AAPL?timeframe=1h&days=30',
      expect.anything(),
    );
  });

  it('posts scan signals', async () => {
    const scan = { signals: [], total_signals: 0, tickers_scanned: 1, strategies_run: 3, errors: [] };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(scan), { status: 200 }));
    const result = await client.scanSignals({ tickers: ['AAPL'] });
    expect(result.total_signals).toBe(0);
  });

  it('throws with detail on scan error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Bad request' }), { status: 400 }));
    await expect(client.scanSignals({ tickers: [] })).rejects.toThrow('Bad request');
  });
});

describe('getEngineClient', () => {
  it('returns client with defaults in development', () => {
    const client = getEngineClient();
    expect(client.baseUrl).toBe('http://localhost:8000');
  });
});
