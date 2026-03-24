import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '@/stores/app-store';

// Mock NotificationCenter to isolate header tests
vi.mock('@/components/notifications/notification-center', () => ({
  NotificationCenter: () => <div data-testid="notification-center">NotificationCenter</div>,
}));

import { Header } from '@/components/layout/header';

describe('Header', () => {
  beforeEach(() => {
    useAppStore.setState({ sidebarOpen: true });
  });

  it('renders the platform title', () => {
    render(<Header />);
    expect(screen.getByText('Sentinel Trading Platform')).toBeInTheDocument();
  });

  it('renders as a header element', () => {
    render(<Header />);
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
  });

  it('renders toggle sidebar button with aria-label', () => {
    render(<Header />);
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toBeInTheDocument();
  });

  it('calls toggleSidebar when button is clicked', async () => {
    const user = userEvent.setup();
    render(<Header />);

    // sidebarOpen starts as true
    expect(useAppStore.getState().sidebarOpen).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));

    // toggleSidebar flips the state
    expect(useAppStore.getState().sidebarOpen).toBe(false);
  });

  it('renders NotificationCenter', () => {
    render(<Header />);
    expect(screen.getByTestId('notification-center')).toBeInTheDocument();
  });
});
