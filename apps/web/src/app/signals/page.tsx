import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignalsPage() {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">Signals</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Signal Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Live signal feed from all active strategies. Signals appear here as agents run strategy
            scans during market hours.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
