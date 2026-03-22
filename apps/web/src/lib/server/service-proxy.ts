import { NextResponse } from 'next/server';

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

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${apiKey}`);
  headers.set('Content-Type', 'application/json');

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  try {
    const res = await fetch(upstream, init);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 502 });
  }
}
