'use client';

import { createBrowserClient } from '@supabase/ssr';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
