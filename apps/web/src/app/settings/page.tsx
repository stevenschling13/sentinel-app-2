'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface RiskSettings {
  maxDrawdown: number;
  maxPosition: number;
  dailyLoss: number;
  sectorLimit: number;
}

interface AgentSettings {
  enabled: boolean;
  cycleInterval: number;
}

export default function SettingsPage() {
  const [riskSettings, setRiskSettings] = useState<RiskSettings>({
    maxDrawdown: 15,
    maxPosition: 5,
    dailyLoss: 2,
    sectorLimit: 20,
  });

  const [agentSettings, setAgentSettings] = useState<AgentSettings>({
    enabled: false,
    cycleInterval: 15,
  });

  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedRisk = localStorage.getItem('sentinel_risk_settings');
    const savedAgent = localStorage.getItem('sentinel_agent_settings');

    if (savedRisk) {
      try {
        setRiskSettings(JSON.parse(savedRisk));
      } catch (e) {
        console.error('Failed to load risk settings:', e);
      }
    }

    if (savedAgent) {
      try {
        setAgentSettings(JSON.parse(savedAgent));
      } catch (e) {
        console.error('Failed to load agent settings:', e);
      }
    }
  }, []);

  const handleRiskChange = (field: keyof RiskSettings, value: number) => {
    setRiskSettings((prev) => ({ ...prev, [field]: value }));
    setChanged(true);
  };

  const handleAgentToggle = async () => {
    const newEnabled = !agentSettings.enabled;
    setAgentSettings((prev) => ({ ...prev, enabled: newEnabled }));
    setChanged(true);

    // Immediately notify the agents service
    try {
      const endpoint = newEnabled ? '/api/agents/resume' : '/api/agents/halt';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'User toggled from settings' }),
      });

      if (response.ok) {
        toast.success(newEnabled ? 'Automated cycles enabled' : 'Automated cycles paused');
      } else {
        toast.error('Failed to update agent status');
        // Revert on failure
        setAgentSettings((prev) => ({ ...prev, enabled: !newEnabled }));
      }
    } catch (error) {
      toast.error('Failed to communicate with agents service');
      setAgentSettings((prev) => ({ ...prev, enabled: !newEnabled }));
    }
  };

  const handleAgentIntervalChange = (value: number) => {
    setAgentSettings((prev) => ({ ...prev, cycleInterval: value }));
    setChanged(true);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Save to localStorage
      localStorage.setItem('sentinel_risk_settings', JSON.stringify(riskSettings));
      localStorage.setItem('sentinel_agent_settings', JSON.stringify(agentSettings));

      // TODO: In production, this would also save to Supabase user_settings table
      // For now, just simulate a save delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      toast.success('Settings saved successfully');
      setChanged(false);
    } catch (error) {
      toast.error('Failed to save settings');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setRiskSettings({
      maxDrawdown: 15,
      maxPosition: 5,
      dailyLoss: 2,
      sectorLimit: 20,
    });
    setAgentSettings((prev) => ({ ...prev, cycleInterval: 15 }));
    setChanged(true);
    toast.info('Settings reset to defaults');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Settings</h1>
        {changed && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="engine-url"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Engine URL
            </label>
            <input
              id="engine-url"
              type="url"
              defaultValue="http://localhost:8000"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-[family-name:var(--font-geist-mono)]"
              aria-label="Engine URL"
              readOnly
              title="Connection URLs are configured via environment variables"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Configured via environment variables
            </p>
          </div>
          <div>
            <label
              htmlFor="agents-url"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Agents URL
            </label>
            <input
              id="agents-url"
              type="url"
              defaultValue="http://localhost:3001"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-[family-name:var(--font-geist-mono)]"
              aria-label="Agents URL"
              readOnly
              title="Connection URLs are configured via environment variables"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Configured via environment variables
            </p>
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
              <label
                htmlFor="max-drawdown"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Max Drawdown (%)
              </label>
              <input
                id="max-drawdown"
                type="number"
                value={riskSettings.maxDrawdown}
                onChange={(e) => handleRiskChange('maxDrawdown', Number(e.target.value))}
                min={1}
                max={50}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                aria-label="Maximum drawdown percentage"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Hard stop at {riskSettings.maxDrawdown}% portfolio drawdown
              </p>
            </div>
            <div>
              <label
                htmlFor="max-position"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Max Position Size (%)
              </label>
              <input
                id="max-position"
                type="number"
                value={riskSettings.maxPosition}
                onChange={(e) => handleRiskChange('maxPosition', Number(e.target.value))}
                min={1}
                max={25}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                aria-label="Maximum position size percentage"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Max {riskSettings.maxPosition}% of portfolio per position
              </p>
            </div>
            <div>
              <label
                htmlFor="daily-loss"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Daily Loss Limit (%)
              </label>
              <input
                id="daily-loss"
                type="number"
                value={riskSettings.dailyLoss}
                onChange={(e) => handleRiskChange('dailyLoss', Number(e.target.value))}
                min={0.5}
                max={10}
                step={0.5}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                aria-label="Daily loss limit percentage"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Stop trading if down {riskSettings.dailyLoss}% today
              </p>
            </div>
            <div>
              <label
                htmlFor="sector-limit"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Sector Limit (%)
              </label>
              <input
                id="sector-limit"
                type="number"
                value={riskSettings.sectorLimit}
                onChange={(e) => handleRiskChange('sectorLimit', Number(e.target.value))}
                min={5}
                max={50}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                aria-label="Sector exposure limit percentage"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Max {riskSettings.sectorLimit}% exposure per sector
              </p>
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
              <p className="text-xs text-muted-foreground">
                Run strategy scans and risk checks on a schedule
              </p>
            </div>
            <button
              type="button"
              onClick={handleAgentToggle}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                agentSettings.enabled ? 'bg-emerald-600' : 'bg-muted'
              }`}
              role="switch"
              aria-checked={agentSettings.enabled}
              aria-label="Toggle automated trading cycles"
            >
              <div
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                  agentSettings.enabled ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
          <div>
            <label
              htmlFor="cycle-interval"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Cycle Interval (minutes)
            </label>
            <input
              id="cycle-interval"
              type="number"
              value={agentSettings.cycleInterval}
              onChange={(e) => handleAgentIntervalChange(Number(e.target.value))}
              min={1}
              max={120}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              aria-label="Trading cycle interval in minutes"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Agents will run every {agentSettings.cycleInterval} minute
              {agentSettings.cycleInterval !== 1 ? 's' : ''}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
