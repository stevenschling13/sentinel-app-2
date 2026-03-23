'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TrendingUp, Play, Loader2, RefreshCw, BarChart3, Shuffle, Target } from 'lucide-react';

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
        const res = await fetch('/api/engine/backtest/strategies', {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.strategies ?? []);
        setStrategies(
          list.map((s: string | AvailableStrategy) => (typeof s === 'string' ? { name: s } : s)),
        );
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
      setResults((prev) => [result, ...prev]);
      toast.success(
        `Backtest complete — ${result.trades} trades, Sharpe ${result.sharpe.toFixed(2)}`,
      );
    } catch (err) {
      console.error('Backtest failed:', err);
      toast.error('Backtest failed — is the engine running?');
    } finally {
      setRunning(false);
    }
  }, [selectedStrategy, ticker, period]);

  const runAdvanced = useCallback(
    async (type: 'walkforward' | 'montecarlo') => {
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
          body: JSON.stringify({
            strategy: selectedStrategy,
            ticker: ticker.toUpperCase(),
            period,
          }),
          signal: AbortSignal.timeout(120000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAdvancedResult(data);
        toast.success(
          `${type === 'walkforward' ? 'Walk-Forward' : 'Monte Carlo'} analysis complete`,
        );
      } catch (err) {
        console.error(`${type} failed:`, err);
        toast.error(`${type} analysis failed`);
      } finally {
        setRunningAdvanced(false);
      }
    },
    [selectedStrategy, ticker, period],
  );

  const selectClasses =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary';
  const inputClasses =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary';

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
              <label
                htmlFor="bt-strategy"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Strategy
              </label>
              <select
                id="bt-strategy"
                className={selectClasses}
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                disabled={loadingStrategies}
              >
                <option value="" disabled>
                  Select strategy…
                </option>
                {strategies.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="bt-ticker"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Ticker
              </label>
              <input
                id="bt-ticker"
                type="text"
                placeholder="e.g. AAPL"
                className={inputClasses}
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && runBacktest()}
              />
            </div>
            <div>
              <label
                htmlFor="bt-period"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Period
              </label>
              <select
                id="bt-period"
                className={selectClasses}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={runBacktest} disabled={running || !selectedStrategy || !ticker}>
              {running ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              Run Backtest
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTab('walkforward');
                runAdvanced('walkforward');
              }}
              disabled={runningAdvanced || !selectedStrategy || !ticker}
            >
              <Shuffle className="mr-1.5 h-3.5 w-3.5" />
              Walk-Forward
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTab('montecarlo');
                runAdvanced('montecarlo');
              }}
              disabled={runningAdvanced || !selectedStrategy || !ticker}
            >
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
                    <th className="pb-2 font-medium" scope="col">
                      Strategy
                    </th>
                    <th className="pb-2 font-medium" scope="col">
                      Ticker
                    </th>
                    <th className="pb-2 font-medium" scope="col">
                      Period
                    </th>
                    <th className="pb-2 font-medium text-right" scope="col">
                      Trades
                    </th>
                    <th className="pb-2 font-medium text-right" scope="col">
                      Win Rate
                    </th>
                    <th className="pb-2 font-medium text-right" scope="col">
                      P&amp;L
                    </th>
                    <th className="pb-2 font-medium text-right" scope="col">
                      Sharpe
                    </th>
                    <th className="pb-2 font-medium text-right" scope="col">
                      Max DD
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr
                      key={`${r.strategy}-${r.ticker}-${i}`}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-3 font-medium">{r.strategy}</td>
                      <td className="py-3 font-[family-name:var(--font-geist-mono)]">{r.ticker}</td>
                      <td className="py-3 text-muted-foreground">{r.period}</td>
                      <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">
                        {r.trades}
                      </td>
                      <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">
                        {r.winRate.toFixed(1)}%
                      </td>
                      <td
                        className={cn(
                          'py-3 text-right font-[family-name:var(--font-geist-mono)]',
                          r.pnl >= 0 ? 'text-emerald-400' : 'text-red-400',
                        )}
                      >
                        {r.pnl >= 0 ? '+' : ''}${r.pnl.toLocaleString()}
                      </td>
                      <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">
                        {r.sharpe.toFixed(2)}
                      </td>
                      <td className="py-3 text-right font-[family-name:var(--font-geist-mono)] text-red-400">
                        {r.maxDD.toFixed(1)}%
                      </td>
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
            {activeTab === 'walkforward' ? (
              <WalkForwardResults data={advancedResult} />
            ) : (
              <MonteCarloResults data={advancedResult} />
            )}
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

