import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '@/stores/app-store';

// Mock next/link as a simple anchor
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/navigation
const mockUsePathname = vi.fn(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

// Import after mocks
import { Sidebar } from '@/components/layout/sidebar';

const NAV_LABELS = [
  { label: 'Dashboard', href: '/' },
  { label: 'Charts', href: '/chart/SPY' },
  { label: 'Strategies', href: '/strategies' },
  { label: 'Backtest', href: '/backtest' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Signals', href: '/signals' },
  { label: 'Journal', href: '/journal' },
  { label: 'Admin', href: '/admin' },
  { label: 'Settings', href: '/settings' },
];

describe('Sidebar', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
    useAppStore.setState({ sidebarOpen: true, engineOnline: true });
  });

  it('renders all navigation links', () => {
    render(<Sidebar />);
    for (const item of NAV_LABELS) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
  });

  it('renders correct hrefs for all routes', () => {
    render(<Sidebar />);
    for (const item of NAV_LABELS) {
      const link = screen.getByText(item.label).closest('a');
      expect(link).toHaveAttribute('href', item.href);
    }
  });

  it('highlights active link for Dashboard', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Sidebar />);
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink?.className).toContain('bg-accent');
  });

  it('highlights active link for Portfolio', () => {
    mockUsePathname.mockReturnValue('/portfolio');
    render(<Sidebar />);
    const link = screen.getByText('Portfolio').closest('a');
    expect(link?.className).toContain('bg-accent');
    // Dashboard should not be active
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink?.className).toContain('text-muted-foreground');
  });

  it('highlights active link for Strategies', () => {
    mockUsePathname.mockReturnValue('/strategies');
    render(<Sidebar />);
    const link = screen.getByText('Strategies').closest('a');
    expect(link?.className).toContain('bg-accent');
  });

  it('highlights active link for Backtest', () => {
    mockUsePathname.mockReturnValue('/backtest');
    render(<Sidebar />);
    const link = screen.getByText('Backtest').closest('a');
    expect(link?.className).toContain('bg-accent');
  });

  it('highlights active link for Signals', () => {
    mockUsePathname.mockReturnValue('/signals');
    render(<Sidebar />);
    const link = screen.getByText('Signals').closest('a');
    expect(link?.className).toContain('bg-accent');
  });

  it('highlights active link for Settings', () => {
    mockUsePathname.mockReturnValue('/settings');
    render(<Sidebar />);
    const link = screen.getByText('Settings').closest('a');
    expect(link?.className).toContain('bg-accent');
  });

  it('highlights active link for Admin', () => {
    mockUsePathname.mockReturnValue('/admin');
    render(<Sidebar />);
    const link = screen.getByText('Admin').closest('a');
    expect(link?.className).toContain('bg-accent');
  });

  it('highlights active link for Journal', () => {
    mockUsePathname.mockReturnValue('/journal');
    render(<Sidebar />);
    const link = screen.getByText('Journal').closest('a');
    expect(link?.className).toContain('bg-accent');
  });

  it('highlights Charts link for any /chart/* path', () => {
    mockUsePathname.mockReturnValue('/chart/AAPL');
    render(<Sidebar />);
    const link = screen.getByText('Charts').closest('a');
    expect(link?.className).toContain('bg-accent');
  });

  it('hides labels when sidebar is collapsed', () => {
    useAppStore.setState({ sidebarOpen: false });
    render(<Sidebar />);
    for (const item of NAV_LABELS) {
      expect(screen.queryByText(item.label)).not.toBeInTheDocument();
    }
  });

  it('shows Sentinel branding when open', () => {
    useAppStore.setState({ sidebarOpen: true });
    render(<Sidebar />);
    expect(screen.getByText('Sentinel')).toBeInTheDocument();
  });

  it('hides Sentinel branding when collapsed', () => {
    useAppStore.setState({ sidebarOpen: false });
    render(<Sidebar />);
    expect(screen.queryByText('Sentinel')).not.toBeInTheDocument();
  });

  it('has correct ARIA labels', () => {
    render(<Sidebar />);
    expect(screen.getByLabelText('Sidebar')).toBeInTheDocument();
    expect(screen.getByLabelText('Main navigation')).toBeInTheDocument();
  });

  // --- Engine status dot ---
  it('shows Online status when engine is online', () => {
    useAppStore.setState({ engineOnline: true, sidebarOpen: true });
    render(<Sidebar />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('shows Offline status when engine is offline', () => {
    useAppStore.setState({ engineOnline: false, sidebarOpen: true });
    render(<Sidebar />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('shows Checking… status when engine is null', () => {
    useAppStore.setState({ engineOnline: null, sidebarOpen: true });
    render(<Sidebar />);
    expect(screen.getByText('Checking…')).toBeInTheDocument();
  });
});
