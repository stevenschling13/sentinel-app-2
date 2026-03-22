'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TradingChart } from '@/components/charts/trading-chart';
import { RSIPanel, MACDPanel } from '@/components/charts/indicator-panel';
import { useChartData, type Timeframe } from '@/hooks/use-chart-data';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import { cn } from '@/lib/utils';

const WATCHLIST = ['SPY', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META'];

interface QuoteData {
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
}

export default function ChartPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const upperTicker = ticker.toUpperCase();

  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const { bars, loading, error, refetch } = useChartData(upperTicker, timeframe);

  // Quote data for header
  const [quote, setQuote] = useState<QuoteData | null>(null);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(engineUrl(`/api/v1/data/quotes?tickers=${upperTicker}`), {
        headers: engineHeaders(),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const q = Array.isArray(data) ? data[0] : data;
      if (q) {
        setQuote({
          price: q.close ?? q.price ?? 0,
          change: q.change ?? 0,
          changePct: q.change_pct ?? 0,
          high: q.high ?? 0,
          low: q.low ?? 0,
          volume: q.volume ?? 0,
        });
      }
    } catch {
      // Derive from bar data if available
      if (bars.length > 0) {
        const last = bars[bars.length - 1];
        const prev = bars.length > 1 ? bars[bars.length - 2] : last;
        const change = last.close - prev.close;
        const changePct = prev.close !== 0 ? (change / prev.close) * 100 : 0;
        setQuote({
          price: last.close,
          change,
          changePct,
          high: last.high,
          low: last.low,
          volume: last.volume,
        });
      }
    }
  }, [upperTicker, bars]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  const priceUp = (quote?.changePct ?? 0) >= 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-white">{upperTicker}</h1>
            {quote && (
              <>
                <span className="font-[family-name:var(--font-geist-mono)] text-lg font-semibold text-white">
                  ${quote.price.toFixed(2)}
                </span>
                <Badge variant={priceUp ? 'profit' : 'loss'}>
                  {priceUp ? (
                    <TrendingUp className="mr-1 h-3 w-3" />
                  ) : (
                    <TrendingDown className="mr-1 h-3 w-3" />
                  )}
                  {priceUp ? '+' : ''}
                  {quote.change.toFixed(2)} ({priceUp ? '+' : ''}
                  {quote.changePct.toFixed(2)}%)
                </Badge>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub-indicator toggles */}
          <button
            onClick={() => setShowRSI((v) => !v)}
            className={cn(
              'rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
              showRSI
                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent',
            )}
          >
            RSI
          </button>
          <button
            onClick={() => setShowMACD((v) => !v)}
            className={cn(
              'rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
              showMACD
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent',
            )}
          >
            MACD
          </button>

          <div className="mx-1 h-5 w-px bg-zinc-800" />

          <button
            onClick={refetch}
            disabled={loading}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>

          {error && (
            <span className="text-[10px] font-medium text-amber-400/80">Simulated data</span>
          )}
        </div>
      </div>

      {/* Main chart area */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Chart column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Card className="flex flex-1 flex-col overflow-hidden rounded-none border-0 border-b border-zinc-800 bg-zinc-950">
            <CardContent className="flex flex-1 flex-col p-0">
              <TradingChart
                bars={bars}
                ticker={upperTicker}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                className="flex-1"
              />
            </CardContent>
          </Card>

          {/* Indicator panels */}
          <RSIPanel bars={bars} visible={showRSI} />
          <MACDPanel bars={bars} visible={showMACD} />
        </div>

        {/* Sidebar — quick stats & watchlist */}
        <div className="w-full border-l border-zinc-800 lg:w-64">
          {/* Quote details */}
          {quote && (
            <div className="border-b border-zinc-800 p-4">
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Quote Details
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-zinc-500">High</span>
                  <p className="font-[family-name:var(--font-geist-mono)] text-sm text-zinc-200">
                    ${quote.high.toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500">Low</span>
                  <p className="font-[family-name:var(--font-geist-mono)] text-sm text-zinc-200">
                    ${quote.low.toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500">Volume</span>
                  <p className="font-[family-name:var(--font-geist-mono)] text-sm text-zinc-200">
                    {quote.volume >= 1_000_000
                      ? `${(quote.volume / 1_000_000).toFixed(1)}M`
                      : quote.volume >= 1_000
                        ? `${(quote.volume / 1_000).toFixed(1)}K`
                        : quote.volume.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500">Bars</span>
                  <p className="font-[family-name:var(--font-geist-mono)] text-sm text-zinc-200">
                    {bars.length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Watchlist */}
          <div className="p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              <Activity className="h-3 w-3" />
              Watchlist
            </h3>
            <div className="space-y-1">
              {WATCHLIST.map((sym) => (
                <Link
                  key={sym}
                  href={`/chart/${sym}`}
                  className={cn(
                    'flex items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors',
                    sym === upperTicker
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
                  )}
                >
                  <span className="font-medium">{sym}</span>
                  <BarChart3 className="h-3 w-3 opacity-40" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
