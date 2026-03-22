'use client';

import { useEffect, useState } from 'react';
import { useAppStore, type RealtimeSignalItem } from '@/stores/app-store';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeSignals() {
  const signals = useAppStore((s) => s.realtimeSignals);
  const addRealtimeSignal = useAppStore((s) => s.addRealtimeSignal);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    async function subscribe() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();

        channel = supabase
          .channel('realtime-agent-recommendations')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'agent_recommendations',
              filter: 'status=eq.pending',
            },
            (payload) => {
              const row = payload.new as RealtimeSignalItem;
              addRealtimeSignal(row);
            },
          )
          .subscribe((status) => {
            setIsSubscribed(status === 'SUBSCRIBED');
          });
      } catch {
        // Supabase env vars missing or client creation failed — graceful fallback
        setIsSubscribed(false);
      }
    }

    subscribe();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
      setIsSubscribed(false);
    };
  }, [addRealtimeSignal]);

  return { signals, isSubscribed };
}
