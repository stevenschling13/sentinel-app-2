import { toast } from 'sonner';

/** Classifies fetch failures for targeted handling. */
export type ApiErrorKind = 'timeout' | 'network' | 'server' | 'parse' | 'upstream' | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** Classify a caught error into an ApiError. */
export function classifyError(err: unknown, context?: string): ApiError {
  if (err instanceof ApiError) return err;

  const prefix = context ? `[${context}] ` : '';

  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return new ApiError('timeout', `${prefix}Request timed out`);
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new ApiError('timeout', `${prefix}Request was aborted`);
  }
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return new ApiError('network', `${prefix}Network error`);
  }
  if (err instanceof SyntaxError) {
    return new ApiError('parse', `${prefix}Invalid response format`);
  }
  if (err instanceof Error) {
    return new ApiError('unknown', `${prefix}${err.message}`);
  }
  return new ApiError('unknown', `${prefix}An unexpected error occurred`);
}

const ERROR_MESSAGES: Record<ApiErrorKind, string> = {
  timeout: 'Request timed out — the service may be slow or unavailable.',
  network: 'Network error — check your connection.',
  server: 'Server error — the service encountered a problem.',
  parse: 'Received an unexpected response format.',
  upstream: 'Upstream service unavailable.',
  unknown: 'Something went wrong.',
};

/** Show a toast notification for an API error. */
export function toastError(err: ApiError, action?: string) {
  const label = action ? `${action}: ` : '';
  toast.error(`${label}${ERROR_MESSAGES[err.kind]}`, {
    description: err.status ? `Status ${err.status}` : undefined,
    duration: 5000,
  });
}

/**
 * Wrapper for fetch calls with timeout, error classification, and optional toast.
 * Returns [data, null] on success or [null, ApiError] on failure.
 */
export async function safeFetch<T>(
  url: string,
  opts: RequestInit & {
    timeout?: number;
    context?: string;
    showToast?: boolean;
  } = {},
): Promise<[T, null] | [null, ApiError]> {
  const { timeout = 8000, context, showToast = false, ...fetchOpts } = opts;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
      ...fetchOpts,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let detail = '';
      try {
        const json = JSON.parse(body);
        detail = json.detail ?? json.error ?? json.message ?? '';
      } catch {
        // not JSON
      }
      const kind: ApiErrorKind = res.status >= 500 ? 'server' : 'upstream';
      const err = new ApiError(kind, detail || `HTTP ${res.status}`, res.status);
      if (showToast) toastError(err, context);
      return [null, err];
    }

    const data = (await res.json()) as T;
    return [data, null];
  } catch (thrown) {
    const err = classifyError(thrown, context);
    if (showToast) toastError(err, context);
    return [null, err];
  }
}
