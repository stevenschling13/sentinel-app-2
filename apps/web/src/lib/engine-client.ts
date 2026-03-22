import type { IngestResult, OHLCV, Strategy } from '@sentinel/shared';

export interface StrategyFamily {
  family: string;
  strategies: Strategy[];
}

export interface MarketQuote {
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number | null;
  timestamp: string;
  change: number;
  change_pct: number;
}

export interface BrokerAccount {
  cash: number;
  positions_value: number;
  equity: number;
  initial_capital: number;
  buying_power?: number;
  status?: string;
  account_id?: string;
}

export interface BrokerPosition {
  instrument_id: string;
  quantity: number;
  avg_price: number;
  market_value?: number;
  current_price?: number;
  unrealized_pl?: number;
  unrealized_plpc?: number;
  side?: string;
}

export interface SignalResult {
  ticker: string;
  direction: string;
  strength: number;
  strategy_name: string;
  reason: string;
  metadata: Record<string, unknown>;
}

export interface ScanResult {
  signals: SignalResult[];
  total_signals: number;
  tickers_scanned: number;
  strategies_run: number;
  errors: string[];
}

export class EngineClient {
  readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private url(path: string): string {
    return `${this.baseUrl}/api/v1${path}`;
  }

  async ingestData(tickers: string[], timeframe = '1d'): Promise<IngestResult> {
    const res = await fetch(this.url('/data/ingest'), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ tickers, timeframe }),
    });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getHealth(): Promise<{ status: string }> {
    const res = await fetch(this.url('/health'), { headers: this.headers() });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getStrategies(): Promise<StrategyFamily[]> {
    const res = await fetch(this.url('/strategies/'), { headers: this.headers() });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getQuotes(
    tickers: string[] = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'SPY'],
  ): Promise<MarketQuote[]> {
    const param = tickers.map((t) => t.toUpperCase()).join(',');
    const res = await fetch(this.url(`/data/quotes?tickers=${param}`), { headers: this.headers() });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getBars(ticker: string, timeframe = '1d', days = 90): Promise<OHLCV[]> {
    const res = await fetch(
      this.url(`/data/bars/${ticker.toUpperCase()}?timeframe=${timeframe}&days=${days}`),
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getAccount(): Promise<BrokerAccount> {
    const res = await fetch(this.url('/portfolio/account'), { headers: this.headers() });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const res = await fetch(this.url('/portfolio/positions'), { headers: this.headers() });
    if (!res.ok) throw new Error(`Engine error: ${res.status}`);
    return res.json();
  }

  async scanSignals(params: {
    tickers: string[];
    days?: number;
    min_strength?: number;
  }): Promise<ScanResult> {
    const res = await fetch(this.url('/strategies/scan'), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ days: 90, min_strength: 0.2, ...params }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { detail?: string }).detail ?? `Engine error: ${res.status}`);
    }
    return res.json();
  }
}

export function getEngineClient(): EngineClient {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const url = process.env.ENGINE_URL;
  const key = process.env.ENGINE_API_KEY;

  if (isProduction) {
    if (!url) throw new Error('[getEngineClient] ENGINE_URL is not set in production.');
    if (!key) throw new Error('[getEngineClient] ENGINE_API_KEY is not set in production.');
  }

  return new EngineClient(url ?? 'http://localhost:8000', key ?? 'sentinel-dev-key');
}
