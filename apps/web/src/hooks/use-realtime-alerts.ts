'use client';

import { useEffect, useState } from 'react';
import { useAppStore, type RealtimeAlertItem } from '@/stores/app-store';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeAlerts() {
  const alerts = useAppStore((s) => s.realtimeAlerts);
  const addRealtimeAlert = useAppStore((s) => s.addRealtimeAlert);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    async function subscribe() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();

        channel = supabase
          .channel('realtime-agent-alerts')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'agent_alerts' },
            (payload) => {
              const row = payload.new as RealtimeAlertItem;
              addRealtimeAlert(row);
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
  }, [addRealtimeAlert]);

  return { alerts, isSubscribed };
}
