import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const MOCK_SIGNALS = [
  { id: 1, ticker: 'NVDA', strategy: 'Momentum Breakout', direction: 'long' as const, strength: 0.85, time: '2 min ago', reason: 'Price broke above 20-day high with volume surge' },
  { id: 2, ticker: 'AAPL', strategy: 'Mean Reversion', direction: 'long' as const, strength: 0.72, time: '8 min ago', reason: 'RSI oversold bounce with support confirmation' },
  { id: 3, ticker: 'TSLA', strategy: 'Volatility Squeeze', direction: 'short' as const, strength: 0.68, time: '15 min ago', reason: 'Bollinger Band squeeze breakout to downside' },
  { id: 4, ticker: 'META', strategy: 'Trend Following', direction: 'long' as const, strength: 0.91, time: '22 min ago', reason: 'Golden cross with increasing ADX above 25' },
  { id: 5, ticker: 'GOOGL', strategy: 'Momentum Breakout', direction: 'long' as const, strength: 0.64, time: '31 min ago', reason: 'MACD histogram divergence with price action' },
];

export const metadata = { title: 'Signals' };

export default function SignalsPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Signals</h1>
        <p className="text-xs text-muted-foreground">{MOCK_SIGNALS.length} active signals</p>
      </div>

      <div className="grid gap-3" role="feed" aria-label="Trading signals">
        {MOCK_SIGNALS.map((s) => (
          <Card key={s.id} role="article" aria-label={`${s.direction} signal for ${s.ticker}`}>
            <CardContent className="flex items-start gap-4 p-4">
              <div className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold',
                s.direction === 'long' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400',
              )}>
                {s.direction === 'long' ? '▲' : '▼'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold font-[family-name:var(--font-geist-mono)]">{s.ticker}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{s.strategy}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{s.time}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.reason}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full bg-muted" role="progressbar" aria-valuenow={s.strength * 100} aria-valuemin={0} aria-valuemax={100} aria-label={`Signal strength ${Math.round(s.strength * 100)}%`}>
                    <div className={cn('h-full rounded-full', s.strength > 0.8 ? 'bg-emerald-400' : s.strength > 0.6 ? 'bg-yellow-400' : 'bg-red-400')} style={{ width: `${s.strength * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{Math.round(s.strength * 100)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
