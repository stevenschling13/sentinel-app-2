'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DollarSign, TrendingUp, BarChart3, AlertTriangle, Zap } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { AlertFeed } from '@/components/dashboard/alert-feed';
import { PriceTicker } from '@/components/dashboard/price-ticker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { useAppStore } from '@/stores/app-store';
import { useRealtimeAlerts } from '@/hooks/use-realtime-alerts';
import { useRealtimeSignals } from '@/hooks/use-realtime-signals';
import type { MarketQuote, BrokerAccount } from '@/lib/engine-client';
import { cn } from '@/lib/utils';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';

const AGENTS_PROXY_BASE = '/api/agents';
const TICKER_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'SPY'];

const FALLBACK_TICKERS = [
  { ticker: 'AAPL', price: 178.72, change: 1.24 },
  { ticker: 'MSFT', price: 378.91, change: 0.82 },
  { ticker: 'GOOGL', price: 141.8, change: -0.56 },
  { ticker: 'AMZN', price: 178.25, change: 1.89 },
  { ticker: 'NVDA', price: 495.22, change: 3.12 },
  { ticker: 'TSLA', price: 248.48, change: -2.15 },
  { ticker: 'META', price: 355.64, change: 0.45 },
  { ticker: 'SPY', price: 456.38, change: 0.62 },
];

interface AlertItem {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  triggered_at: string;
}

interface SignalItem {
  ticker: string;
  side: string;
  reason: string;
  strength: number | null;
  ts: string;
}

