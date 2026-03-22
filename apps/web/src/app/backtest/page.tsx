import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BacktestPage() {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">Backtesting</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Backtest Runner</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Run backtests against historical data with equity curves, trade logs, and performance
            metrics. Connect the engine to get started.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
