'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface PositionRow {
  ticker: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  pnlPct: number;
  weight: number;
  sector: string;
}

type SortKey = 'ticker' | 'shares' | 'avgPrice' | 'currentPrice' | 'marketValue' | 'unrealizedPnl' | 'pnlPct' | 'weight';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'ticker', label: 'Ticker', align: 'left' },
  { key: 'shares', label: 'Shares', align: 'right' },
  { key: 'avgPrice', label: 'Avg Price', align: 'right' },
  { key: 'currentPrice', label: 'Current', align: 'right' },
  { key: 'marketValue', label: 'Mkt Value', align: 'right' },
  { key: 'unrealizedPnl', label: 'Unreal P&L', align: 'right' },
  { key: 'pnlPct', label: 'P&L %', align: 'right' },
  { key: 'weight', label: 'Weight', align: 'right' },
];

export function PositionTable({ positions }: { positions: PositionRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('marketValue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'ticker' ? 'asc' : 'desc');
    }
  };

  const sorted = [...positions].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const fmt = (n: number, decimals = 2) => n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <div className="overflow-x-auto" role="region" aria-label="Positions table">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'cursor-pointer select-none pb-2 font-medium hover:text-foreground',
                  col.align === 'right' && 'text-right',
                )}
                onClick={() => handleSort(col.key)}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.ticker} className="border-b border-border/50 last:border-0">
              <td className="py-3 font-medium font-[family-name:var(--font-geist-mono)]">{p.ticker}</td>
              <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">{p.shares}</td>
              <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">${fmt(p.avgPrice)}</td>
              <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">${fmt(p.currentPrice)}</td>
              <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">${fmt(p.marketValue)}</td>
              <td className={cn('py-3 text-right font-[family-name:var(--font-geist-mono)]', p.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {p.unrealizedPnl >= 0 ? '+' : ''}${fmt(p.unrealizedPnl)}
              </td>
              <td className={cn('py-3 text-right font-[family-name:var(--font-geist-mono)]', p.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {p.pnlPct >= 0 ? '+' : ''}{fmt(p.pnlPct)}%
              </td>
              <td className="py-3 text-right font-[family-name:var(--font-geist-mono)]">{fmt(p.weight, 1)}%</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-muted-foreground">No open positions</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