export default function DashboardPage() {
  const engineOnline = useAppStore((s) => s.engineOnline);
  const agentsOnline = useAppStore((s) => s.agentsOnline);
  const [tickerData, setTickerData] = useState(FALLBACK_TICKERS);
  const [isLive, setIsLive] = useState(false);
  const [account, setAccount] = useState<BrokerAccount | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [recentSignals, setRecentSignals] = useState<SignalItem[]>([]);

  const { alerts: rtAlerts, isSubscribed: alertsSub } = useRealtimeAlerts();
  const { signals: rtSignals, isSubscribed: signalsSub } = useRealtimeSignals();
  const realtimeConnected = alertsSub || signalsSub;

  // Merge REST alerts with realtime alerts (dedup by id, realtime first)
  const mergedAlerts = useMemo(() => {
    const restIds = new Set(alerts.map((a) => a.id));
    const fromRt: AlertItem[] = rtAlerts
      .filter((a) => !restIds.has(a.id))
      .map((a) => ({
        id: a.id,
        severity: a.severity,
        title: a.title,
        message: a.message,
        triggered_at: a.created_at,
      }));
    return [...fromRt, ...alerts];
  }, [alerts, rtAlerts]);

  // Merge REST signals with realtime signals (dedup by id)
  const mergedSignals = useMemo(() => {
    const restKeys = new Set(recentSignals.map((s) => `${s.ticker}-${s.ts}`));
    const fromRt: SignalItem[] = rtSignals
      .filter((s) => !restKeys.has(`${s.ticker}-${s.created_at}`))
      .map((s) => ({
        ticker: s.ticker,
        side: s.side,
        reason: s.reason ?? '',
        strength: s.signal_strength != null ? Number(s.signal_strength) : null,
        ts: s.created_at,
      }));
    return [...fromRt, ...recentSignals].slice(0, 10);
  }, [recentSignals, rtSignals]);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(
        engineUrl(`/api/v1/data/quotes?tickers=${TICKER_SYMBOLS.join(',')}`),
        { signal: AbortSignal.timeout(6000), headers: engineHeaders() },
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const quotes: MarketQuote[] = await res.json();
      setTickerData(
        TICKER_SYMBOLS.map((sym) => {
          const q = quotes.find((q) => q.ticker === sym);
          return { ticker: sym, price: q?.close ?? 0, change: q?.change_pct ?? 0 };
        }).filter((t) => t.price > 0),
      );
      setIsLive(true);
    } catch (err) {
      console.error('[Dashboard] [prices] fetch failed:', err instanceof Error ? err.message : err);
    }
  }, []);

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch(engineUrl('/api/v1/portfolio/account'), {
        signal: AbortSignal.timeout(6000),
        headers: engineHeaders(),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setAccount(await res.json());
    } catch (err) {
      console.error(
        '[Dashboard] [account] fetch failed:',
        err instanceof Error ? err.message : err,
      );
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const [alertsRes, recsRes] = await Promise.allSettled([
        fetch(`${AGENTS_PROXY_BASE}/alerts`, { signal: AbortSignal.timeout(3000) }),
        fetch(`${AGENTS_PROXY_BASE}/recommendations?status=filled`, {
          signal: AbortSignal.timeout(3000),
        }),
      ]);

      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const data = (await alertsRes.value.json()) as {
          alerts: Array<{
            id: string;
            severity: 'info' | 'warning' | 'critical';
            title: string;
            message: string;
            created_at: string;
          }>;
        };
        if (data.alerts.length > 0) {
          setAlerts(
            data.alerts.map((a) => ({
              id: a.id,
              severity: a.severity,
              title: a.title,
              message: a.message,
              triggered_at: a.created_at,
            })),
          );
        }
      }

      if (recsRes.status === 'fulfilled' && recsRes.value.ok) {
        const data = (await recsRes.value.json()) as {
          recommendations: Array<{
            ticker: string;
            side: string;
            reason?: string;
            signal_strength?: number | null;
            created_at: string;
          }>;
        };
        setRecentSignals(
          data.recommendations.slice(0, 5).map((r) => ({
            ticker: r.ticker,
            side: r.side,
            reason: r.reason ?? '',
            strength: r.signal_strength ?? null,
            ts: r.created_at,
          })),
        );
      }
    } catch (err) {
      console.error('[Dashboard] [alerts] fetch failed:', err instanceof Error ? err.message : err);
    }
  }, []);

  useEffect(() => {
    if (engineOnline !== true) {
      setIsLive(false);
      return;
    }
    fetchPrices();
    fetchAccount();
  }, [engineOnline, fetchPrices, fetchAccount]);

  useEffect(() => {
    if (agentsOnline !== true) {
      setAlerts([]);
      setRecentSignals([]);
      return;
    }
    fetchAlerts();
  }, [agentsOnline, fetchAlerts]);

  useEffect(() => {
    if (engineOnline !== true) return;
    const interval = setInterval(() => {
      fetchPrices();
      fetchAccount();
    }, 30_000);
    return () => clearInterval(interval);
  }, [engineOnline, fetchPrices, fetchAccount]);

  const equity = account?.equity ?? 100_000;
  const pnl = equity - (account?.initial_capital ?? 100_000);
  const pnlPct = account?.initial_capital ? (pnl / account.initial_capital) * 100 : 0;

  return (
    <div className="space-y-4 p-4">
      {engineOnline === false && <OfflineBanner service="engine" />}
      {agentsOnline === false && <OfflineBanner service="agents" />}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Equity"
          value={`$${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          label="Daily P&L"
          value={`${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={pnlPct}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          label="Cash Available"
          value={`$${(account?.cash ?? 100_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          label="Positions Value"
          value={`$${(account?.positions_value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Price Ticker */}
      <div className="relative">
        <PriceTicker items={tickerData} />
        <span className="absolute -top-1.5 right-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-emerald-400 uppercase">
              <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-zinc-400 uppercase">
              Simulated
            </span>
          )}
        </span>
      </div>

      {/* Two-column: Signals + Alerts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Signals
            </CardTitle>
            <div className="flex items-center gap-2">
              {realtimeConnected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-red-400 uppercase">
                  <span className="h-1 w-1 rounded-full bg-red-500 animate-pulse" />
                  Live
                </span>
              )}
              <Zap className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {mergedSignals.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No recent signals. Strategies generate signals during market hours.
              </p>
            ) : (
              <div className="space-y-2">
                {mergedSignals.map((s) => (
                  <div
                    key={`${s.ticker}-${s.ts}`}
                    className="flex items-center justify-between border-b border-border/50 py-1.5 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-bold',
                          s.side === 'buy'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400',
                        )}
                      >
                        {s.side.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{s.ticker}</span>
                    </div>
                    {s.strength != null && (
                      <span className="text-xs font-[family-name:var(--font-geist-mono)] text-muted-foreground">
                        {(s.strength * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertFeed alerts={mergedAlerts} />
      </div>
    </div>
  );
}
