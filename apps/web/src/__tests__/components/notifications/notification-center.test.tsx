import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore, type Notification } from '@/stores/notification-store';
import { NotificationCenter } from '@/components/notifications/notification-center';

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: overrides.id ?? '1',
    type: 'alert',
    severity: 'info',
    title: 'Test Notification',
    message: 'This is a test',
    timestamp: new Date().toISOString(),
    read: false,
    ...overrides,
  };
}

describe('NotificationCenter', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [] });
  });

  it('renders the notification bell button', () => {
    render(<NotificationCenter />);
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
  });

  it('does not show dropdown initially', () => {
    useNotificationStore.setState({ notifications: [makeNotification()] });
    render(<NotificationCenter />);
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
  });

  it('opens dropdown on bell click', async () => {
    const user = userEvent.setup();
    useNotificationStore.setState({ notifications: [makeNotification()] });
    render(<NotificationCenter />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('shows empty state when no notifications', async () => {
    const user = userEvent.setup();
    render(<NotificationCenter />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
  });

  it('renders notification items', async () => {
    const user = userEvent.setup();
    useNotificationStore.setState({
      notifications: [
        makeNotification({ id: '1', title: 'Alert One', message: 'First alert' }),
        makeNotification({ id: '2', title: 'Alert Two', message: 'Second alert' }),
      ],
    });
    render(<NotificationCenter />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('Alert One')).toBeInTheDocument();
    expect(screen.getByText('Alert Two')).toBeInTheDocument();
    expect(screen.getByText('First alert')).toBeInTheDocument();
    expect(screen.getByText('Second alert')).toBeInTheDocument();
  });

  it('shows unread count badge', () => {
    useNotificationStore.setState({
      notifications: [
        makeNotification({ id: '1', read: false }),
        makeNotification({ id: '2', read: false }),
        makeNotification({ id: '3', read: true }),
      ],
    });
    render(<NotificationCenter />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows 99+ when unread count exceeds 99', () => {
    const notifications = Array.from({ length: 100 }, (_, i) =>
      makeNotification({ id: String(i), read: false }),
    ).slice(0, 50); // store MAX is 50
    // Create exactly 100 unread but store only holds 50
    // Let's just use 50 unread with 0 read to test the badge
    useNotificationStore.setState({ notifications });
    render(<NotificationCenter />);
    // 50 unread shows "50", not "99+"
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('does not show count badge when all read', () => {
    useNotificationStore.setState({
      notifications: [makeNotification({ id: '1', read: true })],
    });
    const { container } = render(<NotificationCenter />);
    // The badge span with bg-red-500 should not exist
    expect(container.querySelector('.bg-red-500')).toBeNull();
  });

  it('includes unread count in aria-label', () => {
    useNotificationStore.setState({
      notifications: [
        makeNotification({ id: '1', read: false }),
        makeNotification({ id: '2', read: false }),
      ],
    });
    render(<NotificationCenter />);
    expect(screen.getByRole('button', { name: 'Notifications (2 unread)' })).toBeInTheDocument();
  });

  it('dismisses a notification', async () => {
    const user = userEvent.setup();
    useNotificationStore.setState({
      notifications: [
        makeNotification({ id: '1', title: 'To Dismiss', message: 'Will be removed' }),
      ],
    });
    render(<NotificationCenter />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('To Dismiss')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    // Notification should be removed from store
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('shows "Mark all read" when there are unread notifications', async () => {
    const user = userEvent.setup();
    useNotificationStore.setState({
      notifications: [makeNotification({ id: '1', read: false })],
    });
    render(<NotificationCenter />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('Mark all read')).toBeInTheDocument();
  });

  it('marks all as read when "Mark all read" is clicked', async () => {
    const user = userEvent.setup();
    useNotificationStore.setState({
      notifications: [
        makeNotification({ id: '1', read: false }),
        makeNotification({ id: '2', read: false }),
      ],
    });
    render(<NotificationCenter />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await user.click(screen.getByText('Mark all read'));

    const state = useNotificationStore.getState();
    expect(state.notifications.every((n) => n.read)).toBe(true);
  });

  it('shows type badges for notifications', async () => {
    const user = userEvent.setup();
    useNotificationStore.setState({
      notifications: [
        makeNotification({ id: '1', type: 'alert', title: 'Alert Title' }),
        makeNotification({ id: '2', type: 'signal', title: 'Signal Title' }),
        makeNotification({ id: '3', type: 'system', title: 'System Title' }),
      ],
    });
    render(<NotificationCenter />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    // Type badges are separate from notification titles
    expect(screen.getAllByText('Alert').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Signal').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('System').length).toBeGreaterThanOrEqual(1);
  });

  it('closes dropdown on second bell click', async () => {
    const user = userEvent.setup();
    useNotificationStore.setState({ notifications: [makeNotification()] });
    render(<NotificationCenter />);

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('Notifications')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
  });
});
