'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface TickerItem {
  ticker: string;
  price: number;
  change: number;
}

export function PriceTicker({ items }: { items: TickerItem[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto rounded-lg border border-border bg-card p-3 scrollbar-none">
      {items.map((item) => (
        <Link
          key={item.ticker}
          href={`/chart/${item.ticker}`}
          className="flex min-w-[120px] items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent/50"
        >
          <span className="text-xs font-semibold text-foreground">{item.ticker}</span>
          <span className="text-xs font-[family-name:var(--font-geist-mono)] text-muted-foreground">
            ${item.price.toFixed(2)}
          </span>
          <span
            className={cn(
              'text-[10px] font-semibold font-[family-name:var(--font-geist-mono)]',
              item.change >= 0 ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {item.change >= 0 ? '+' : ''}
            {item.change.toFixed(2)}%
          </span>
        </Link>
      ))}
    </div>
  );
}
