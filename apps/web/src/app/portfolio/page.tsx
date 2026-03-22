import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PortfolioPage() {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">Portfolio</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Positions & P&L</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            View current positions, allocation, and profit/loss. Connect the engine and broker to
            see live portfolio data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
