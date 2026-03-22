'use client';

import { Menu } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { Button } from '@/components/ui/button';
import { NotificationCenter } from '@/components/notifications/notification-center';

export function Header() {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur-sm">
      <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
        <Menu className="h-4 w-4" />
      </Button>
      <h1 className="text-sm font-medium text-muted-foreground">Sentinel Trading Platform</h1>
      <div className="ml-auto">
        <NotificationCenter />
      </div>
    </header>
  );
}
