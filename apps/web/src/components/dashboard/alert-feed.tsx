import { AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AlertItem {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  triggered_at: string;
}

const SEVERITY_CONFIG = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  critical: { icon: AlertOctagon, color: 'text-red-400', bg: 'bg-red-500/10' },
} as const;

export function AlertFeed({ alerts }: { alerts: AlertItem[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Recent Alerts</CardTitle>
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No alerts. System operating normally.
          </p>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 10).map((alert) => {
              const config = SEVERITY_CONFIG[alert.severity];
              const Icon = config.icon;
              return (
                <div
                  key={alert.id}
                  className={cn('flex items-start gap-2 rounded-md p-2', config.bg)}
                >
                  <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', config.color)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{alert.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{alert.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
