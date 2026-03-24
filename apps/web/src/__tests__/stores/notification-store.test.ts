import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from '@/stores/notification-store';

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [] });
  });

  it('starts with empty notifications', () => {
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });

  it('adds a notification with generated id and read=false', () => {
    useNotificationStore.getState().addNotification({
      type: 'alert',
      severity: 'info',
      title: 'Test Alert',
      message: 'Something happened',
      timestamp: '2024-01-01T00:00:00Z',
    });

    const { notifications } = useNotificationStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('Test Alert');
    expect(notifications[0].read).toBe(false);
    expect(notifications[0].id).toBeDefined();
    expect(typeof notifications[0].id).toBe('string');
  });

  it('prepends new notifications (newest first)', () => {
    const { addNotification } = useNotificationStore.getState();
    addNotification({
      type: 'alert',
      severity: 'info',
      title: 'First',
      message: '',
      timestamp: '2024-01-01T00:00:00Z',
    });
    addNotification({
      type: 'signal',
      severity: 'critical',
      title: 'Second',
      message: '',
      timestamp: '2024-01-01T00:01:00Z',
    });

    const { notifications } = useNotificationStore.getState();
    expect(notifications[0].title).toBe('Second');
    expect(notifications[1].title).toBe('First');
  });

  it('enforces MAX_NOTIFICATIONS limit (50)', () => {
    const { addNotification } = useNotificationStore.getState();
    for (let i = 0; i < 55; i++) {
      addNotification({
        type: 'system',
        severity: 'info',
        title: `Notification ${i}`,
        message: '',
        timestamp: new Date().toISOString(),
      });
    }
    expect(useNotificationStore.getState().notifications).toHaveLength(50);
  });

  it('markRead sets read=true for specific notification', () => {
    useNotificationStore.getState().addNotification({
      type: 'alert',
      severity: 'warning',
      title: 'Unread',
      message: '',
      timestamp: new Date().toISOString(),
    });
    const id = useNotificationStore.getState().notifications[0].id;

    useNotificationStore.getState().markRead(id);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });

  it('markAllRead sets all to read', () => {
    const { addNotification } = useNotificationStore.getState();
    addNotification({ type: 'alert', severity: 'info', title: 'A', message: '', timestamp: '' });
    addNotification({ type: 'alert', severity: 'info', title: 'B', message: '', timestamp: '' });

    useNotificationStore.getState().markAllRead();
    const all = useNotificationStore.getState().notifications;
    expect(all.every((n) => n.read)).toBe(true);
  });

  it('clearAll removes all notifications', () => {
    useNotificationStore.getState().addNotification({
      type: 'alert',
      severity: 'info',
      title: 'Test',
      message: '',
      timestamp: '',
    });
    useNotificationStore.getState().clearAll();
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });

  it('dismiss removes a specific notification by id', () => {
    const { addNotification } = useNotificationStore.getState();
    addNotification({ type: 'alert', severity: 'info', title: 'Keep', message: '', timestamp: '' });
    addNotification({
      type: 'alert',
      severity: 'info',
      title: 'Remove',
      message: '',
      timestamp: '',
    });

    const toRemove = useNotificationStore
      .getState()
      .notifications.find((n) => n.title === 'Remove')!;
    useNotificationStore.getState().dismiss(toRemove.id);

    const remaining = useNotificationStore.getState().notifications;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe('Keep');
  });

  it('markRead does nothing for nonexistent id', () => {
    useNotificationStore.getState().addNotification({
      type: 'alert',
      severity: 'info',
      title: 'Test',
      message: '',
      timestamp: '',
    });
    useNotificationStore.getState().markRead('nonexistent-id');
    expect(useNotificationStore.getState().notifications[0].read).toBe(false);
  });

  it('dismiss does nothing for nonexistent id', () => {
    useNotificationStore.getState().addNotification({
      type: 'alert',
      severity: 'info',
      title: 'Test',
      message: '',
      timestamp: '',
    });
    useNotificationStore.getState().dismiss('nonexistent-id');
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });
});
