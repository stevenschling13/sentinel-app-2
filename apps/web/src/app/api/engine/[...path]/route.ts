import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/server/service-proxy';

const ENGINE_URL = process.env.ENGINE_URL ?? 'http://localhost:8000';
const ENGINE_API_KEY = process.env.ENGINE_API_KEY ?? 'sentinel-dev-key';

async function handler(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, ENGINE_URL, ENGINE_API_KEY, path);
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
