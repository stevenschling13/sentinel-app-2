'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { TradeCard, type TradeEntry } from '@/components/journal/trade-card';
import { toast } from 'sonner';
import {
  BookOpen,
  Plus,
  Filter,
  Search,
  X,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Star,
  ChevronDown,
  Loader2,
} from 'lucide-react';

/* ─── Types ─── */
interface JournalEntry {
  id: string;
  ticker: string;
  side: string;
  entry_date: string;
  exit_date: string | null;
  entry_price: number;
  exit_price: number | null;
  shares: number;
  pnl: number | null;
  return_pct: number | null;
  strategy: string | null;
  setup_type: string | null;
  rating: number | null;
  notes: string | null;
  lessons: string | null;
  tags: string[] | null;
  emotional_state: string | null;
  followed_plan: boolean | null;
  created_at: string;
}

interface FormState {
  ticker: string;
  side: 'buy' | 'sell';
  entryPrice: string;
  exitPrice: string;
  shares: string;
  entryDate: string;
  exitDate: string;
  strategy: string;
  setupType: string;
  notes: string;
  lessons: string;
  rating: number;
  emotionalState: string;
  tags: string;
  followedPlan: boolean;
}

const EMPTY_FORM: FormState = {
  ticker: '',
  side: 'buy',
  entryPrice: '',
  exitPrice: '',
  shares: '',
  entryDate: new Date().toISOString().slice(0, 10),
  exitDate: new Date().toISOString().slice(0, 10),
  strategy: '',
  setupType: '',
  notes: '',
  lessons: '',
  rating: 0,
  emotionalState: '',
  tags: '',
  followedPlan: true,
};

const STRATEGIES = [
  'Momentum Breakout',
  'Mean Reversion',
  'Trend Following',
  'Volatility Squeeze',
  'Scalp',
  'Swing',
  'Gap Fill',
  'VWAP Reclaim',
];

const EMOTIONAL_STATES = ['Confident', 'Calm', 'Anxious', 'FOMO', 'Greedy', 'Fearful', 'Neutral', 'Frustrated'];

const PAGE_SIZE = 20;

/* ─── Helpers ─── */
const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function toTradeEntry(e: JournalEntry): TradeEntry {
  const holdingMs =
    e.exit_date && e.entry_date
      ? new Date(e.exit_date).getTime() - new Date(e.entry_date).getTime()
      : null;
  const holdingDays = holdingMs != null ? Math.max(1, Math.round(holdingMs / 86_400_000)) : null;

  return {
    id: e.id,
    date: e.entry_date,
    ticker: e.ticker,
    side: e.side as 'buy' | 'sell',
    entryPrice: e.entry_price,
    exitPrice: e.exit_price ?? e.entry_price,
    shares: e.shares,
    pnl: e.pnl ?? 0,
    pnlPct: e.return_pct ?? 0,
    strategy: e.strategy ?? undefined,
    notes: e.notes ?? undefined,
    holdingPeriod: holdingDays != null ? `${holdingDays}d` : undefined,
  };
}

