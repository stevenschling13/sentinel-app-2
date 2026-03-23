'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useRealtimeSignals } from '@/hooks/use-realtime-signals';

interface Recommendation {
  id: string;
  agent_role: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  order_type: 'market' | 'limit';
  limit_price?: number | null;
  reason?: string | null;
  strategy_name?: string | null;
  signal_strength?: number | null;
  status: string;
  created_at: string;
}

export default function SignalsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { signals: realtimeSignals } = useRealtimeSignals();

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        setLoading(true);
        const response = await fetch('/api/agents/recommendations?status=pending');
        if (!response.ok) throw new Error('Failed to fetch recommendations');
        const data = await response.json();
        setRecommendations(data.recommendations ?? []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load signals');
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations();
  }, []);

  // Merge REST and realtime signals (deduplicate by id)
  // RealtimeSignalItem has wider types, so we merge into that type first
  const allSignals = [...realtimeSignals, ...recommendations].reduce(
    (acc, signal) => {
      if (!acc.find((s) => s.id === signal.id)) {
        acc.push(signal);
      }
      return acc;
    },
    [] as Array<(typeof realtimeSignals)[0] | Recommendation>,
  );

  // Sort by created_at descending
  const sortedSignals = allSignals.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Format relative time
  const formatRelativeTime = (timestamp: string): string => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHr = Math.floor(diffMs / 3_600_000);

    if (diffMin < 1) return 'just now';
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHr === 1) return '1 hr ago';
    if (diffHr < 24) return `${diffHr} hr ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading signals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-2 p-6">
        <p className="text-sm text-destructive">Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-muted px-3 py-1.5 text-xs hover:bg-muted/80"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Signals</h1>
        <p className="text-xs text-muted-foreground">{sortedSignals.length} active signals</p>
      </div>

      {sortedSignals.length === 0 ? (
        <div className="flex h-96 items-center justify-center">
          <p className="text-sm text-muted-foreground">No active signals</p>
        </div>
      ) : (
        <div className="grid gap-3" role="feed" aria-label="Trading signals">
          {sortedSignals.map((signal) => {
            const direction = signal.side === 'buy' ? 'long' : 'short';
            const strength = signal.signal_strength ?? 0.5;
            const strategy = signal.strategy_name ?? signal.agent_role;
            const reason =
              signal.reason ?? `${signal.order_type} order for ${signal.quantity} shares`;

            return (
              <Card
                key={signal.id}
                role="article"
                aria-label={`${direction} signal for ${signal.ticker}`}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold',
                      direction === 'long'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400',
                    )}
                  >
                    {direction === 'long' ? '▲' : '▼'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-[family-name:var(--font-geist-mono)]">
                        {signal.ticker}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {strategy}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatRelativeTime(signal.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div
                        className="h-1.5 w-24 rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={strength * 100}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Signal strength ${Math.round(strength * 100)}%`}
                      >
                        <div
                          className={cn(
                            'h-full rounded-full',
                            strength > 0.8
                              ? 'bg-emerald-400'
                              : strength > 0.6
                                ? 'bg-yellow-400'
                                : 'bg-red-400',
                          )}
                          style={{ width: `${strength * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(strength * 100)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
