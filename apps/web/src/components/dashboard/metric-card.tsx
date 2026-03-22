import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  change?: number;
  icon?: React.ReactNode;
}

export function MetricCard({ label, value, change, icon }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight font-[family-name:var(--font-geist-mono)]">
          {value}
        </p>
        {change !== undefined && (
          <p
            className={cn(
              'mt-1 text-xs font-medium',
              change >= 0 ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}
