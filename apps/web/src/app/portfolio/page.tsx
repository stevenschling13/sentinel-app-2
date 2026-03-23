'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { engineUrl, engineHeaders } from '@/lib/engine-fetch';
import { EquityCurve } from '@/components/portfolio/equity-curve';
import { PositionTable, type PositionRow } from '@/components/portfolio/position-table';
import { SectorAllocation } from '@/components/portfolio/sector-allocation';
import type { BrokerAccount, BrokerPosition } from '@/lib/engine-client';

/* ─── Sector mapping & colors ─── */
const SECTOR_MAP: Record<string, string> = {
  AAPL: 'Technology', MSFT: 'Technology', NVDA: 'Technology', GOOGL: 'Communication',
  AMZN: 'Consumer Cyclical', TSLA: 'Consumer Cyclical', META: 'Communication',
  JPM: 'Financial', V: 'Financial', JNJ: 'Healthcare', UNH: 'Healthcare',
  XOM: 'Energy', CVX: 'Energy', SPY: 'Index', QQQ: 'Index',
};
const SECTOR_COLORS: Record<string, string> = {
  Technology: '#3b82f6', Communication: '#8b5cf6', 'Consumer Cyclical': '#f59e0b',
  Financial: '#06b6d4', Healthcare: '#22c55e', Energy: '#ef4444', Index: '#6366f1',
  Other: '#71717a',
};

/* ─── Simulated equity history ─── */
function generateEquityHistory(currentEquity: number): { time: string; value: number }[] {
  const points: { time: string; value: number }[] = [];
  const days = 90;
  let value = currentEquity * 0.92;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    value += value * ((Math.random() - 0.47) * 0.015);
    points.push({ time: dateStr, value: Math.round(value * 100) / 100 });
  }
  // Ensure last point matches current equity
  if (points.length > 0) points[points.length - 1].value = currentEquity;
  return points;
}

/* ─── Fallback data ─── */
const FALLBACK_POSITIONS: PositionRow[] = [
  { ticker: 'AAPL', shares: 50, avgPrice: 178.25, currentPrice: 192.50, marketValue: 9625, unrealizedPnl: 712.50, pnlPct: 7.99, weight: 18.2, sector: 'Technology' },
  { ticker: 'NVDA', shares: 30, avgPrice: 875.00, currentPrice: 920.30, marketValue: 27609, unrealizedPnl: 1359.00, pnlPct: 5.18, weight: 52.2, sector: 'Technology' },
  { ticker: 'MSFT', shares: 25, avgPrice: 415.00, currentPrice: 408.20, marketValue: 10205, unrealizedPnl: -170.00, pnlPct: -1.64, weight: 19.3, sector: 'Technology' },
  { ticker: 'GOOGL', shares: 40, avgPrice: 155.00, currentPrice: 168.40, marketValue: 6736, unrealizedPnl: 536.00, pnlPct: 8.65, weight: 12.7, sector: 'Communication' },
  { ticker: 'TSLA', shares: 15, avgPrice: 245.00, currentPrice: 238.90, marketValue: 3583.50, unrealizedPnl: -91.50, pnlPct: -2.49, weight: 6.8, sector: 'Consumer Cyclical' },
];

const FALLBACK_ACCOUNT: BrokerAccount = {
  equity: 157_758.50,
  cash: 100_000.00,
  positions_value: 57_758.50,
  initial_capital: 150_000.00,
};

