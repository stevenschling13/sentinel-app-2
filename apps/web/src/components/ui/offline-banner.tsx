import { AlertTriangle } from 'lucide-react';

export function OfflineBanner({ service }: { service: string }) {
  return (
    <div role="alert" aria-live="polite" className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        <strong className="capitalize">{service}</strong> is offline. Some features may be
        unavailable.
      </span>
    </div>
  );
}
