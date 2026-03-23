'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  BarChart3,
  RefreshCw,
  Loader2,
  TrendingUp,
  AlertCircle,
  Zap,
} from 'lucide-react';

interface Strategy {
  name: string;
  family: string;
  description: string;
  signals?: number;
  winRate?: number;
  parameters?: Record<string, unknown>;
}

interface ScanResult {
  ticker: string;
  strategy: string;
  direction: string;
  strength: number;
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
}

// Fallback strategies when API is unreachable
const FALLBACK_STRATEGIES: Strategy[] = [
  { name: 'Momentum Breakout', family: 'momentum', description: 'Detects price breakouts above resistance with volume confirmation.' },
  { name: 'Mean Reversion', family: 'mean_reversion', description: 'Identifies oversold/overbought conditions for mean reversion entries.' },
  { name: 'Trend Following', family: 'trend', description: 'Follows established trends using moving average crossovers and ADX.' },
  { name: 'Volatility Squeeze', family: 'volatility', description: 'Detects low-volatility consolidation before explosive moves.' },
  { name: 'Gap Analysis', family: 'gap', description: 'Analyzes overnight gaps for continuation or fill probabilities.' },
  { name: 'Volume Profile', family: 'volume', description: 'Maps price action against volume distribution to find value areas.' },
];

const DEFAULT_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'SPY'];

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/engine/strategies/', { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStrategies(Array.isArray(data) ? data : data.strategies ?? FALLBACK_STRATEGIES);
    } catch (err) {
      console.error('Failed to fetch strategies:', err);
      setStrategies(FALLBACK_STRATEGIES);
      setError('Engine offline — showing cached strategies');
    } finally {
      setLoading(false);
    }
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/engine/strategies/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: DEFAULT_TICKERS }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const signals = Array.isArray(data) ? data : data.signals ?? data.results ?? [];
      setScanResults(signals);
      toast.success(`Scan complete — ${signals.length} signals found`);
    } catch (err) {
      console.error('Scan failed:', err);
      toast.error('Strategy scan failed — is the engine running?');
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => { fetchStrategies(); }, [fetchStrategies]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Strategies</h1>
          <Badge variant="secondary" className="text-xs">
            {strategies.length} available
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchStrategies} disabled={loading}>
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={runScan} disabled={scanning}>
            {scanning ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="mr-1.5 h-3.5 w-3.5" />
            )}
            Run Scan
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/5 px-4 py-2 text-xs text-yellow-400">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Trading strategies">
          {strategies.map((s) => (
            <Card key={s.name} role="listitem" className="transition-colors hover:border-primary/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{s.name}</CardTitle>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {s.family}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{s.description}</p>
                {(s.signals !== undefined || s.winRate !== undefined) && (
                  <div className="mt-3 flex gap-4 text-xs">
                    {s.signals !== undefined && (
                      <div>
                        <span className="text-muted-foreground">Signals: </span>
                        <span className="font-medium font-[family-name:var(--font-geist-mono)]">{s.signals}</span>
                      </div>
                    )}
                    {s.winRate !== undefined && (
                      <div>
                        <span className="text-muted-foreground">Win Rate: </span>
                        <span className="font-medium font-[family-name:var(--font-geist-mono)]">{s.winRate}%</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Scan Results */}
      {scanResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Scan Results</CardTitle>
              <Badge variant="secondary" className="text-xs">{scanResults.length} signals</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium" scope="col">Ticker</th>
                    <th className="pb-2 font-medium" scope="col">Strategy</th>
                    <th className="pb-2 font-medium" scope="col">Direction</th>
                    <th className="pb-2 font-medium text-right" scope="col">Strength</th>
                    <th className="pb-2 font-medium text-right" scope="col">Entry</th>
                    <th className="pb-2 font-medium text-right" scope="col">Stop</th>
                    <th className="pb-2 font-medium text-right" scope="col">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {scanResults.map((r, i) => (
                    <tr key={`${r.ticker}-${r.strategy}-${i}`} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-medium font-[family-name:var(--font-geist-mono)]">{r.ticker}</td>
                      <td className="py-2.5">{r.strategy}</td>
                      <td className="py-2.5">
                        <Badge variant={r.direction === 'long' ? 'default' : 'destructive'} className="text-xs">
                          <TrendingUp className={cn('mr-1 h-3 w-3', r.direction === 'short' && 'rotate-180')} />
                          {r.direction}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right font-[family-name:var(--font-geist-mono)]">
                        {(r.strength * 100).toFixed(0)}%
                      </td>
                      <td className="py-2.5 text-right font-[family-name:var(--font-geist-mono)]">
                        {r.entry_price ? `$${r.entry_price.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 text-right font-[family-name:var(--font-geist-mono)] text-red-400">
                        {r.stop_loss ? `$${r.stop_loss.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 text-right font-[family-name:var(--font-geist-mono)] text-emerald-400">
                        {r.take_profit ? `$${r.take_profit.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
