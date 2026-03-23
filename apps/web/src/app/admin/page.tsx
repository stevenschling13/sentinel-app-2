'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Activity,
  RefreshCw,
  Loader2,
  Shield,
  Server,
  Bot,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Pause,
} from 'lucide-react';

interface ServiceHealth {
  status: string;
  service: string;
  engine?: string;
  orchestrator?: { halted: boolean; cycleCount: number };
  missing?: string[];
  dependencies?: Record<string, boolean>;
}

interface AgentInfo {
  role: string;
  name: string;
  description?: string;
  status: string;
  lastRun: string | null;
  enabled: boolean;
}

interface RiskAlert {
  severity: string;
  rule: string;
  message: string;
  timestamp?: string;
}

interface AuditEntry {
  id?: string;
  action?: string;
  entity_type?: string;
  details?: string;
  created_at?: string;
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'ok' || status === 'idle'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : status === 'running'
        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
        : status === 'degraded'
          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
          : 'bg-red-500/10 text-red-400 border-red-500/20';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
        color,
      )}
    >
      {status}
    </span>
  );
}

function DependencyDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full', ok ? 'bg-emerald-400' : 'bg-red-400')}
    />
  );
}

export default function AdminPage() {
  const [agentsHealth, setAgentsHealth] = useState<ServiceHealth | null>(null);
  const [engineHealth, setEngineHealth] = useState<ServiceHealth | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [cycleStatus, setCycleStatus] = useState<Record<string, unknown> | null>(null);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const fetches = [
      fetch('/api/agents/health', { signal: AbortSignal.timeout(5000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/api/engine/health', { signal: AbortSignal.timeout(5000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/api/agents/agents', { signal: AbortSignal.timeout(5000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/api/agents/cycle/status', { signal: AbortSignal.timeout(5000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/api/agents/alerts', { signal: AbortSignal.timeout(5000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/api/engine/audit/decisions', { signal: AbortSignal.timeout(5000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ];
    const [ah, eh, ag, cs, al, au] = await Promise.all(fetches);
    setAgentsHealth(ah);
    setEngineHealth(eh);
    setAgents(Array.isArray(ag) ? ag : (ag?.agents ?? []));
    setCycleStatus(cs);
    setAlerts(Array.isArray(al) ? al : (al?.alerts ?? []));
    setAuditLog(Array.isArray(au) ? au.slice(0, 20) : (au?.decisions?.slice(0, 20) ?? []));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const triggerCycle = useCallback(async () => {
    setTriggering(true);
    try {
      const res = await fetch('/api/agents/cycle', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Trading cycle triggered');
      setTimeout(refresh, 3000);
    } catch {
      toast.error('Failed to trigger cycle');
    } finally {
      setTriggering(false);
    }
  }, [refresh]);

  const isHalted = !!(agentsHealth?.orchestrator?.halted ?? (cycleStatus as Record<string, unknown> | null)?.halted);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">System Admin</h1>
          {isHalted && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
              <Pause className="h-3 w-3" /> HALTED
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={triggerCycle} disabled={triggering || isHalted}>
            {triggering ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="mr-1.5 h-3.5 w-3.5" />
            )}
            Trigger Cycle
          </Button>
        </div>
      </div>

      {loading && !agentsHealth ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Service Health Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Agents Service</span>
                  </div>
                  <StatusBadge status={agentsHealth?.status ?? 'unknown'} />
                </div>
                {agentsHealth?.missing && agentsHealth.missing.length > 0 && (
                  <p className="mt-2 text-[10px] text-yellow-400">
                    Missing: {agentsHealth.missing.join(', ')}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Engine</span>
                  </div>
                  <StatusBadge status={engineHealth?.status ?? 'unknown'} />
                </div>
                {engineHealth?.dependencies && (
                  <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
                    {Object.entries(engineHealth.dependencies).map(([name, ok]) => (
                      <span key={name} className="flex items-center gap-1">
                        <DependencyDot ok={ok as boolean} /> {name}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Activity className="h-4 w-4" />
                  <span className="text-sm font-medium text-foreground">Cycles</span>
                </div>
                <p className="mt-1 text-2xl font-bold font-[family-name:var(--font-geist-mono)]">
                  {String(
                    agentsHealth?.orchestrator?.cycleCount ??
                      (cycleStatus as Record<string, unknown>)?.cycleCount ??
                      0,
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground">total completed</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium text-foreground">Active Alerts</span>
                </div>
                <p className="mt-1 text-2xl font-bold font-[family-name:var(--font-geist-mono)]">
                  {alerts.length}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {alerts.filter((a) => a.severity === 'critical').length} critical
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Agent Status Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Agent Status</CardTitle>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agent data available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">Agent</th>
                        <th className="pb-2 font-medium">Role</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Enabled</th>
                        <th className="pb-2 font-medium text-right">Last Run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((a) => (
                        <tr key={a.role} className="border-b border-border/50 last:border-0">
                          <td className="py-2.5 font-medium">{a.name}</td>
                          <td className="py-2.5 font-[family-name:var(--font-geist-mono)] text-xs text-muted-foreground">
                            {a.role}
                          </td>
                          <td className="py-2.5">
                            <StatusBadge status={a.status} />
                          </td>
                          <td className="py-2.5">
                            {a.enabled ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-400" />
                            )}
                          </td>
                          <td className="py-2.5 text-right text-xs text-muted-foreground">
                            {a.lastRun ? new Date(a.lastRun).toLocaleTimeString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Alerts */}
          {alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Risk Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.slice(0, 10).map((a, i) => (
                  <div
                    key={`${a.rule}-${i}`}
                    className={cn(
                      'flex items-start gap-3 rounded-md border p-3 text-xs',
                      a.severity === 'critical'
                        ? 'border-red-500/20 bg-red-500/5'
                        : a.severity === 'warning'
                          ? 'border-yellow-500/20 bg-yellow-500/5'
                          : 'border-border bg-muted/30',
                    )}
                  >
                    <AlertTriangle
                      className={cn(
                        'mt-0.5 h-3.5 w-3.5 shrink-0',
                        a.severity === 'critical'
                          ? 'text-red-400'
                          : a.severity === 'warning'
                            ? 'text-yellow-400'
                            : 'text-muted-foreground',
                      )}
                    />
                    <div>
                      <span className="font-medium">{a.rule}</span>
                      <span className="ml-2 text-muted-foreground">{a.message}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent Decisions / Audit Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Agent Decisions</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent decisions</p>
              ) : (
                <div className="space-y-2">
                  {auditLog.map((entry, i) => (
                    <div
                      key={entry.id ?? i}
                      className="flex items-center gap-3 border-b border-border/30 pb-2 text-xs last:border-0"
                    >
                      <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
                      </span>
                      <span className="font-medium">
                        {entry.action ?? entry.entity_type ?? 'decision'}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {entry.details ?? JSON.stringify(entry)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
