'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  TrendingUp,
  Play,
  Loader2,
  RefreshCw,
  BarChart3,
  Shuffle,
  Target,
} from 'lucide-react';

interface BacktestResult {
  strategy: string;
  ticker: string;
  period: string;
  trades: number;
  winRate: number;
  pnl: number;
  sharpe: number;
  maxDD: number;
  equity_curve?: number[];
}

interface AvailableStrategy {
  name: string;
  family?: string;
}

const PERIOD_OPTIONS = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '180d', label: '6 months' },
  { value: '1y', label: '1 year' },
];

export default function BacktestPage() {
  const [strategies, setStrategies] = useState<AvailableStrategy[]>([]);
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [ticker, setTicker] = useState('');
  const [period, setPeriod] = useState('90d');
  const [running, setRunning] = useState(false);
  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [activeTab, setActiveTab] = useState<'backtest' | 'walkforward' | 'montecarlo'>('backtest');
  const [advancedResult, setAdvancedResult] = useState<Record<string, unknown> | null>(null);
  const [runningAdvanced, setRunningAdvanced] = useState(false);

  // Fetch available strategies
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/engine/backtest/strategies', { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.strategies ?? [];
        setStrategies(list.map((s: string | AvailableStrategy) => typeof s === 'string' ? { name: s } : s));
      } catch {
        // Fallback
        setStrategies([
          { name: 'Momentum Breakout' },
          { name: 'Mean Reversion' },
          { name: 'Trend Following' },
          { name: 'Volatility Squeeze' },
        ]);
      } finally {
        setLoadingStrategies(false);
      }
    }
    load();
  }, []);

  const runBacktest = useCallback(async () => {
    if (!selectedStrategy || !ticker) {
      toast.error('Select a strategy and enter a ticker');
      return;
    }
    setRunning(true);
    try {
      const res = await fetch('/api/engine/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: selectedStrategy, ticker: ticker.toUpperCase(), period }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const result: BacktestResult = {
        strategy: selectedStrategy,
        ticker: ticker.toUpperCase(),
        period,
        trades: data.total_trades ?? data.trades ?? 0,
        winRate: data.win_rate ?? data.winRate ?? 0,
        pnl: data.total_pnl ?? data.pnl ?? 0,
        sharpe: data.sharpe_ratio ?? data.sharpe ?? 0,
        maxDD: data.max_drawdown ?? data.maxDD ?? 0,
        equity_curve: data.equity_curve,
      };
      setResults(prev => [result, ...prev]);
      toast.success(`Backtest complete — ${result.trades} trades, Sharpe ${result.sharpe.toFixed(2)}`);
    } catch (err) {
      console.error('Backtest failed:', err);
      toast.error('Backtest failed — is the engine running?');
    } finally {
      setRunning(false);
    }
  }, [selectedStrategy, ticker, period]);

  const runAdvanced = useCallback(async (type: 'walkforward' | 'montecarlo') => {
    if (!selectedStrategy || !ticker) {
      toast.error('Select a strategy and enter a ticker');
      return;
    }
    setRunningAdvanced(true);
    setAdvancedResult(null);
    try {
      const endpoint = type === 'walkforward' ? 'walk-forward' : 'monte-carlo';
      const res = await fetch(`/api/engine/backtest/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: selectedStrategy, ticker: ticker.toUpperCase(), period }),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAdvancedResult(data);
      toast.success(`${type === 'walkforward' ? 'Walk-Forward' : 'Monte Carlo'} analysis complete`);
    } catch (err) {
      console.error(`${type} failed:`, err);
      toast.error(`${type} analysis failed`);
    } finally {
      setRunningAdvanced(false);
    }
  }, [selectedStrategy, ticker, period]);

  const selectClasses = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary';
  const inputClasses = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">Backtesting</h1>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="bt-strategy" className="mb-1 block text-xs font-medium text-muted-foreground">Strategy</label>
              <select
                id="bt-strategy"
                className={selectClasses}
                value={selectedStrategy}
                onChange={e => setSelectedStrategy(e.target.value)}
                disabled={loadingStrategies}
              >
                <option value="" disabled>Select strategy…</option>
                {strategies.map(s => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bt-ticker" className="mb-1 block text-xs font-medium text-muted-foreground">Ticker</label>
              <input
                id="bt-ticker"
                type="text"
                placeholder="e.g. AAPL"
                className={inputClasses}
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && runBacktest()}
              />
            </div>
            <div>
              <label htmlFor="bt-period" className="mb-1 block text-xs font-medium text-muted-foreground">Period</label>
              <select
                id="bt-period"
                className={selectClasses}
                value={period}
                onChange={e => setPeriod(e.target.value)}
              >
                {PERIOD_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={runBacktest} disabled={running || !selectedStrategy || !ticker}>
              {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
              Run Backtest
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setActiveTab('walkforward'); runAdvanced('walkforward'); }} disabled={runningAdvanced || !selectedStrategy || !ticker}>
              <Shuffle className="mr-1.5 h-3.5 w-3.5" />
              Walk-Forward
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setActiveTab('montecarlo'); runAdvanced('montecarlo'); }} disabled={runningAdvanced || !selectedStrategy || !ticker}>
              <Target className="mr-1.5 h-3.5 w-3.5" />
              Monte Carlo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Results</CardTitle>
            {results.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setResults([])}>
                <RefreshCw className="mr-1.5 h-3 w-3" /> Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {results.length === 0 && !running ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <BarChart3 className="mb-2 h-8 w-8" />
              <p className="text-sm">No results yet. Configure and run a backtest above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {running && (
                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Running backtest…
                </div>
              )}
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium" scope="col">Strategy</th>
                    <th className="pb-2 font-medium" scope="col">Ticker</th>
                    <th className="pb-2 font-medium" scope="col">Period</th>
                    <th className="pb-2 font-medium text-right" scope="col">Trades</th>
                    <th className="pb-2 font-medium text-right" scope="col">Win Rate</th>
                    <th className="pb-2 font-medium text-right" scope="col">P&amp;L</th>
                    <th className="pb-2 font-medium text-right" scope="col">Sharpe</th>
                    <th className="pb-2 font-medium text-right" scope="col">Max DD</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={`${r.strategy}-${r.ticker}-${i}`} className="border-b border-border/50 last:border-0">
                      <td className="py-3 font-medium">{r.strategy}</td>
                      <td className="py-3 font-[family-name:var(--font-geist-mono)]">{r.ticker}</td>
                      <td className="py-3 text-muted-foreground">{r.period}</td>
                      <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">{r.trades}</td>
                      <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">{r.winRate.toFixed(1)}%</td>
                      <td className={cn('py-3 text-right font-[family-name:var(--font-geist-mono)]', r.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {r.pnl >= 0 ? '+' : ''}${r.pnl.toLocaleString()}
                      </td>
                      <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">{r.sharpe.toFixed(2)}</td>
                      <td className="py-3 text-right font-[family-name:var(--font-geist-mono)] text-red-400">{r.maxDD.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Analysis Results */}
      {advancedResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {activeTab === 'walkforward' ? 'Walk-Forward Analysis' : 'Monte Carlo Simulation'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded bg-muted p-4 text-xs font-[family-name:var(--font-geist-mono)]">
              {JSON.stringify(advancedResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {runningAdvanced && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            Running {activeTab === 'walkforward' ? 'walk-forward' : 'Monte Carlo'} analysis…
          </span>
        </div>
      )}
    </div>
  );
}
