import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const MOCK_POSITIONS = [
  { ticker: 'AAPL', shares: 50, avgCost: 178.25, current: 192.50, pnl: 712.50, pnlPct: 7.99 },
  { ticker: 'NVDA', shares: 30, avgCost: 875.00, current: 920.30, pnl: 1359.00, pnlPct: 5.18 },
  { ticker: 'MSFT', shares: 25, avgCost: 415.00, current: 408.20, pnl: -170.00, pnlPct: -1.64 },
  { ticker: 'GOOGL', shares: 40, avgCost: 155.00, current: 168.40, pnl: 536.00, pnlPct: 8.65 },
  { ticker: 'TSLA', shares: 15, avgCost: 245.00, current: 238.90, pnl: -91.50, pnlPct: -2.49 },
];

export const metadata = { title: 'Portfolio' };

export default function PortfolioPage() {
  const totalValue = MOCK_POSITIONS.reduce((s, p) => s + p.shares * p.current, 0);
  const totalPnl = MOCK_POSITIONS.reduce((s, p) => s + p.pnl, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Portfolio</h1>
        <span className="text-sm text-muted-foreground">
          Total Value: <strong className="text-foreground">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Equity</p>
            <p className="mt-1 text-xl font-bold font-[family-name:var(--font-geist-mono)]">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Unrealized P&amp;L</p>
            <p className={cn('mt-1 text-xl font-bold font-[family-name:var(--font-geist-mono)]', totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Positions</p>
            <p className="mt-1 text-xl font-bold font-[family-name:var(--font-geist-mono)]">{MOCK_POSITIONS.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto" role="region" aria-label="Positions table">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium" scope="col">Ticker</th>
                  <th className="pb-2 font-medium text-right" scope="col">Shares</th>
                  <th className="pb-2 font-medium text-right" scope="col">Avg Cost</th>
                  <th className="pb-2 font-medium text-right" scope="col">Current</th>
                  <th className="pb-2 font-medium text-right" scope="col">P&amp;L</th>
                  <th className="pb-2 font-medium text-right" scope="col">P&amp;L %</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_POSITIONS.map((p) => (
                  <tr key={p.ticker} className="border-b border-border/50 last:border-0">
                    <td className="py-3 font-medium font-[family-name:var(--font-geist-mono)]">{p.ticker}</td>
                    <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">{p.shares}</td>
                    <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">${p.avgCost.toFixed(2)}</td>
                    <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">${p.current.toFixed(2)}</td>
                    <td className={cn('py-3 text-right font-[family-name:var(--font-geist-mono)]', p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                    </td>
                    <td className={cn('py-3 text-right font-[family-name:var(--font-geist-mono)]', p.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(2)}%
                    </td>
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
