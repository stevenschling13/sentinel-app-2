import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, classifyError, toastError, safeFetch } from '@/lib/api-error';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from 'sonner';

describe('ApiError', () => {
  it('creates with kind, message, and status', () => {
    const err = new ApiError('server', 'Internal error', 500);
    expect(err.kind).toBe('server');
    expect(err.message).toBe('Internal error');
    expect(err.status).toBe(500);
    expect(err.name).toBe('ApiError');
    expect(err).toBeInstanceOf(Error);
  });

  it('creates without status', () => {
    const err = new ApiError('network', 'No connection');
    expect(err.status).toBeUndefined();
  });
});

describe('classifyError()', () => {
  it('returns existing ApiError unchanged', () => {
    const original = new ApiError('timeout', 'timed out');
    expect(classifyError(original)).toBe(original);
  });

  it('classifies TimeoutError DOMException', () => {
    const err = new DOMException('timeout', 'TimeoutError');
    const result = classifyError(err);
    expect(result.kind).toBe('timeout');
    expect(result.message).toContain('timed out');
  });

  it('classifies AbortError DOMException', () => {
    const err = new DOMException('aborted', 'AbortError');
    const result = classifyError(err);
    expect(result.kind).toBe('timeout');
    expect(result.message).toContain('aborted');
  });

  it('classifies TypeError with fetch/network in message', () => {
    const err = new TypeError('Failed to fetch');
    const result = classifyError(err);
    expect(result.kind).toBe('network');
  });

  it('classifies SyntaxError as parse', () => {
    const err = new SyntaxError('Unexpected token');
    const result = classifyError(err);
    expect(result.kind).toBe('parse');
  });

  it('classifies generic Error as unknown', () => {
    const err = new Error('something broke');
    const result = classifyError(err);
    expect(result.kind).toBe('unknown');
    expect(result.message).toContain('something broke');
  });

  it('classifies non-Error value as unknown', () => {
    const result = classifyError('string error');
    expect(result.kind).toBe('unknown');
    expect(result.message).toContain('unexpected error');
  });

  it('prepends context prefix when provided', () => {
    const err = new TypeError('Failed to fetch');
    const result = classifyError(err, 'loadData');
    expect(result.message).toContain('[loadData]');
  });
});

describe('toastError()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error toast with message for error kind', () => {
    const err = new ApiError('timeout', 'timed out');
    toastError(err);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('timed out'),
      expect.objectContaining({ duration: 5000 }),
    );
  });

  it('includes action prefix', () => {
    const err = new ApiError('network', 'no connection');
    toastError(err, 'Fetch prices');
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Fetch prices'),
      expect.any(Object),
    );
  });

  it('includes status in description when present', () => {
    const err = new ApiError('server', 'fail', 500);
    toastError(err);
    expect(toast.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ description: 'Status 500' }),
    );
  });

  it('omits description when no status', () => {
    const err = new ApiError('network', 'no connection');
    toastError(err);
    expect(toast.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ description: undefined }),
    );
  });
});

describe('safeFetch()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('returns [data, null] on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const [data, err] = await safeFetch<{ ok: boolean }>('/test');
    expect(data).toEqual({ ok: true });
    expect(err).toBeNull();
  });

  it('returns [null, ApiError] on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'not found' }), { status: 404 }),
    );
    const [data, err] = await safeFetch('/test');
    expect(data).toBeNull();
    expect(err).toBeInstanceOf(ApiError);
    expect(err!.kind).toBe('upstream');
    expect(err!.status).toBe(404);
  });

  it('classifies 500+ as server error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    );
    const [, err] = await safeFetch('/test');
    expect(err!.kind).toBe('server');
  });

  it('handles fetch throw as classified error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const [data, err] = await safeFetch('/test');
    expect(data).toBeNull();
    expect(err!.kind).toBe('network');
  });

  it('shows toast when showToast is true and request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));
    await safeFetch('/test', { showToast: true, context: 'Loading' });
    expect(toast.error).toHaveBeenCalled();
  });

  it('does not show toast when showToast is false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));
    await safeFetch('/test', { showToast: false });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('extracts detail from JSON error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Rate limited' }), { status: 429 }),
    );
    const [, err] = await safeFetch('/test');
    expect(err!.message).toBe('Rate limited');
  });

  it('handles non-JSON error body gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>Error</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    );
    const [, err] = await safeFetch('/test');
    expect(err).toBeInstanceOf(ApiError);
    expect(err!.status).toBe(502);
  });
});
