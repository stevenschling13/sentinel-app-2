-- Phase 3: Compliance tables — day-trade tracking, wash-sale detection, audit trail.

CREATE TABLE day_trade_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  buy_order_id UUID,
  sell_order_id UUID,
  trade_date DATE NOT NULL,
  shares INTEGER NOT NULL,
  buy_price NUMERIC(18,6),
  sell_price NUMERIC(18,6),
  pnl NUMERIC(18,6),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_day_trade_date ON day_trade_log(trade_date DESC);
CREATE INDEX idx_day_trade_ticker ON day_trade_log(ticker);

CREATE TABLE wash_sale_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  loss_trade_date DATE NOT NULL,
  loss_amount NUMERIC(18,6) NOT NULL,
  repurchase_date DATE,
  repurchase_order_id UUID,
  disallowed_loss NUMERIC(18,6),
  status TEXT NOT NULL DEFAULT 'potential' CHECK (status IN ('potential', 'confirmed', 'cleared')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wash_sale_ticker ON wash_sale_log(ticker);

CREATE TABLE audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('signal', 'recommendation', 'risk_check', 'approval', 'order', 'fill', 'cancel', 'error')),
  entity_id UUID,
  agent_role TEXT,
  ticker TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_trail_type ON audit_trail(event_type);
CREATE INDEX idx_audit_trail_ticker ON audit_trail(ticker);
CREATE INDEX idx_audit_trail_created ON audit_trail(created_at DESC);
