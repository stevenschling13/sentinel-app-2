'use client';

import { useRef, useEffect, useMemo } from 'react';
import {
  createChart,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type UTCTimestamp,
  CrosshairMode,
} from 'lightweight-charts';
import type { BarData } from '@/hooks/use-chart-data';

/* ─── RSI calculation ─── */

function calcRSI(data: BarData[], period: number = 14): { time: UTCTimestamp; value: number }[] {
  if (data.length < period + 1) return [];
  const result: { time: UTCTimestamp; value: number }[] = [];

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push({
    time: data[period].time as UTCTimestamp,
    value: +(100 - 100 / (1 + rs)).toFixed(2),
  });

  // Smoothed RSI
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({ time: data[i].time as UTCTimestamp, value: +rsi.toFixed(2) });
  }

  return result;
}

/* ─── MACD calculation ─── */

interface MACDResult {
  macd: { time: UTCTimestamp; value: number }[];
  signal: { time: UTCTimestamp; value: number }[];
  histogram: { time: UTCTimestamp; value: number; color: string }[];
}

function calcEMAFromValues(
  values: { time: UTCTimestamp; value: number }[],
  period: number,
): { time: UTCTimestamp; value: number }[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const result: { time: UTCTimestamp; value: number }[] = [];

  let sum = 0;
  for (let i = 0; i < Math.min(period, values.length); i++) sum += values[i].value;
  let ema = sum / Math.min(period, values.length);
  result.push({
    time: values[Math.min(period - 1, values.length - 1)].time,
    value: +ema.toFixed(4),
  });

  for (let i = period; i < values.length; i++) {
    ema = values[i].value * k + ema * (1 - k);
    result.push({ time: values[i].time, value: +ema.toFixed(4) });
  }
  return result;
}

function calcMACD(
  data: BarData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): MACDResult {
  const empty: MACDResult = { macd: [], signal: [], histogram: [] };
  if (data.length < slowPeriod) return empty;

  // Calculate EMA fast & slow from close prices
  const fastK = 2 / (fastPeriod + 1);
  const slowK = 2 / (slowPeriod + 1);

  let fastEMA = 0;
  let slowEMA = 0;
  for (let i = 0; i < slowPeriod; i++) {
    if (i < fastPeriod) fastEMA += data[i].close / fastPeriod;
    slowEMA += data[i].close / slowPeriod;
  }

  // Warm up fast EMA if fastPeriod < slowPeriod
  for (let i = fastPeriod; i < slowPeriod; i++) {
    fastEMA = data[i].close * fastK + fastEMA * (1 - fastK);
  }

  const macdValues: { time: UTCTimestamp; value: number }[] = [];
  macdValues.push({
    time: data[slowPeriod - 1].time as UTCTimestamp,
    value: +(fastEMA - slowEMA).toFixed(4),
  });

  for (let i = slowPeriod; i < data.length; i++) {
    fastEMA = data[i].close * fastK + fastEMA * (1 - fastK);
    slowEMA = data[i].close * slowK + slowEMA * (1 - slowK);
    macdValues.push({
      time: data[i].time as UTCTimestamp,
      value: +(fastEMA - slowEMA).toFixed(4),
    });
  }

  const signalValues = calcEMAFromValues(macdValues, signalPeriod);

  // Align MACD, signal and create histogram
  const signalMap = new Map(signalValues.map((s) => [s.time, s.value]));
  const histogram: { time: UTCTimestamp; value: number; color: string }[] = [];
  const alignedMacd: { time: UTCTimestamp; value: number }[] = [];
  const alignedSignal: { time: UTCTimestamp; value: number }[] = [];

  for (const m of macdValues) {
    const sig = signalMap.get(m.time);
    if (sig !== undefined) {
      alignedMacd.push(m);
      alignedSignal.push({ time: m.time, value: sig });
      const diff = m.value - sig;
      histogram.push({
        time: m.time,
        value: +diff.toFixed(4),
        color: diff >= 0 ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)',
      });
    }
  }

  return { macd: alignedMacd, signal: alignedSignal, histogram };
}

/* ─── Shared chart options ─── */

const PANEL_CHART_OPTIONS = {
  layout: {
    background: { color: '#09090b' },
    textColor: '#a1a1aa',
    fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
  },
  grid: {
    vertLines: { color: '#1a1a1e' },
    horzLines: { color: '#1a1a1e' },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: '#52525b', width: 1 as const, labelBackgroundColor: '#27272a' },
    horzLine: { color: '#52525b', width: 1 as const, labelBackgroundColor: '#27272a' },
  },
  rightPriceScale: { borderColor: '#27272a' },
  timeScale: { borderColor: '#27272a', visible: false },
  handleScale: false as const,
  handleScroll: false as const,
} as const;

/* ─── RSI Panel ─── */

export function RSIPanel({ bars, visible }: { bars: BarData[]; visible: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const rsiData = useMemo(() => calcRSI(bars, 14), [bars]);

  useEffect(() => {
    if (!visible || !containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...PANEL_CHART_OPTIONS,
      height: 120,
    });
    chartRef.current = chart;

    // RSI line
    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#a78bfa',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    rsiSeries.setData(rsiData);

    // Overbought/oversold reference lines
    const overbought = chart.addSeries(LineSeries, {
      color: 'rgba(239,68,68,0.3)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const oversold = chart.addSeries(LineSeries, {
      color: 'rgba(34,197,94,0.3)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    if (rsiData.length > 0) {
      const refData = rsiData.map((d) => ({ time: d.time }));
      overbought.setData(refData.map((d) => ({ ...d, value: 70 })));
      oversold.setData(refData.map((d) => ({ ...d, value: 30 })));
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) chart.applyOptions({ width: entry.contentRect.width });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [visible, rsiData]);

  if (!visible) return null;

  return (
    <div className="border-t border-zinc-800">
      <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          RSI (14)
        </span>
      </div>
      <div ref={containerRef} className="w-full" style={{ height: 120 }} />
    </div>
  );
}

/* ─── MACD Panel ─── */

export function MACDPanel({ bars, visible }: { bars: BarData[]; visible: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const macdData = useMemo(() => calcMACD(bars, 12, 26, 9), [bars]);

  useEffect(() => {
    if (!visible || !containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...PANEL_CHART_OPTIONS,
      height: 140,
    });
    chartRef.current = chart;

    // MACD histogram
    const histSeries = chart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
    });
    histSeries.setData(macdData.histogram);

    // MACD line
    const macdLine = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    macdLine.setData(macdData.macd);

    // Signal line
    const signalLine = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    signalLine.setData(macdData.signal);

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) chart.applyOptions({ width: entry.contentRect.width });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [visible, macdData]);

  if (!visible) return null;

  return (
    <div className="border-t border-zinc-800">
      <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          MACD (12, 26, 9)
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-zinc-600">
          <span className="inline-block h-1.5 w-3 rounded-sm bg-cyan-500" /> MACD
          <span className="inline-block h-1.5 w-3 rounded-sm bg-amber-500" /> Signal
        </span>
      </div>
      <div ref={containerRef} className="w-full" style={{ height: 140 }} />
    </div>
  );
}
