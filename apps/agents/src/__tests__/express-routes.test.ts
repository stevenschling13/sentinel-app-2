import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

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

  it('POST /cycle returns triggered status', async () => {
    const res = await request(app).post('/cycle').expect(200);

    expect(res.body.status).toBe('triggered');
    expect(res.body.message).toBeDefined();
  });

  it('GET /nonexistent returns 404', async () => {
    await request(app).get('/nonexistent').expect(404);
  });
});
