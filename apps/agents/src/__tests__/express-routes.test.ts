import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ── Mocks ───────────────────────────────────────────────────
const mockOrchestrator = {
  getAgentInfo: vi.fn(() => [
    {
      role: 'market_sentinel',
      name: 'Market Sentinel',
      description: 'Monitors market conditions',
      status: 'idle',
      lastRun: null,
      enabled: true,
    },
    {
      role: 'strategy_analyst',
      name: 'Strategy Analyst',
      description: 'Runs trading strategies',
      status: 'idle',
      lastRun: null,
      enabled: true,
    },
    {
      role: 'risk_monitor',
      name: 'Risk Monitor',
      description: 'Monitors portfolio risk',
      status: 'idle',
      lastRun: null,
      enabled: true,
    },
  ]),
  runCycle: vi.fn(() => Promise.resolve([])),
  currentState: {
    agents: { market_sentinel: 'idle', strategy_analyst: 'idle', risk_monitor: 'idle' },
    lastRun: { market_sentinel: null, strategy_analyst: null, risk_monitor: null },
    cycleCount: 0,
    halted: false,
    lastCycleAt: null,
  },
  halt: vi.fn(),
  resume: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
};

import { listRecommendations } from '../recommendations-store.js';

vi.mock('../orchestrator.js', () => {
  return {
    Orchestrator: class MockOrchestrator {
      constructor() {
        return mockOrchestrator;
      }
    },
  };
});

vi.mock('../recommendations-store.js', () => ({
  listAlerts: vi.fn(() => Promise.resolve([])),
  listRecommendations: vi.fn(() => Promise.resolve([])),
}));

beforeAll(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.ENGINE_URL = 'http://localhost:8000';
  process.env.ENGINE_API_KEY = 'test-engine-key';
});

describe('Express routes', () => {
  let app: import('express').Express;

  beforeAll(async () => {
    const mod = await import('../app.js');
    app = mod.app;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default return values after clearAllMocks
    mockOrchestrator.getAgentInfo.mockReturnValue([
      {
        role: 'market_sentinel',
        name: 'Market Sentinel',
        description: 'Monitors market conditions',
        status: 'idle',
        lastRun: null,
        enabled: true,
      },
      {
        role: 'strategy_analyst',
        name: 'Strategy Analyst',
        description: 'Runs trading strategies',
        status: 'idle',
        lastRun: null,
        enabled: true,
      },
      {
        role: 'risk_monitor',
        name: 'Risk Monitor',
        description: 'Monitors portfolio risk',
        status: 'idle',
        lastRun: null,
        enabled: true,
      },
    ]);
    mockOrchestrator.runCycle.mockReturnValue(Promise.resolve([]));
    mockOrchestrator.currentState = {
      agents: { market_sentinel: 'idle', strategy_analyst: 'idle', risk_monitor: 'idle' },
      lastRun: { market_sentinel: null, strategy_analyst: null, risk_monitor: null },
      cycleCount: 0,
      halted: false,
      lastCycleAt: null,
    };
  });

  it('GET /health returns 200 with status', async () => {
    const res = await request(app).get('/health').expect(200);

    expect(res.body).toHaveProperty('status');
    expect(res.body.service).toBe('sentinel-agents');
    // With all env vars set, status should be 'ok'
    expect(res.body.status).toBe('ok');
  });

  it('GET /health reports degraded when env vars missing', async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.missing).toContain('ANTHROPIC_API_KEY');

    process.env.ANTHROPIC_API_KEY = saved;
  });

  it('GET /agents returns list of agents', async () => {
    const res = await request(app).get('/agents').expect(200);

    expect(res.body).toHaveProperty('agents');
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.agents.length).toBe(3);

    const names = res.body.agents.map((a: { name: string }) => a.name);
    expect(names).toContain('Market Sentinel');
    expect(names).toContain('Strategy Analyst');
    expect(names).toContain('Risk Monitor');
  });

  it('GET /alerts returns empty alerts array', async () => {
    const res = await request(app).get('/alerts').expect(200);

    expect(res.body).toHaveProperty('alerts');
    expect(res.body.alerts).toEqual([]);
  });

  it('POST /cycle returns triggered status with cycleCount', async () => {
    const res = await request(app).post('/cycle').expect(200);

    expect(res.body.status).toBe('triggered');
    expect(res.body).toHaveProperty('cycleCount');
    expect(typeof res.body.cycleCount).toBe('number');
  });

  it('GET /cycle/status returns orchestrator state', async () => {
    const res = await request(app).get('/cycle/status').expect(200);

    expect(res.body).toHaveProperty('agents');
    expect(res.body).toHaveProperty('cycleCount');
    expect(res.body).toHaveProperty('halted');
    expect(res.body.halted).toBe(false);
  });

  it('POST /halt halts the orchestrator', async () => {
    const res = await request(app).post('/halt').send({ reason: 'test halt' }).expect(200);

    expect(res.body).toEqual({ halted: true });
    expect(mockOrchestrator.halt).toHaveBeenCalledWith('test halt');
  });

  it('POST /halt uses default reason when none provided', async () => {
    const res = await request(app).post('/halt').send({}).expect(200);

    expect(res.body).toEqual({ halted: true });
    expect(mockOrchestrator.halt).toHaveBeenCalledWith('Manual halt');
  });

  it('POST /resume resumes the orchestrator', async () => {
    const res = await request(app).post('/resume').expect(200);

    expect(res.body).toEqual({ halted: false });
    expect(mockOrchestrator.resume).toHaveBeenCalled();
  });

  it('GET /recommendations returns empty array', async () => {
    const res = await request(app).get('/recommendations').expect(200);

    expect(res.body).toHaveProperty('recommendations');
    expect(res.body.recommendations).toEqual([]);
  });

  it('GET /recommendations passes status filter', async () => {
    const mockListRecs = vi.mocked(listRecommendations);
    mockListRecs.mockResolvedValue([]);

    await request(app).get('/recommendations?status=pending').expect(200);

    expect(mockListRecs).toHaveBeenCalledWith('pending');
  });

  it('GET /nonexistent returns 404', async () => {
    await request(app).get('/nonexistent').expect(404);
  });
});
