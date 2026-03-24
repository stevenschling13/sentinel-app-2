import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const response = GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ status: 'ok', service: 'sentinel-web' });
  });

  it('returns JSON content type', () => {
    const response = GET();
    expect(response.headers.get('content-type')).toContain('application/json');
  });
});
