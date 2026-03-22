'use client';

import { useState, useEffect, useCallback } from 'react';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '1d' | '1w';

export interface BarData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Seed-based PRNG for deterministic data per ticker
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

const TICKER_BASE_PRICES: Record<string, number> = {
  AAPL: 178,
  MSFT: 379,
  GOOGL: 142,
  AMZN: 178,
  NVDA: 495,
  TSLA: 248,
  META: 356,
  SPY: 456,
};

function generateSimulatedBars(ticker: string, timeframe: Timeframe): BarData[] {
  const rand = seededRandom(hashString(ticker + timeframe));
  const count = 300;
  const basePrice = TICKER_BASE_PRICES[ticker] ?? 100 + rand() * 400;

  // Determine bar interval in seconds
  const intervals: Record<Timeframe, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '1d': 86400,
    '1w': 604800,
  };
  const interval = intervals[timeframe];

  // Start time: work backwards from "now" (floored to interval)
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - count * interval;

  const bars: BarData[] = [];
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * interval;

    // Random walk with slight upward drift
    const volatility = basePrice * 0.015;
    const drift = basePrice * 0.0001;
    const change = (rand() - 0.48) * volatility + drift;

    const open = price;
    const close = Math.max(1, price + change);
    const high = Math.max(open, close) + rand() * volatility * 0.5;
    const low = Math.min(open, close) - rand() * volatility * 0.5;
    const volume = Math.round(500_000 + rand() * 5_000_000);

    bars.push({
      time,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +Math.max(0.01, low).toFixed(2),
      close: +close.toFixed(2),
      volume,
    });

    price = close;
  }

  return bars;
}

export function useChartData(ticker: string, timeframe: Timeframe = '1d') {
  const [bars, setBars] = useState<BarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBars = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        engineUrl(`/api/v1/data/bars?ticker=${ticker}&timeframe=${timeframe}&limit=500`),
        { headers: engineHeaders(), signal: AbortSignal.timeout(10000) },
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setBars(data.bars ?? data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chart data');
      setBars(generateSimulatedBars(ticker, timeframe));
    } finally {
      setLoading(false);
    }
  }, [ticker, timeframe]);

  useEffect(() => {
    fetchBars();
  }, [fetchBars]);

  return { bars, loading, error, refetch: fetchBars };
}
