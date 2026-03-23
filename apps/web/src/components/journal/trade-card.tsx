'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export interface TradeEntry {
  id: string;
  date: string;
  ticker: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  shares: number;
  pnl: number;
  pnlPct: number;
  strategy?: string;
  notes?: string;
  holdingPeriod?: string;
}

export function TradeCard({ trade }: { trade: TradeEntry }) {
  const [expanded, setExpanded] = useState(false);
  const profitable = trade.pnl >= 0;

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:border-zinc-700',
        profitable ? 'border-l-2 border-l-emerald-500/60' : 'border-l-2 border-l-red-500/60',
      )}
      onClick={() => setExpanded((e) => !e)}
    >
      <CardContent className="p-4">
        {/* Main row */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold',
              trade.side === 'buy'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-red-500/20 text-red-400',
            )}
          >
            {trade.side === 'buy' ? '▲' : '▼'}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold font-[family-name:var(--font-geist-mono)]">
                {trade.ticker}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {trade.side}
              </span>
              <span className="text-xs text-muted-foreground">{trade.shares} shares</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(trade.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
              {trade.strategy && <span className="ml-2">· {trade.strategy}</span>}
            </p>
          </div>

          <div className="text-right">
            <p
              className={cn(
                'text-sm font-bold font-[family-name:var(--font-geist-mono)]',
                profitable ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {profitable ? '+' : ''}${fmt(trade.pnl)}
            </p>
            <p
              className={cn(
                'text-xs font-[family-name:var(--font-geist-mono)]',
                profitable ? 'text-emerald-400/70' : 'text-red-400/70',
              )}
            >
              {profitable ? '+' : ''}{fmt(trade.pnlPct)}%
            </p>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 border-t border-border/50 pt-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
              <div>
                <span className="text-muted-foreground">Entry</span>
                <p className="font-[family-name:var(--font-geist-mono)] font-medium">${fmt(trade.entryPrice)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Exit</span>
                <p className="font-[family-name:var(--font-geist-mono)] font-medium">${fmt(trade.exitPrice)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Shares</span>
                <p className="font-[family-name:var(--font-geist-mono)] font-medium">{trade.shares}</p>
              </div>
              {trade.holdingPeriod && (
                <div>
                  <span className="text-muted-foreground">Holding</span>
                  <p className="font-medium">{trade.holdingPeriod}</p>
                </div>
              )}
            </div>
            {trade.notes && (
              <p className="mt-2 text-xs text-muted-foreground">{trade.notes}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