// Walk-Forward Analysis Results Component
interface WalkForwardData {
  summary: {
    strategy_name: string;
    ticker: string;
    num_windows: number;
    avg_in_sample_sharpe: number;
    avg_out_sample_sharpe: number;
    avg_in_sample_return: number;
    avg_out_sample_return: number;
    efficiency_ratio: number;
  };
  windows: Array<{
    window_index: number;
    in_sample_sharpe: number;
    out_sample_sharpe: number;
    in_sample_return: number;
    out_sample_return: number;
  }>;
}

function WalkForwardResults({ data }: { data: Record<string, unknown> }) {
  const wfData = data as unknown as WalkForwardData;
  const { summary, windows } = wfData;

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label="Avg In-Sample Sharpe"
          value={summary.avg_in_sample_sharpe.toFixed(2)}
          color="blue"
        />
        <MetricCard
          label="Avg Out-Sample Sharpe"
          value={summary.avg_out_sample_sharpe.toFixed(2)}
          color={summary.avg_out_sample_sharpe >= summary.avg_in_sample_sharpe ? 'green' : 'orange'}
        />
        <MetricCard
          label="Efficiency Ratio"
          value={summary.efficiency_ratio.toFixed(2)}
          color={
            summary.efficiency_ratio >= 0.8
              ? 'green'
              : summary.efficiency_ratio >= 0.6
                ? 'orange'
                : 'red'
          }
          subtitle={
            summary.efficiency_ratio >= 0.8
              ? 'Robust'
              : summary.efficiency_ratio >= 0.6
                ? 'Moderate'
                : 'Overfit'
          }
        />
        <MetricCard label="Windows Tested" value={summary.num_windows.toString()} color="purple" />
      </div>

      {/* Returns Comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border border-border p-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Avg In-Sample Return</div>
          <div
            className={cn(
              'text-2xl font-bold',
              summary.avg_in_sample_return >= 0 ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {summary.avg_in_sample_return >= 0 ? '+' : ''}
            {(summary.avg_in_sample_return * 100).toFixed(2)}%
          </div>
        </div>
        <div className="rounded-md border border-border p-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Avg Out-Sample Return
          </div>
          <div
            className={cn(
              'text-2xl font-bold',
              summary.avg_out_sample_return >= 0 ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {summary.avg_out_sample_return >= 0 ? '+' : ''}
            {(summary.avg_out_sample_return * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Window-by-Window Results */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Window Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Window</th>
                <th className="pb-2 font-medium text-right">In-Sample Sharpe</th>
                <th className="pb-2 font-medium text-right">Out-Sample Sharpe</th>
                <th className="pb-2 font-medium text-right">In-Sample Return</th>
                <th className="pb-2 font-medium text-right">Out-Sample Return</th>
              </tr>
            </thead>
            <tbody>
              {windows.map((w) => (
                <tr key={w.window_index} className="border-b border-border/50 last:border-0">
                  <td className="py-2 font-medium">Window {w.window_index}</td>
                  <td className="py-2 text-right font-[family-name:var(--font-geist-mono)]">
                    {w.in_sample_sharpe.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      'py-2 text-right font-[family-name:var(--font-geist-mono)]',
                      w.out_sample_sharpe >= w.in_sample_sharpe
                        ? 'text-emerald-400'
                        : 'text-orange-400',
                    )}
                  >
                    {w.out_sample_sharpe.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      'py-2 text-right font-[family-name:var(--font-geist-mono)]',
                      w.in_sample_return >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {(w.in_sample_return * 100).toFixed(2)}%
                  </td>
                  <td
                    className={cn(
                      'py-2 text-right font-[family-name:var(--font-geist-mono)]',
                      w.out_sample_return >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {(w.out_sample_return * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Monte Carlo Results Component
interface MonteCarloData {
  num_simulations: number;
  median_return: number;
  p5_return: number;
  p95_return: number;
  probability_of_profit: number;
  max_drawdown_median: number;
}

function MonteCarloResults({ data }: { data: Record<string, unknown> }) {
  const mcData = data as unknown as MonteCarloData;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Probability of Profit"
          value={`${(mcData.probability_of_profit * 100).toFixed(1)}%`}
          color={
            mcData.probability_of_profit >= 0.7
              ? 'green'
              : mcData.probability_of_profit >= 0.5
                ? 'orange'
                : 'red'
          }
        />
        <MetricCard
          label="Median Return"
          value={`${(mcData.median_return * 100).toFixed(2)}%`}
          color={mcData.median_return >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          label="Median Max Drawdown"
          value={`${(mcData.max_drawdown_median * 100).toFixed(2)}%`}
          color="red"
        />
      </div>

      {/* Confidence Interval Visualization */}
      <div className="rounded-md border border-border p-4">
        <h3 className="mb-4 text-sm font-medium">
          Return Confidence Interval (5th - 95th Percentile)
        </h3>
        <div className="space-y-3">
          {/* Visual bar chart */}
          <div className="relative h-16 rounded-md bg-muted">
            {/* P5 to Median (left half - typically red/orange) */}
            <div
              className="absolute h-full rounded-l-md bg-gradient-to-r from-red-500/30 to-orange-500/30"
              style={{
                left: '0%',
                width: '50%',
              }}
            />
            {/* Median to P95 (right half - typically orange/green) */}
            <div
              className="absolute h-full rounded-r-md bg-gradient-to-r from-orange-500/30 to-emerald-500/30"
              style={{
                left: '50%',
                width: '50%',
              }}
            />
            {/* Markers */}
            <div className="absolute left-0 top-0 h-full w-0.5 bg-red-500" title="5th Percentile" />
            <div
              className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-foreground"
              title="Median"
            />
            <div
              className="absolute right-0 top-0 h-full w-0.5 bg-emerald-500"
              title="95th Percentile"
            />
          </div>

          {/* Labels */}
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="mb-1 font-medium text-red-400">5th Percentile (Worst Case)</div>
              <div className="font-[family-name:var(--font-geist-mono)] text-lg">
                {mcData.p5_return >= 0 ? '+' : ''}
                {(mcData.p5_return * 100).toFixed(2)}%
              </div>
            </div>
            <div className="text-center">
              <div className="mb-1 font-medium text-muted-foreground">Median (Expected)</div>
              <div
                className={cn(
                  'font-[family-name:var(--font-geist-mono)] text-lg',
                  mcData.median_return >= 0 ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {mcData.median_return >= 0 ? '+' : ''}
                {(mcData.median_return * 100).toFixed(2)}%
              </div>
            </div>
            <div className="text-right">
              <div className="mb-1 font-medium text-emerald-400">95th Percentile (Best Case)</div>
              <div className="font-[family-name:var(--font-geist-mono)] text-lg">
                {mcData.p95_return >= 0 ? '+' : ''}
                {(mcData.p95_return * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Simulation Info */}
      <div className="rounded-md bg-muted/50 p-4 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">{mcData.num_simulations.toLocaleString()}</strong>{' '}
          simulations run using bootstrap resampling. This confidence interval shows the range of
          likely outcomes based on historical trade performance.
        </p>
      </div>
    </div>
  );
}

// Reusable Metric Card Component
function MetricCard({
  label,
  value,
  color,
  subtitle,
}: {
  label: string;
  value: string;
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  subtitle?: string;
}) {
  const colorClasses = {
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    orange: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    red: 'border-red-500/30 bg-red-500/10 text-red-400',
    purple: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
  };

  return (
    <div className={cn('rounded-md border p-3', colorClasses[color])}>
      <div className="mb-1 text-xs font-medium opacity-80">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {subtitle && <div className="mt-0.5 text-xs opacity-70">{subtitle}</div>}
    </div>
  );
}
