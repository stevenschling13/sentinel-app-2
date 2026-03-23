'use client';

import { useRef, useEffect } from 'react';
import {
  createChart,
  AreaSeries,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';

interface EquityCurveProps {
  data: { time: string; value: number }[];
  className?: string;
}

export function EquityCurve({ data, className }: EquityCurveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#a1a1aa',
        fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#27272a' },
        horzLines: { color: '#27272a' },
      },
      rightPriceScale: {
        borderColor: '#27272a',
        scaleMargins: { top: 0.1, bottom: 0.05 },
      },
      timeScale: {
        borderColor: '#27272a',
        timeVisible: false,
      },
      crosshair: {
        vertLine: { color: '#52525b', width: 1, labelBackgroundColor: '#27272a' },
        horzLine: { color: '#52525b', width: 1, labelBackgroundColor: '#27272a' },
      },
    });
    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#22c55e',
      topColor: 'rgba(34,197,94,0.25)',
      bottomColor: 'rgba(34,197,94,0.02)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    series.setData(
      data.map((d) => ({
        time: (d.time.includes('T') ? Math.floor(new Date(d.time).getTime() / 1000) : d.time) as UTCTimestamp,
        value: d.value,
      })),
    );

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  return <div ref={containerRef} className={className ?? 'h-[300px] w-full'} />;
}
