import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SectorAllocation } from '@/components/portfolio/sector-allocation';

const sampleData = [
  { sector: 'Technology', value: 50000, color: '#3b82f6' },
  { sector: 'Healthcare', value: 30000, color: '#22c55e' },
  { sector: 'Finance', value: 20000, color: '#f59e0b' },
];

describe('SectorAllocation', () => {
  it('renders sector names', () => {
    render(<SectorAllocation data={sampleData} />);
    expect(screen.getByText('Technology')).toBeInTheDocument();
    expect(screen.getByText('Healthcare')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
  });

  it('renders percentage calculations', () => {
    render(<SectorAllocation data={sampleData} />);
    // Technology: 50000/100000 = 50.0%
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    // Healthcare: 30000/100000 = 30.0%
    expect(screen.getByText('30.0%')).toBeInTheDocument();
    // Finance: 20000/100000 = 20.0%
    expect(screen.getByText('20.0%')).toBeInTheDocument();
  });

  it('renders total value', () => {
    render(<SectorAllocation data={sampleData} />);
    // Total = $100,000
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('$100,000')).toBeInTheDocument();
  });

  it('renders empty state when data has zero total', () => {
    render(<SectorAllocation data={[]} />);
    expect(screen.getByText('No allocation data')).toBeInTheDocument();
  });

  it('renders empty state when all values are zero', () => {
    const zeroData = [{ sector: 'Tech', value: 0, color: '#000' }];
    render(<SectorAllocation data={zeroData} />);
    expect(screen.getByText('No allocation data')).toBeInTheDocument();
  });

  it('renders legend color indicators', () => {
    const { container } = render(<SectorAllocation data={sampleData} />);
    // Each sector has a colored dot
    const dots = container.querySelectorAll('[style*="background-color"]');
    expect(dots.length).toBe(3);
  });

  it('handles single sector data', () => {
    const single = [{ sector: 'Energy', value: 10000, color: '#ef4444' }];
    render(<SectorAllocation data={single} />);
    expect(screen.getByText('Energy')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
    expect(screen.getByText('$10,000')).toBeInTheDocument();
  });
});
