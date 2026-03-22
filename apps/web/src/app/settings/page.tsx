import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-lg font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="engine-url" className="mb-1 block text-xs font-medium text-muted-foreground">Engine URL</label>
            <input id="engine-url" type="url" defaultValue="http://localhost:8000" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-[family-name:var(--font-geist-mono)]" aria-label="Engine URL" readOnly />
          </div>
          <div>
            <label htmlFor="agents-url" className="mb-1 block text-xs font-medium text-muted-foreground">Agents URL</label>
            <input id="agents-url" type="url" defaultValue="http://localhost:3001" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-[family-name:var(--font-geist-mono)]" aria-label="Agents URL" readOnly />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Risk Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="max-drawdown" className="mb-1 block text-xs font-medium text-muted-foreground">Max Drawdown (%)</label>
              <input id="max-drawdown" type="number" defaultValue={15} min={1} max={50} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" aria-label="Maximum drawdown percentage" />
            </div>
            <div>
              <label htmlFor="max-position" className="mb-1 block text-xs font-medium text-muted-foreground">Max Position Size (%)</label>
              <input id="max-position" type="number" defaultValue={5} min={1} max={25} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" aria-label="Maximum position size percentage" />
            </div>
            <div>
              <label htmlFor="daily-loss" className="mb-1 block text-xs font-medium text-muted-foreground">Daily Loss Limit (%)</label>
              <input id="daily-loss" type="number" defaultValue={2} min={0.5} max={10} step={0.5} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" aria-label="Daily loss limit percentage" />
            </div>
            <div>
              <label htmlFor="sector-limit" className="mb-1 block text-xs font-medium text-muted-foreground">Sector Limit (%)</label>
              <input id="sector-limit" type="number" defaultValue={20} min={5} max={50} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" aria-label="Sector exposure limit percentage" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Agent Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Automated Trading Cycles</p>
              <p className="text-xs text-muted-foreground">Run strategy scans and risk checks on a schedule</p>
            </div>
            <div className="relative h-6 w-11 rounded-full bg-muted" role="switch" aria-checked="false" aria-label="Toggle automated trading cycles" tabIndex={0}>
              <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-muted-foreground transition-transform" />
            </div>
          </div>
          <div>
            <label htmlFor="cycle-interval" className="mb-1 block text-xs font-medium text-muted-foreground">Cycle Interval (minutes)</label>
            <input id="cycle-interval" type="number" defaultValue={15} min={1} max={120} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" aria-label="Trading cycle interval in minutes" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