/* ─── Star Rating ─── */
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === value ? 0 : star)}
          className="focus:outline-none"
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          <Star
            className={cn(
              'h-5 w-5 transition-colors',
              star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-600',
            )}
          />
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function JournalPage() {
  const supabase = useMemo(() => createClient(), []);

  /* ─── Data state ─── */
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  /* ─── Filter state ─── */
  const [tickerSearch, setTickerSearch] = useState('');
  const [sideFilter, setSideFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [strategyFilter, setStrategyFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  /* ─── Form state ─── */
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  /* ─── Fetch entries ─── */
  const fetchEntries = useCallback(
    async (pageNum: number, append = false) => {
      setLoading(true);
      try {
        let query = supabase
          .from('trade_journal_entries')
          .select('*')
          .order('entry_date', { ascending: false })
          .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

        if (tickerSearch) query = query.ilike('ticker', `%${tickerSearch}%`);
        if (sideFilter !== 'all') query = query.eq('side', sideFilter);
        if (strategyFilter) query = query.eq('strategy', strategyFilter);
        if (tagFilter) query = query.contains('tags', [tagFilter]);
        if (dateFrom) query = query.gte('entry_date', dateFrom);
        if (dateTo) query = query.lte('entry_date', dateTo);

        const { data, error } = await query;

        if (error) {
          toast.error('Failed to load entries');
          console.error(error);
          return;
        }

        const rows = (data ?? []) as JournalEntry[];
        setEntries((prev) => (append ? [...prev, ...rows] : rows));
        setHasMore(rows.length === PAGE_SIZE);
      } catch {
        toast.error('Failed to load journal entries');
      } finally {
        setLoading(false);
      }
    },
    [supabase, tickerSearch, sideFilter, strategyFilter, tagFilter, dateFrom, dateTo],
  );

  // Initial load & filter changes
  useEffect(() => {
    setPage(0);
    fetchEntries(0);
  }, [fetchEntries]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchEntries(next, true);
  };

  /* ─── Save new entry ─── */
  const handleSave = async () => {
    if (!form.ticker || !form.entryPrice || !form.shares) {
      toast.error('Ticker, entry price, and shares are required');
      return;
    }

    setSaving(true);
    try {
      const entryPrice = parseFloat(form.entryPrice);
      const exitPrice = form.exitPrice ? parseFloat(form.exitPrice) : null;
      const shares = parseFloat(form.shares);
      const pnl = exitPrice != null ? (exitPrice - entryPrice) * shares * (form.side === 'sell' ? -1 : 1) : null;
      const returnPct = exitPrice != null && entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 * (form.side === 'sell' ? -1 : 1) : null;
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const { error } = await supabase.from('trade_journal_entries').insert({
        ticker: form.ticker.toUpperCase(),
        side: form.side,
        entry_price: entryPrice,
        exit_price: exitPrice,
        shares,
        entry_date: form.entryDate,
        exit_date: form.exitDate || null,
        pnl,
        return_pct: returnPct,
        strategy: form.strategy || null,
        setup_type: form.setupType || null,
        rating: form.rating || null,
        notes: form.notes || null,
        lessons: form.lessons || null,
        tags: tags.length > 0 ? tags : null,
        emotional_state: form.emotionalState || null,
        followed_plan: form.followedPlan,
      });

      if (error) {
        toast.error('Failed to save entry');
        console.error(error);
        return;
      }

      toast.success('Trade entry saved');
      setForm(EMPTY_FORM);
      setShowForm(false);
      setPage(0);
      fetchEntries(0);
    } catch {
      toast.error('Unexpected error saving entry');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Derived stats ─── */
  const trades = useMemo(() => entries.map(toTradeEntry), [entries]);

  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const withPnl = entries.filter((e) => e.pnl != null);
    const wins = withPnl.filter((e) => (e.pnl ?? 0) > 0);
    const totalPnl = withPnl.reduce((s, e) => s + (e.pnl ?? 0), 0);
    const best = withPnl.reduce((m, e) => ((e.pnl ?? 0) > (m.pnl ?? 0) ? e : m), withPnl[0]);
    const worst = withPnl.reduce((m, e) => ((e.pnl ?? 0) < (m.pnl ?? 0) ? e : m), withPnl[0]);

    return {
      total: entries.length,
      winRate: withPnl.length > 0 ? (wins.length / withPnl.length) * 100 : 0,
      avgPnl: withPnl.length > 0 ? totalPnl / withPnl.length : 0,
      bestPnl: best?.pnl ?? 0,
      bestTicker: best?.ticker ?? '—',
      worstPnl: worst?.pnl ?? 0,
      worstTicker: worst?.ticker ?? '—',
    };
  }, [entries]);

  /* ─── Unique strategies & tags for filter dropdowns ─── */
  const uniqueStrategies = useMemo(
    () => [...new Set(entries.map((e) => e.strategy).filter(Boolean))] as string[],
    [entries],
  );
  const uniqueTags = useMemo(
    () => [...new Set(entries.flatMap((e) => e.tags ?? []))],
    [entries],
  );

  /* ─── Render ─── */
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Trade Journal</h1>
            <p className="text-xs text-muted-foreground">
              Track, review, and learn from every trade
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Entry'}
        </Button>
      </div>

      {/* ─── Add Entry Form ─── */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">New Trade Entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Row 1: Core fields */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Ticker *</label>
                <input
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm uppercase placeholder:normal-case placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="AAPL"
                  value={form.ticker}
                  onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Side</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.side}
                  onChange={(e) => setForm((f) => ({ ...f, side: e.target.value as 'buy' | 'sell' }))}
                >
                  <option value="buy">Buy (Long)</option>
                  <option value="sell">Sell (Short)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Entry Price *</label>
                <input
                  type="number"
                  step="0.01"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0.00"
                  value={form.entryPrice}
                  onChange={(e) => setForm((f) => ({ ...f, entryPrice: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Exit Price</label>
                <input
                  type="number"
                  step="0.01"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0.00"
                  value={form.exitPrice}
                  onChange={(e) => setForm((f) => ({ ...f, exitPrice: e.target.value }))}
                />
              </div>
            </div>

            {/* Row 2: Shares, dates */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Shares *</label>
                <input
                  type="number"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="100"
                  value={form.shares}
                  onChange={(e) => setForm((f) => ({ ...f, shares: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Entry Date</label>
                <input
                  type="date"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.entryDate}
                  onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Exit Date</label>
                <input
                  type="date"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.exitDate}
                  onChange={(e) => setForm((f) => ({ ...f, exitDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Strategy</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.strategy}
                  onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value }))}
                >
                  <option value="">None</option>
                  {STRATEGIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Setup, emotional state, rating, followed plan */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Setup Type</label>
                <input
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Bull Flag"
                  value={form.setupType}
                  onChange={(e) => setForm((f) => ({ ...f, setupType: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Emotional State</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.emotionalState}
                  onChange={(e) => setForm((f) => ({ ...f, emotionalState: e.target.value }))}
                >
                  <option value="">None</option>
                  {EMOTIONAL_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Rating</label>
                <StarRating
                  value={form.rating}
                  onChange={(v) => setForm((f) => ({ ...f, rating: v }))}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    checked={form.followedPlan}
                    onChange={(e) => setForm((f) => ({ ...f, followedPlan: e.target.checked }))}
                  />
                  <span className="text-xs text-muted-foreground">Followed plan</span>
                </label>
              </div>
            </div>

            {/* Row 4: Tags */}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Tags (comma-separated)</label>
              <input
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="breakout, earnings, gap-up"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              />
            </div>

            {/* Row 5: Notes & Lessons */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Notes</label>
                <textarea
                  className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="What happened on this trade..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Lessons Learned</label>
                <textarea
                  className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Key takeaways for next time..."
                  value={form.lessons}
                  onChange={(e) => setForm((f) => ({ ...f, lessons: e.target.value }))}
                />
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setForm(EMPTY_FORM); setShowForm(false); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Save Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Filter Bar ─── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Ticker search */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search ticker..."
                value={tickerSearch}
                onChange={(e) => setTickerSearch(e.target.value)}
              />
            </div>

            {/* Side filter */}
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value as 'all' | 'buy' | 'sell')}
            >
              <option value="all">All Sides</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>

            {/* Toggle advanced filters */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className="gap-1.5"
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform', showFilters && 'rotate-180')}
              />
            </Button>

            {/* Clear filters */}
            {(tickerSearch || sideFilter !== 'all' || strategyFilter || tagFilter || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTickerSearch('');
                  setSideFilter('all');
                  setStrategyFilter('');
                  setTagFilter('');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/50 pt-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Strategy</label>
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  value={strategyFilter}
                  onChange={(e) => setStrategyFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {[...new Set([...STRATEGIES, ...uniqueStrategies])].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Tag</label>
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {uniqueTags.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase text-muted-foreground">From</label>
                <input
                  type="date"
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase text-muted-foreground">To</label>
                <input
                  type="date"
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Stats Summary ─── */}
      {stats && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Total Trades</p>
              </div>
              <p className="mt-1 text-xl font-bold font-[family-name:var(--font-geist-mono)]">
                {stats.total}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Win Rate</p>
              </div>
              <p className={cn(
                'mt-1 text-xl font-bold font-[family-name:var(--font-geist-mono)]',
                stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400',
              )}>
                {stats.winRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Avg P&L</p>
              </div>
              <p className={cn(
                'mt-1 text-xl font-bold font-[family-name:var(--font-geist-mono)]',
                stats.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400',
              )}>
                {stats.avgPnl >= 0 ? '+' : ''}${fmt(stats.avgPnl)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <p className="text-xs text-muted-foreground">Best Trade</p>
              </div>
              <p className="mt-1 text-xl font-bold font-[family-name:var(--font-geist-mono)] text-emerald-400">
                +${fmt(stats.bestPnl)}
              </p>
              <p className="text-[10px] text-muted-foreground">{stats.bestTicker}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <p className="text-xs text-muted-foreground">Worst Trade</p>
              </div>
              <p className="mt-1 text-xl font-bold font-[family-name:var(--font-geist-mono)] text-red-400">
                ${fmt(stats.worstPnl)}
              </p>
              <p className="text-[10px] text-muted-foreground">{stats.worstTicker}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Trade List ─── */}
      {loading && entries.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : trades.length === 0 ? (
        /* Empty state */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/50" />
            <h2 className="mt-4 text-sm font-semibold">No journal entries yet</h2>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Start logging your trades to track performance, identify patterns, and improve your strategy over time.
            </p>
            <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Your First Trade
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {trades.length} trade{trades.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="grid gap-3" role="feed" aria-label="Trade journal entries">
            {trades.map((trade) => (
              <TradeCard key={trade.id} trade={trade} />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="mr-1.5 h-4 w-4" />
                )}
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
