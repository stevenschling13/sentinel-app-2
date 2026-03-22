'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface StreamPriceData {
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  timestamp: string;
  change_pct: number;
}

const SSE_URL = '/api/engine/stream/prices';
const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

/**
 * React hook that opens an SSE connection to stream live prices.
 * Falls back gracefully if the connection fails.
 */
export function usePriceStream() {
  const [prices, setPrices] = useState<Map<string, StreamPriceData>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    cleanup();

    const es = new EventSource(SSE_URL);
    esRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      reconnectDelay.current = INITIAL_RECONNECT_DELAY;
      setIsStreaming(true);
    };

    es.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data) as
          | { type: 'snapshot'; data: Record<string, StreamPriceData> }
          | { type: 'update'; ticker: string; data: StreamPriceData };

        if (msg.type === 'snapshot') {
          setPrices(new Map(Object.entries(msg.data)));
        } else if (msg.type === 'update') {
          setPrices((prev) => {
            const next = new Map(prev);
            next.set(msg.ticker, msg.data);
            return next;
          });
        }
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      if (!mountedRef.current) return;
      setIsStreaming(false);
      es.close();
      esRef.current = null;

      // Reconnect with exponential backoff
      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);
      reconnectTimer.current = setTimeout(connect, delay);
    };
  }, [cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      cleanup();
      setIsStreaming(false);
    };
  }, [connect, cleanup]);

  return { prices, isStreaming };
}
