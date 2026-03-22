import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/stores/app-store';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      selectedTicker: null,
      sidebarOpen: true,
      marketStatus: 'closed',
      engineOnline: null,
      agentsOnline: null,
    });
  });

  it('has correct initial state', () => {
    const state = useAppStore.getState();
    expect(state.selectedTicker).toBeNull();
    expect(state.sidebarOpen).toBe(true);
    expect(state.marketStatus).toBe('closed');
    expect(state.engineOnline).toBeNull();
    expect(state.agentsOnline).toBeNull();
  });

  it('sets selected ticker', () => {
    useAppStore.getState().setSelectedTicker('AAPL');
    expect(useAppStore.getState().selectedTicker).toBe('AAPL');
  });

  it('clears selected ticker', () => {
    useAppStore.getState().setSelectedTicker('AAPL');
    useAppStore.getState().setSelectedTicker(null);
    expect(useAppStore.getState().selectedTicker).toBeNull();
  });

  it('toggles sidebar', () => {
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarOpen).toBe(false);
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarOpen).toBe(true);
  });

  it('sets market status', () => {
    useAppStore.getState().setMarketStatus('open');
    expect(useAppStore.getState().marketStatus).toBe('open');
  });

  it('sets engine online status', () => {
    useAppStore.getState().setEngineOnline(true);
    expect(useAppStore.getState().engineOnline).toBe(true);
    useAppStore.getState().setEngineOnline(false);
    expect(useAppStore.getState().engineOnline).toBe(false);
  });

  it('sets agents online status', () => {
    useAppStore.getState().setAgentsOnline(true);
    expect(useAppStore.getState().agentsOnline).toBe(true);
  });
});
