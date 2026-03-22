import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PriceTicker } from '@/components/dashboard/price-ticker';

const items = [
  { ticker: 'AAPL', price: 195.5, change: 1.25 },
  { ticker: 'TSLA', price: 245.0, change: -2.1 },
  { ticker: 'SPY', price: 450.75, change: 0.0 },
];

describe('PriceTicker', () => {
  it('renders ticker symbols', () => {
    render(<PriceTicker items={items} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.getByText('SPY')).toBeInTheDocument();
  });

  it('shows price and change values', () => {
    render(<PriceTicker items={items} />);
    expect(screen.getByText('$195.50')).toBeInTheDocument();
    expect(screen.getByText('$245.00')).toBeInTheDocument();
    expect(screen.getByText('$450.75')).toBeInTheDocument();

    expect(screen.getByText('+1.25%')).toBeInTheDocument();
    expect(screen.getByText('-2.10%')).toBeInTheDocument();
    expect(screen.getByText('+0.00%')).toBeInTheDocument();
  });

  it('colors positive changes emerald and negative red', () => {
    render(<PriceTicker items={items} />);

    const positive = screen.getByText('+1.25%');
    expect(positive.className).toContain('text-emerald-400');

    const negative = screen.getByText('-2.10%');
    expect(negative.className).toContain('text-red-400');
  });
});
