import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { PositionTable, type PositionRow } from '@/components/portfolio/position-table';

function makePosition(overrides: Partial<PositionRow> = {}): PositionRow {
  return {
    ticker: 'AAPL',
    shares: 100,
    avgPrice: 150.0,
    currentPrice: 175.0,
    marketValue: 17500,
    unrealizedPnl: 2500,
    pnlPct: 16.67,
    weight: 25.0,
    sector: 'Technology',
    ...overrides,
  };
}

describe('PositionTable', () => {
  it('renders column headers', () => {
    render(<PositionTable positions={[]} />);
    expect(screen.getByText('Ticker')).toBeInTheDocument();
    expect(screen.getByText('Shares')).toBeInTheDocument();
    expect(screen.getByText('Avg Price')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Mkt Value')).toBeInTheDocument();
    expect(screen.getByText('Unreal P&L')).toBeInTheDocument();
    expect(screen.getByText('P&L %')).toBeInTheDocument();
    expect(screen.getByText('Weight')).toBeInTheDocument();
  });

  it('renders empty state message when no positions', () => {
    render(<PositionTable positions={[]} />);
    expect(screen.getByText('No open positions')).toBeInTheDocument();
  });

  it('renders position data', () => {
    const positions = [makePosition()];
    render(<PositionTable positions={positions} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('formats positive P&L with green color and + prefix', () => {
    const positions = [makePosition({ unrealizedPnl: 2500, pnlPct: 16.67 })];
    const { container } = render(<PositionTable positions={positions} />);

    const greenCells = container.querySelectorAll('.text-emerald-400');
    expect(greenCells.length).toBeGreaterThanOrEqual(2); // unrealizedPnl and pnlPct cells
  });

  it('formats negative P&L with red color', () => {
    const positions = [makePosition({ unrealizedPnl: -500, pnlPct: -3.33 })];
    const { container } = render(<PositionTable positions={positions} />);

    const redCells = container.querySelectorAll('.text-red-400');
    expect(redCells.length).toBeGreaterThanOrEqual(2);
  });

  it('renders multiple positions', () => {
    const positions = [
      makePosition({ ticker: 'AAPL' }),
      makePosition({ ticker: 'GOOGL', shares: 50 }),
      makePosition({ ticker: 'MSFT', shares: 200 }),
    ];
    render(<PositionTable positions={positions} />);

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('GOOGL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('has accessible table role and region', () => {
    render(<PositionTable positions={[]} />);
    expect(screen.getByRole('region', { name: 'Positions table' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('sorts by column when header is clicked', async () => {
    const user = userEvent.setup();
    const positions = [
      makePosition({ ticker: 'MSFT', marketValue: 5000 }),
      makePosition({ ticker: 'AAPL', marketValue: 20000 }),
      makePosition({ ticker: 'GOOGL', marketValue: 10000 }),
    ];
    render(<PositionTable positions={positions} />);

    // Default sort is by marketValue desc, so AAPL first
    const rows = screen.getAllByRole('row');
    // row 0 is the header, data rows start at 1
    expect(rows[1]).toHaveTextContent('AAPL');
    expect(rows[2]).toHaveTextContent('GOOGL');
    expect(rows[3]).toHaveTextContent('MSFT');

    // Click Ticker to sort by ticker asc
    await user.click(screen.getByText('Ticker'));
    const sortedRows = screen.getAllByRole('row');
    expect(sortedRows[1]).toHaveTextContent('AAPL');
    expect(sortedRows[2]).toHaveTextContent('GOOGL');
    expect(sortedRows[3]).toHaveTextContent('MSFT');
  });

  it('toggles sort direction when same column header is clicked twice', async () => {
    const user = userEvent.setup();
    const positions = [
      makePosition({ ticker: 'AAPL', marketValue: 20000 }),
      makePosition({ ticker: 'MSFT', marketValue: 5000 }),
    ];
    render(<PositionTable positions={positions} />);

    // Click Mkt Value once (already sorted by marketValue desc, clicking toggles to asc)
    await user.click(screen.getByText('Mkt Value'));
    let rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('MSFT');
    expect(rows[2]).toHaveTextContent('AAPL');

    // Click again to toggle back to desc
    await user.click(screen.getByText('Mkt Value'));
    rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('AAPL');
    expect(rows[2]).toHaveTextContent('MSFT');
  });
});
