'use client';

import { Sidebar } from './sidebar';
import { Header } from './header';
import { useServiceHealth } from '@/hooks/use-service-health';
import { useAppStore } from '@/stores/app-store';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  useServiceHealth();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-full">
      <Sidebar />
      <div
        className={cn(
          'flex flex-1 flex-col transition-all duration-200',
          sidebarOpen ? 'ml-56' : 'ml-16',
        )}
      >
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