export default function PortfolioPage() {
  const [account, setAccount] = useState<BrokerAccount>(FALLBACK_ACCOUNT);
  const [positions, setPositions] = useState<PositionRow[]>(FALLBACK_POSITIONS);
  const [equityHistory, setEquityHistory] = useState<{ time: string; value: number }[]>([]);

  const buildPositionRows = useCallback((raw: BrokerPosition[]): PositionRow[] => {
    const totalMV = raw.reduce((s, p) => s + (p.market_value ?? p.quantity * (p.current_price ?? p.avg_price)), 0);
    return raw.map((p) => {
      const mv = p.market_value ?? p.quantity * (p.current_price ?? p.avg_price);
      const cp = p.current_price ?? p.avg_price;
      const upl = p.unrealized_pl ?? (cp - p.avg_price) * p.quantity;
      const uplPct = p.unrealized_plpc != null ? p.unrealized_plpc * 100 : p.avg_price > 0 ? ((cp - p.avg_price) / p.avg_price) * 100 : 0;
      return {
        ticker: p.instrument_id,
        shares: p.quantity,
        avgPrice: p.avg_price,
        currentPrice: cp,
        marketValue: mv,
        unrealizedPnl: upl,
        pnlPct: uplPct,
        weight: totalMV > 0 ? (mv / totalMV) * 100 : 0,
        sector: SECTOR_MAP[p.instrument_id] ?? 'Other',
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [acctRes, posRes] = await Promise.allSettled([
          fetch(engineUrl('/api/v1/portfolio/account'), { signal: AbortSignal.timeout(6000), headers: engineHeaders() }),
          fetch(engineUrl('/api/v1/portfolio/positions'), { signal: AbortSignal.timeout(6000), headers: engineHeaders() }),
        ]);

        if (!cancelled && acctRes.status === 'fulfilled' && acctRes.value.ok) {
          const data: BrokerAccount = await acctRes.value.json();
          setAccount(data);
        }

        if (!cancelled && posRes.status === 'fulfilled' && posRes.value.ok) {
          const data: BrokerPosition[] = await posRes.value.json();
          if (data.length > 0) setPositions(buildPositionRows(data));
        }
      } catch {
        // Use fallback data
      }
    }
    load();
    return () => { cancelled = true; };
  }, [buildPositionRows]);

  // Generate equity history once account is set
  useEffect(() => {
    setEquityHistory(generateEquityHistory(account.equity));
  }, [account.equity]);

  /* Compute derived values */
  const totalPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const buyingPower = account.buying_power ?? account.cash;

  const sectorData = Object.entries(
    positions.reduce<Record<string, number>>((acc, p) => {
      acc[p.sector] = (acc[p.sector] ?? 0) + p.marketValue;
      return acc;
    }, {}),
  )
    .map(([sector, value]) => ({
      sector,
      value,
      color: SECTOR_COLORS[sector] ?? '#71717a',
    }))
    .sort((a, b) => b.value - a.value);

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-lg font-semibold">Portfolio Analytics</h1>

      {/* Account summary cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Equity</p>
            <p className="mt-1 text-xl font-bold font-[family-name:var(--font-geist-mono)]">${fmt(account.equity)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cash</p>
            <p className="mt-1 text-xl font-bold font-[family-name:var(--font-geist-mono)]">${fmt(account.cash)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Positions Value</p>
            <p className="mt-1 text-xl font-bold font-[family-name:var(--font-geist-mono)]">${fmt(account.positions_value)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Buying Power</p>
            <p className="mt-1 text-xl font-bold font-[family-name:var(--font-geist-mono)]">${fmt(buyingPower)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Equity Curve + Sector Allocation */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Equity Curve (90d)</CardTitle>
          </CardHeader>
          <CardContent>
            {equityHistory.length > 0 ? (
              <EquityCurve data={equityHistory} className="h-[300px] w-full" />
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">Loading…</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sector Allocation</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <SectorAllocation data={sectorData} />
          </CardContent>
        </Card>
      </div>

      {/* Positions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Open Positions</CardTitle>
          <span className={cn('text-xs font-[family-name:var(--font-geist-mono)]', totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            Unrealized: {totalPnl >= 0 ? '+' : ''}${fmt(totalPnl)}
          </span>
        </CardHeader>
        <CardContent>
          <PositionTable positions={positions} />
        </CardContent>
      </Card>
    </div>
  );
}
