-- Phase 5.3: Performance — indexes, partitioning hints, materialized views.

-- =====================
-- Composite Indexes for Hot Query Paths
-- =====================

-- Recommendations listing with status filter (dashboard, signals page)
CREATE INDEX IF NOT EXISTS idx_agent_recs_status_created
  ON agent_recommendations (status, created_at DESC);

-- Recommendations by ticker for trade journal correlation
CREATE INDEX IF NOT EXISTS idx_agent_recs_ticker_created
  ON agent_recommendations (ticker, created_at DESC);

-- Orders by account + status (portfolio page, execution pipeline)
CREATE INDEX IF NOT EXISTS idx_orders_account_status
  ON orders (account_id, status, created_at DESC);

-- Trades by instrument for journal and P&L queries
CREATE INDEX IF NOT EXISTS idx_trades_instrument_closed
  ON trades (instrument_id, closed_at DESC)
  WHERE status = 'closed';

-- Open positions per account (portfolio dashboard hot path)
CREATE INDEX IF NOT EXISTS idx_positions_account_active
  ON portfolio_positions (account_id, updated_at DESC);

-- Market data covering index for OHLCV lookups
CREATE INDEX IF NOT EXISTS idx_market_data_covering
  ON market_data (instrument_id, timeframe, timestamp DESC)
  INCLUDE (open, high, low, close, volume);

-- News articles by ticker + recency (news panel, sentiment queries)
CREATE INDEX IF NOT EXISTS idx_news_ticker_published
  ON news_articles (ticker, published_at DESC)
  INCLUDE (headline, sentiment_score, sentiment_label);

-- Audit trail by entity for drill-down
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity
  ON audit_trail (entity_id, created_at DESC)
  WHERE entity_id IS NOT NULL;

-- Agent logs by status for error monitoring (observability)
CREATE INDEX IF NOT EXISTS idx_agent_logs_errors
  ON agent_logs (created_at DESC)
  WHERE status = 'error';

-- Backtest results by strategy for comparison page
CREATE INDEX IF NOT EXISTS idx_backtest_strategy_date
  ON backtest_results (strategy_id, created_at DESC);

-- =====================
-- Materialized Views for Dashboard Aggregates
-- =====================

-- Daily P&L summary (avoids repeated full-table scans)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_pnl AS
SELECT
  t.account_id,
  DATE(t.closed_at) AS trade_date,
  COUNT(*)::INTEGER AS trades,
  SUM(CASE WHEN t.net_pnl > 0 THEN 1 ELSE 0 END)::INTEGER AS wins,
  SUM(CASE WHEN t.net_pnl <= 0 THEN 1 ELSE 0 END)::INTEGER AS losses,
  SUM(t.net_pnl) AS net_pnl,
  SUM(t.gross_pnl) AS gross_pnl,
  SUM(t.total_costs) AS total_costs,
  AVG(t.return_pct) AS avg_return_pct
FROM trades t
WHERE t.status = 'closed' AND t.closed_at IS NOT NULL
GROUP BY t.account_id, DATE(t.closed_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_pnl_pk
  ON mv_daily_pnl (account_id, trade_date);

-- Strategy performance summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_strategy_performance AS
SELECT
  s.id AS strategy_id,
  s.name AS strategy_name,
  s.family,
  COUNT(t.id)::INTEGER AS total_trades,
  SUM(CASE WHEN t.net_pnl > 0 THEN 1 ELSE 0 END)::INTEGER AS wins,
  CASE WHEN COUNT(t.id) > 0
    THEN ROUND(SUM(CASE WHEN t.net_pnl > 0 THEN 1 ELSE 0 END)::NUMERIC / COUNT(t.id) * 100, 1)
    ELSE 0
  END AS win_rate,
  COALESCE(SUM(t.net_pnl), 0) AS total_pnl,
  COALESCE(AVG(t.return_pct), 0) AS avg_return,
  COALESCE(AVG(t.holding_period_days), 0) AS avg_holding_days,
  COUNT(DISTINCT t.instrument_id)::INTEGER AS tickers_traded,
  MAX(t.closed_at) AS last_trade_at
FROM strategies s
LEFT JOIN trades t ON t.strategy_id = s.id AND t.status = 'closed'
GROUP BY s.id, s.name, s.family;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_strategy_perf_pk
  ON mv_strategy_performance (strategy_id);

-- Agent cycle health (for observability page)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_agent_health AS
SELECT
  agent_name,
  DATE(created_at) AS log_date,
  COUNT(*)::INTEGER AS total_runs,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::INTEGER AS successes,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::INTEGER AS errors,
  SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END)::INTEGER AS timeouts,
  AVG(duration_ms)::INTEGER AS avg_duration_ms,
  MAX(duration_ms)::INTEGER AS max_duration_ms,
  SUM(tokens_used)::INTEGER AS total_tokens
FROM agent_logs
GROUP BY agent_name, DATE(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_agent_health_pk
  ON mv_agent_health (agent_name, log_date);

-- =====================
-- Refresh Function (call via cron or after batch operations)
-- =====================

CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_pnl;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_strategy_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_agent_health;
END;
$$;

-- =====================
-- Trade Journal Table (for Phase 4.4)
-- =====================

CREATE TABLE trade_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  ticker TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  entry_date DATE NOT NULL,
  exit_date DATE,
  entry_price NUMERIC(18,6),
  exit_price NUMERIC(18,6),
  shares NUMERIC(18,6),
  pnl NUMERIC(18,6),
  return_pct NUMERIC(10,6),
  strategy TEXT,
  setup_type TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  lessons TEXT,
  tags TEXT[] DEFAULT '{}',
  screenshots TEXT[] DEFAULT '{}',
  emotional_state TEXT CHECK (emotional_state IN ('confident', 'fearful', 'greedy', 'neutral', 'disciplined', 'impulsive')),
  followed_plan BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_journal_user_date ON trade_journal_entries (user_id, entry_date DESC);
CREATE INDEX idx_journal_ticker ON trade_journal_entries (ticker, entry_date DESC);
CREATE INDEX idx_journal_tags ON trade_journal_entries USING GIN (tags);

ALTER TABLE trade_journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_journal" ON trade_journal_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add to realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE trade_journal_entries;
