import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function StrategiesPage() {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">Strategies</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Strategy Scanner</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Strategy scanning and signal generation interface. Connect the engine to view available
            strategies and run scans.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
