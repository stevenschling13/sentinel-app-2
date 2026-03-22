'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  Briefcase,
  Zap,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/strategies', label: 'Strategies', icon: BarChart3 },
  { href: '/backtest', label: 'Backtest', icon: TrendingUp },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/signals', label: 'Signals', icon: Zap },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-card transition-all duration-200',
        sidebarOpen ? 'w-56' : 'w-16',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-xs font-bold text-primary-foreground">S</span>
          </div>
          {sidebarOpen && (
            <span className="text-sm font-semibold tracking-tight">Sentinel</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Status indicator */}
      <div className="border-t border-border p-3">
        <StatusDot />
      </div>
    </aside>
  );
}

function StatusDot() {
  const engineOnline = useAppStore((s) => s.engineOnline);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  const color =
    engineOnline === true
      ? 'bg-emerald-400'
      : engineOnline === false
        ? 'bg-red-400'
        : 'bg-yellow-400';

  const label =
    engineOnline === true ? 'Online' : engineOnline === false ? 'Offline' : 'Checking…';

  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-full', color)} />
      {sidebarOpen && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
