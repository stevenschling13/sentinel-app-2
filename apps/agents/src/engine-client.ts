/**
 * HTTP client for the Sentinel Engine API.
 * Used by agents to interact with the quant engine.
 */

import { logger } from './logger.js';

/** Request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Maximum number of retry attempts before giving up. */
const MAX_RETRIES = 3;

/** Base delay in milliseconds for exponential backoff. */
const BASE_DELAY_MS = 200;

/**
 * Returns true if the HTTP status code indicates a transient failure
 * that is safe to retry (timeout, rate-limited, or server error).
 */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Computes exponential backoff delay with ±20 % jitter.
 * @param attempt - Zero-based retry attempt number.
 */
function getBackoffDelay(attempt: number): number {
  const jitter = 0.8 + Math.random() * 0.4;
  return BASE_DELAY_MS * Math.pow(2, attempt) * jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface EngineHealth {
  status: string;
  engine: string;
  version: string;
}

export interface StrategyInfo {
  name: string;
  family: string;
  description: string;
  default_params: Record<string, unknown>;
}

export interface StrategiesResponse {
  strategies: StrategyInfo[];
  families: string[];
  total: number;
}

export interface RiskAssessmentResponse {
  equity: number;
  cash: number;
  drawdown: number;
  daily_pnl: number;
  position_count: number;
  concentrations: Record<string, number>;
  sector_concentrations: Record<string, number>;
  alerts: Array<{ severity: string; rule: string; message: string; action: string }>;
  halted: boolean;
}

export interface PositionSizeResponse {
  ticker: string;
  shares: number;
  dollar_amount: number;
  weight: number;
  method: string;
  risk_per_share: number;
}

export class EngineClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(
    baseUrl: string = process.env.ENGINE_URL ?? 'http://localhost:8000',
    apiKey: string = process.env.ENGINE_API_KEY ?? '',
  ) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          ...options,
          signal: options?.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            ...options?.headers,
          },
        });

        if (!res.ok) {
          if (attempt < MAX_RETRIES && isRetryableStatus(res.status)) {
            const delay = getBackoffDelay(attempt);
            logger.warn('engine_request_retry', {
              url,
              status: res.status,
              attempt: attempt + 1,
              maxRetries: MAX_RETRIES,
              delayMs: Math.round(delay),
            });
            await sleep(delay);
            continue;
          }
          const body = await res.text().catch(() => '');
          throw new Error(`Engine API error ${res.status}: ${body}`);
        }

        return res.json() as Promise<T>;
      } catch (err) {
        lastError = err;

        if (attempt < MAX_RETRIES) {
          const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
          const isNetwork = err instanceof TypeError || isTimeout;

          if (isNetwork) {
            const delay = getBackoffDelay(attempt);
            logger.warn('engine_request_retry', {
              url,
              error: err instanceof Error ? err.message : String(err),
              attempt: attempt + 1,
              maxRetries: MAX_RETRIES,
              delayMs: Math.round(delay),
            });
            await sleep(delay);
            continue;
          }
        }

        throw err;
      }
    }

    throw lastError;
  }

  async getHealth(): Promise<EngineHealth> {
    return this.request<EngineHealth>('/health');
  }

  async getStrategies(): Promise<StrategiesResponse> {
    return this.request<StrategiesResponse>('/api/v1/strategies/');
  }

  async assessRisk(state: {
    equity: number;
    cash: number;
    peak_equity: number;
    daily_starting_equity: number;
    positions: Record<string, number>;
    position_sectors: Record<string, string>;
  }): Promise<RiskAssessmentResponse> {
    return this.request<RiskAssessmentResponse>('/api/v1/risk/assess', {
      method: 'POST',
      body: JSON.stringify(state),
    });
  }

  async calculatePositionSize(params: {
    ticker: string;
    price: number;
    equity: number;
    method?: string;
  }): Promise<PositionSizeResponse> {
    return this.request<PositionSizeResponse>('/api/v1/risk/position-size', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async ingestData(tickers: string[], timeframe = '1d') {
    return this.request<{ ingested: number; errors: string[] }>('/api/v1/data/ingest', {
      method: 'POST',
      body: JSON.stringify({ tickers, timeframe }),
    });
  }

  async getAccount(): Promise<{
    cash: number;
    equity: number;
    positions_value: number;
    initial_capital: number;
  }> {
    return this.request('/api/v1/portfolio/account');
  }

  async getPositions(): Promise<
    Array<{
      instrument_id: string;
      quantity: number;
      avg_price: number;
      market_value: number;
      side: string;
    }>
  > {
    return this.request('/api/v1/portfolio/positions');
  }

  async scanStrategies(params: {
    tickers: string[];
    days?: number;
    min_strength?: number;
  }): Promise<{
    signals: Array<{
      ticker: string;
      direction: string;
      strength: number;
      strategy_name: string;
      reason: string;
    }>;
    total_signals: number;
    tickers_scanned: number;
    strategies_run: number;
    errors: string[];
  }> {
    const body = { days: 90, min_strength: 0.3, ...params };
    return this.request('/api/v1/strategies/scan', { method: 'POST', body: JSON.stringify(body) });
  }

  async getQuotes(tickers: string[]): Promise<
    Array<{
      ticker: string;
      close: number;
      change_pct: number;
      open: number;
      high: number;
      low: number;
      volume: number;
      timestamp: string;
    }>
  > {
    return this.request(`/api/v1/data/quotes?tickers=${tickers.join(',')}`);
  }

  async preTradeCheck(params: {
    ticker: string;
    shares: number;
    price: number;
    side: 'buy' | 'sell';
    equity: number;
    cash: number;
    peak_equity: number;
    daily_starting_equity: number;
    positions: Record<string, number>;
    position_sectors: Record<string, string>;
  }): Promise<{
    allowed: boolean;
    action: string;
    reason: string;
    adjusted_shares: number | null;
  }> {
    return this.request('/api/v1/risk/pre-trade-check', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
}
