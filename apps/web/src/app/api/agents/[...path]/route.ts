import { type NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/server/service-proxy';

const AGENTS_URL = process.env.AGENTS_URL ?? 'http://localhost:3100';
const AGENTS_API_KEY = process.env.AGENTS_API_KEY ?? 'sentinel-dev-key';

async function handler(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, AGENTS_URL, AGENTS_API_KEY, path);
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
