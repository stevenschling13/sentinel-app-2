'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, Zap, Info, X, CheckCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useNotificationStore,
  type Notification,
  type NotificationType,
} from '@/stores/notification-store';
import { cn } from '@/lib/utils';

const MAX_VISIBLE = 20;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NotificationIcon({ notification }: { notification: Notification }) {
  const type = notification.type;
  const severity = notification.severity;

  if (type === 'signal') {
    return <Zap className="h-4 w-4 shrink-0 text-blue-400" />;
  }
  if (type === 'alert') {
    if (severity === 'critical') return <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />;
    if (severity === 'warning')
      return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />;
    return <Info className="h-4 w-4 shrink-0 text-blue-400" />;
  }
  return <Info className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function severityBorder(n: Notification): string {
  if (n.type === 'alert') {
    if (n.severity === 'critical') return 'border-l-red-500';
    if (n.severity === 'warning') return 'border-l-amber-500';
  }
  if (n.type === 'signal') return 'border-l-blue-500';
  return 'border-l-transparent';
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const dismiss = useNotificationStore((s) => s.dismiss);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const visible = notifications.slice(0, MAX_VISIBLE);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-card shadow-xl sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              visible.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'group flex items-start gap-3 border-b border-border/50 border-l-2 px-4 py-3 last:border-b-0 transition-colors',
                    severityBorder(n),
                    n.read ? 'bg-transparent opacity-60' : 'bg-muted/30',
                  )}
                  onClick={() => markRead(n.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') markRead(n.id);
                  }}
                >
                  <NotificationIcon notification={n} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground leading-tight">
                        {n.title}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss(n.id);
                        }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Dismiss notification"
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <TypeBadge type={n.type} />
                      <span className="text-[10px] text-muted-foreground">
                        {relativeTime(n.timestamp)}
                      </span>
                    </div>
                  </div>
                  {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > MAX_VISIBLE && (
            <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
              Showing {MAX_VISIBLE} of {notifications.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: NotificationType }) {
  const config: Record<NotificationType, { label: string; className: string }> = {
    alert: { label: 'Alert', className: 'bg-amber-500/15 text-amber-400' },
    signal: { label: 'Signal', className: 'bg-blue-500/15 text-blue-400' },
    system: { label: 'System', className: 'bg-zinc-500/15 text-zinc-400' },
  };
  const c = config[type];
  return (
    <span className={cn('rounded px-1 py-0.5 text-[10px] font-medium', c.className)}>
      {c.label}
    </span>
  );
}
