import { create } from 'zustand';

export interface RealtimeAlertItem {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  ticker: string | null;
  acknowledged: boolean;
  created_at: string;
}

export interface RealtimeSignalItem {
  id: string;
  agent_role: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  order_type: string;
  limit_price: number | null;
  reason: string | null;
  strategy_name: string | null;
  signal_strength: number | null;
  status: string;
  created_at: string;
}

interface AppState {
  selectedTicker: string | null;
  sidebarOpen: boolean;
  marketStatus: 'open' | 'closed' | 'pre' | 'post';
  engineOnline: boolean | null;
  agentsOnline: boolean | null;
  realtimeAlerts: RealtimeAlertItem[];
  realtimeSignals: RealtimeSignalItem[];
  setSelectedTicker: (ticker: string | null) => void;
  toggleSidebar: () => void;
  setMarketStatus: (status: AppState['marketStatus']) => void;
  setEngineOnline: (online: boolean | null) => void;
  setAgentsOnline: (online: boolean | null) => void;
  addRealtimeAlert: (alert: RealtimeAlertItem) => void;
  addRealtimeSignal: (signal: RealtimeSignalItem) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedTicker: null,
  sidebarOpen: true,
  marketStatus: 'closed',
  engineOnline: null,
  agentsOnline: null,
  realtimeAlerts: [],
  realtimeSignals: [],
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setMarketStatus: (status) => set({ marketStatus: status }),
  setEngineOnline: (online) => set({ engineOnline: online }),
  setAgentsOnline: (online) => set({ agentsOnline: online }),
  addRealtimeAlert: (alert) =>
    set((s) => ({
      realtimeAlerts: [alert, ...s.realtimeAlerts.filter((a) => a.id !== alert.id)],
    })),
  addRealtimeSignal: (signal) =>
    set((s) => ({
      realtimeSignals: [signal, ...s.realtimeSignals.filter((r) => r.id !== signal.id)],
    })),
}));
