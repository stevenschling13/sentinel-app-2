import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MetricCard } from '@/components/dashboard/metric-card';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="Total Value" value="$12,345" />);
    expect(screen.getByText('Total Value')).toBeInTheDocument();
    expect(screen.getByText('$12,345')).toBeInTheDocument();
  });

  it('shows positive change with emerald color', () => {
    render(<MetricCard label="Price" value="$100" change={5.25} />);
    const changeEl = screen.getByText('+5.25%');
    expect(changeEl).toBeInTheDocument();
    expect(changeEl.className).toContain('text-emerald-400');
  });

  it('shows negative change with red color', () => {
    render(<MetricCard label="Price" value="$100" change={-3.14} />);
    const changeEl = screen.getByText('-3.14%');
    expect(changeEl).toBeInTheDocument();
    expect(changeEl.className).toContain('text-red-400');
  });

  it('renders icon when provided', () => {
    render(<MetricCard label="Price" value="$100" icon={<span data-testid="icon">★</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('does not render change when not provided', () => {
    const { container } = render(<MetricCard label="Price" value="$100" />);
    expect(container.querySelector('.text-emerald-400')).toBeNull();
    expect(container.querySelector('.text-red-400')).toBeNull();
  });
});
