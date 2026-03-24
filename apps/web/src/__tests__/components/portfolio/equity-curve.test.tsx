import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock lightweight-charts
const mockSetData = vi.fn();
const mockFitContent = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemove = vi.fn();
const mockAddSeries = vi.fn(() => ({ setData: mockSetData }));
const mockTimeScale = vi.fn(() => ({ fitContent: mockFitContent }));

const mockCreateChart = vi.fn(() => ({
  addSeries: mockAddSeries,
  timeScale: mockTimeScale,
  applyOptions: mockApplyOptions,
  remove: mockRemove,
}));

vi.mock('lightweight-charts', () => ({
  createChart: (...args: unknown[]) => mockCreateChart(...args),
  AreaSeries: 'AreaSeries',
}));

// Mock ResizeObserver as a class
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
class MockResizeObserver {
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

import { EquityCurve } from '@/components/portfolio/equity-curve';

describe('EquityCurve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a container div', () => {
    const { container } = render(<EquityCurve data={[]} />);
    const div = container.firstChild as HTMLElement;
    expect(div).toBeInTheDocument();
    expect(div.tagName).toBe('DIV');
  });

  it('applies default className when none provided', () => {
    const { container } = render(<EquityCurve data={[]} />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('h-[300px]');
    expect(div.className).toContain('w-full');
  });

  it('applies custom className when provided', () => {
    const { container } = render(<EquityCurve data={[]} className="h-[500px] w-full" />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('h-[500px]');
  });

  it('does not create chart when data is empty', () => {
    render(<EquityCurve data={[]} />);
    expect(mockCreateChart).not.toHaveBeenCalled();
  });

  it('creates chart and sets data when data is provided', () => {
    const data = [
      { time: '2024-01-01', value: 100000 },
      { time: '2024-01-02', value: 101000 },
    ];
    render(<EquityCurve data={data} />);

    expect(mockCreateChart).toHaveBeenCalledOnce();
    expect(mockAddSeries).toHaveBeenCalledOnce();
    expect(mockSetData).toHaveBeenCalledOnce();
    expect(mockTimeScale).toHaveBeenCalled();
    expect(mockFitContent).toHaveBeenCalled();
  });

  it('observes container for resize events', () => {
    const data = [{ time: '2024-01-01', value: 100000 }];
    render(<EquityCurve data={data} />);
    expect(mockObserve).toHaveBeenCalledOnce();
  });

  it('cleans up chart and observer on unmount', () => {
    const data = [{ time: '2024-01-01', value: 100000 }];
    const { unmount } = render(<EquityCurve data={data} />);
    unmount();
    expect(mockDisconnect).toHaveBeenCalledOnce();
    expect(mockRemove).toHaveBeenCalledOnce();
  });
});
