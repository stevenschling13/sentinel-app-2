import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { TradeCard, type TradeEntry } from '@/components/journal/trade-card';

function makeTrade(overrides: Partial<TradeEntry> = {}): TradeEntry {
  return {
    id: '1',
    date: '2024-06-15T10:30:00Z',
    ticker: 'AAPL',
    side: 'buy',
    entryPrice: 150.0,
    exitPrice: 175.0,
    shares: 100,
    pnl: 2500.0,
    pnlPct: 16.67,
    strategy: 'Momentum',
    notes: 'Strong breakout above resistance',
    holdingPeriod: '5 days',
    ...overrides,
  };
}

describe('TradeCard', () => {
  it('renders trade ticker', () => {
    render(<TradeCard trade={makeTrade()} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });

  it('renders trade side badge', () => {
    render(<TradeCard trade={makeTrade({ side: 'buy' })} />);
    expect(screen.getByText('buy')).toBeInTheDocument();
  });

  it('renders sell side badge', () => {
    render(<TradeCard trade={makeTrade({ side: 'sell' })} />);
    expect(screen.getByText('sell')).toBeInTheDocument();
  });

  it('renders shares count', () => {
    render(<TradeCard trade={makeTrade({ shares: 100 })} />);
    expect(screen.getByText('100 shares')).toBeInTheDocument();
  });

  it('renders date formatted', () => {
    render(<TradeCard trade={makeTrade({ date: '2024-06-15T10:30:00Z' })} />);
    // toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    expect(screen.getByText(/Jun 15, 2024/)).toBeInTheDocument();
  });

  it('renders strategy when provided', () => {
    render(<TradeCard trade={makeTrade({ strategy: 'Momentum' })} />);
    expect(screen.getByText(/Momentum/)).toBeInTheDocument();
  });

  it('renders buy arrow indicator', () => {
    render(<TradeCard trade={makeTrade({ side: 'buy' })} />);
    expect(screen.getByText('▲')).toBeInTheDocument();
  });

  it('renders sell arrow indicator', () => {
    render(<TradeCard trade={makeTrade({ side: 'sell' })} />);
    expect(screen.getByText('▼')).toBeInTheDocument();
  });

  // --- P&L coloring ---
  it('shows positive P&L in green', () => {
    render(<TradeCard trade={makeTrade({ pnl: 2500, pnlPct: 16.67 })} />);
    const pnlEl = screen.getByText(/\+\$2,500\.00/);
    expect(pnlEl.className).toContain('text-emerald-400');
  });

  it('shows negative P&L in red', () => {
    render(<TradeCard trade={makeTrade({ pnl: -500, pnlPct: -3.33 })} />);
    // Component renders: ${fmt(trade.pnl)} → "$-500.00"
    const pnlElements = screen.getAllByText(/\$-500\.00/);
    expect(pnlElements.length).toBeGreaterThanOrEqual(1);
    expect(pnlElements[0].className).toContain('text-red-400');
  });

  it('shows green border-left for profitable trade', () => {
    const { container } = render(<TradeCard trade={makeTrade({ pnl: 100 })} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-l-emerald-500/60');
  });

  it('shows red border-left for losing trade', () => {
    const { container } = render(<TradeCard trade={makeTrade({ pnl: -100 })} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-l-red-500/60');
  });

  // --- Expand / collapse ---
  it('does not show expanded details initially', () => {
    render(<TradeCard trade={makeTrade()} />);
    expect(screen.queryByText('Entry')).not.toBeInTheDocument();
    expect(screen.queryByText('Exit')).not.toBeInTheDocument();
  });

  it('shows expanded details after clicking', async () => {
    const user = userEvent.setup();
    render(<TradeCard trade={makeTrade()} />);

    await user.click(screen.getByText('AAPL'));

    expect(screen.getByText('Entry')).toBeInTheDocument();
    expect(screen.getByText('Exit')).toBeInTheDocument();
    expect(screen.getByText('Shares')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.getByText('$175.00')).toBeInTheDocument();
  });

  it('shows holding period in expanded view when provided', async () => {
    const user = userEvent.setup();
    render(<TradeCard trade={makeTrade({ holdingPeriod: '5 days' })} />);
    await user.click(screen.getByText('AAPL'));
    expect(screen.getByText('Holding')).toBeInTheDocument();
    expect(screen.getByText('5 days')).toBeInTheDocument();
  });

  it('shows notes in expanded view when provided', async () => {
    const user = userEvent.setup();
    render(<TradeCard trade={makeTrade({ notes: 'Strong breakout above resistance' })} />);
    await user.click(screen.getByText('AAPL'));
    expect(screen.getByText('Strong breakout above resistance')).toBeInTheDocument();
  });

  it('collapses on second click', async () => {
    const user = userEvent.setup();
    render(<TradeCard trade={makeTrade()} />);

    await user.click(screen.getByText('AAPL'));
    expect(screen.getByText('Entry')).toBeInTheDocument();

    await user.click(screen.getByText('AAPL'));
    expect(screen.queryByText('Entry')).not.toBeInTheDocument();
  });
});
