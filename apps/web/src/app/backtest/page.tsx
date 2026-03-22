import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const MOCK_RESULTS = [
  { strategy: 'Momentum Breakout', ticker: 'AAPL', period: '2024 Q1', trades: 24, winRate: 66.7, pnl: 3420, sharpe: 1.82, maxDD: -4.2 },
  { strategy: 'Trend Following', ticker: 'NVDA', period: '2024 Q1', trades: 18, winRate: 61.1, pnl: 5890, sharpe: 2.14, maxDD: -6.8 },
  { strategy: 'Mean Reversion', ticker: 'SPY', period: '2024 Q1', trades: 31, winRate: 74.2, pnl: 1250, sharpe: 1.45, maxDD: -2.1 },
];

export const metadata = { title: 'Backtesting' };

export default function BacktestPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-lg font-semibold">Backtesting</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="bt-strategy" className="mb-1 block text-xs font-medium text-muted-foreground">Strategy</label>
              <select id="bt-strategy" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" aria-label="Select strategy" defaultValue="">
                <option value="" disabled>Select strategy…</option>
                <option>Momentum Breakout</option>
                <option>Mean Reversion</option>
                <option>Trend Following</option>
              </select>
            </div>
            <div>
              <label htmlFor="bt-ticker" className="mb-1 block text-xs font-medium text-muted-foreground">Ticker</label>
              <input id="bt-ticker" type="text" placeholder="e.g. AAPL" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" aria-label="Ticker symbol" />
            </div>
            <div>
              <label htmlFor="bt-period" className="mb-1 block text-xs font-medium text-muted-foreground">Period</label>
              <select id="bt-period" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" aria-label="Select period" defaultValue="90d">
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
                <option value="180d">180 days</option>
                <option value="1y">1 year</option>
              </select>
            </div>
          </div>
          <button type="button" className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50" aria-label="Run backtest">
            Run Backtest
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto" role="region" aria-label="Backtest results">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium" scope="col">Strategy</th>
                  <th className="pb-2 font-medium" scope="col">Ticker</th>
                  <th className="pb-2 font-medium text-right" scope="col">Trades</th>
                  <th className="pb-2 font-medium text-right" scope="col">Win Rate</th>
                  <th className="pb-2 font-medium text-right" scope="col">P&amp;L</th>
                  <th className="pb-2 font-medium text-right" scope="col">Sharpe</th>
                  <th className="pb-2 font-medium text-right" scope="col">Max DD</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_RESULTS.map((r) => (
                  <tr key={`${r.strategy}-${r.ticker}`} className="border-b border-border/50 last:border-0">
                    <td className="py-3 font-medium">{r.strategy}</td>
                    <td className="py-3 font-[family-name:var(--font-geist-mono)]">{r.ticker}</td>
                    <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">{r.trades}</td>
                    <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">{r.winRate}%</td>
                    <td className={cn('py-3 text-right font-[family-name:var(--font-geist-mono)]', r.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {r.pnl >= 0 ? '+' : ''}${r.pnl.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">{r.sharpe.toFixed(2)}</td>
                    <td className="py-3 text-right font-[family-name:var(--font-geist-mono)] text-red-400">{r.maxDD}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
