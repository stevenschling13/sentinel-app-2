'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAppStore, type RealtimeAlertItem, type RealtimeSignalItem } from '@/stores/app-store';
import { useNotificationStore, type NotificationSeverity } from '@/stores/notification-store';

/**
 * Bridges Supabase Realtime events → toast notifications + notification store.
 * Call once at the dashboard level to activate.
 */
export function useNotificationToast() {
  const alerts = useAppStore((s) => s.realtimeAlerts);
  const signals = useAppStore((s) => s.realtimeSignals);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const seenAlerts = useRef(new Set<string>());
  const seenSignals = useRef(new Set<string>());

  // React to new realtime alerts
  useEffect(() => {
    for (const alert of alerts) {
      if (seenAlerts.current.has(alert.id)) continue;
      seenAlerts.current.add(alert.id);

      addNotification({
        type: 'alert',
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        timestamp: alert.created_at,
      });

      showAlertToast(alert);
    }
  }, [alerts, addNotification]);

  // React to new realtime signals
  useEffect(() => {
    for (const signal of signals) {
      if (seenSignals.current.has(signal.id)) continue;
      seenSignals.current.add(signal.id);

      const severity: NotificationSeverity =
        signal.signal_strength != null && signal.signal_strength >= 0.8 ? 'critical' : 'info';
      const title = `${signal.side.toUpperCase()} Signal: ${signal.ticker}`;
      const message =
        signal.reason ??
        `${signal.side.toUpperCase()} ${signal.quantity} shares of ${signal.ticker}`;

      addNotification({
        type: 'signal',
        severity,
        title,
        message,
        timestamp: signal.created_at,
      });

      showSignalToast(signal, title, message);
    }
  }, [signals, addNotification]);
}

function showAlertToast(alert: RealtimeAlertItem) {
  const description = alert.ticker ? `[${alert.ticker}] ${alert.message}` : alert.message;

  switch (alert.severity) {
    case 'critical':
      toast.error(alert.title, { description, duration: 8000 });
      break;
    case 'warning':
      toast.warning(alert.title, { description, duration: 6000 });
      break;
    default:
      toast.info(alert.title, { description, duration: 4000 });
      break;
  }
}

function showSignalToast(signal: RealtimeSignalItem, title: string, message: string) {
  const strength =
    signal.signal_strength != null ? ` (${(signal.signal_strength * 100).toFixed(0)}%)` : '';

  if (signal.side === 'buy') {
    toast.success(title + strength, { description: message, duration: 5000 });
  } else {
    toast.error(title + strength, { description: message, duration: 5000 });
  }
}
