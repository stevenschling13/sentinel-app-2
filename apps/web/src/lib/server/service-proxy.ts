import { NextResponse } from 'next/server';

/** Maximum number of retry attempts for gateway errors. */
const PROXY_MAX_RETRIES = 2;

/** Request timeout in milliseconds. */
const PROXY_TIMEOUT_MS = 30_000;

/** Base delay in milliseconds for exponential backoff. */
const PROXY_BASE_DELAY_MS = 250;

const RETRYABLE_GATEWAY_CODES = new Set([502, 503, 504]);

function proxyBackoffDelay(attempt: number): number {
  const jitter = 0.8 + Math.random() * 0.4;
  return PROXY_BASE_DELAY_MS * Math.pow(2, attempt) * jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Derive a human-readable service name from the upstream base URL.
 */
function serviceName(upstreamBase: string): string {
  try {
    return new URL(upstreamBase).hostname;
  } catch {
    return upstreamBase;
  }
}

/**
 * Proxy a request to an upstream service, forwarding the path and headers.
 */
export async function proxyRequest(
  request: Request,
  upstreamBase: string,
  apiKey: string,
  pathSegments: string[],
): Promise<NextResponse> {
  const upstreamPath = pathSegments.join('/');
  const url = new URL(request.url);
  const upstream = `${upstreamBase}/${upstreamPath}${url.search}`;
  const service = serviceName(upstreamBase);

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${apiKey}`);
  headers.set('Content-Type', 'application/json');

  const init: RequestInit = {
    method: request.method,
    headers,
    signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  let lastStatus = 502;

  for (let attempt = 0; attempt <= PROXY_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(upstream, init);

      if (attempt < PROXY_MAX_RETRIES && RETRYABLE_GATEWAY_CODES.has(res.status)) {
        lastStatus = res.status;
        const delay = proxyBackoffDelay(attempt);
        console.error(
          `[service-proxy] ${service} returned ${res.status}, retrying (${attempt + 1}/${PROXY_MAX_RETRIES}) in ${Math.round(delay)}ms — ${upstream}`,
        );
        await sleep(delay);
        continue;
      }

      const body = await res.text();
      return new NextResponse(body, {
        status: res.status,
        headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
      });
    } catch (err) {
      console.error(
        `[service-proxy] ${service} request failed — ${upstream}`,
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json({ error: `Service unavailable: ${service}` }, { status: 502 });
    }
  }

  // All retries exhausted with gateway errors
  console.error(
    `[service-proxy] ${service} returned ${lastStatus} after ${PROXY_MAX_RETRIES} retries — ${upstream}`,
  );
  return NextResponse.json({ error: `Service unavailable: ${service}` }, { status: lastStatus });
}
