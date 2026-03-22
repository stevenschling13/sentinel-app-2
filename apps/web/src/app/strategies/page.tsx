import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MOCK_STRATEGIES = [
  { name: 'Momentum Breakout', family: 'momentum', description: 'Detects price breakouts above resistance with volume confirmation.', signals: 12, winRate: 68 },
  { name: 'Mean Reversion', family: 'mean_reversion', description: 'Identifies oversold/overbought conditions for mean reversion entries.', signals: 8, winRate: 72 },
  { name: 'Trend Following', family: 'trend', description: 'Follows established trends using moving average crossovers and ADX.', signals: 15, winRate: 61 },
  { name: 'Volatility Squeeze', family: 'volatility', description: 'Detects low-volatility consolidation before explosive moves.', signals: 6, winRate: 58 },
  { name: 'Gap Analysis', family: 'gap', description: 'Analyzes overnight gaps for continuation or fill probabilities.', signals: 4, winRate: 65 },
  { name: 'Volume Profile', family: 'volume', description: 'Maps price action against volume distribution to find value areas.', signals: 9, winRate: 63 },
];

export const metadata = { title: 'Strategies' };

export default function StrategiesPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Strategies</h1>
        <p className="text-xs text-muted-foreground">{MOCK_STRATEGIES.length} available</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Trading strategies">
        {MOCK_STRATEGIES.map((s) => (
          <Card key={s.name} role="listitem">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{s.name}</CardTitle>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{s.family}</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{s.description}</p>
              <div className="mt-3 flex gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Signals: </span>
                  <span className="font-medium font-[family-name:var(--font-geist-mono)]">{s.signals}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Win Rate: </span>
                  <span className="font-medium font-[family-name:var(--font-geist-mono)]">{s.winRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
